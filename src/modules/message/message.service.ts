import AppError from "../../utils/AppError.js";
import { ConversationStatus, MessageSender, Prisma } from "@prisma/client";
import { IListMessagesQuery, ISendMessagePayload } from "./message.interface.js";
import { prisma } from "../../lib/prisma.js";
import { openStatusFor } from "../conversation/conversation.constants.js";

// Accepts either the internal id or the publicId, so the widget can work with
// public ids only while existing dashboard callers keep using internal ids.
const getConversationOrThrow = async (companyId: string, conversationRef: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { companyId, OR: [{ id: conversationRef }, { publicId: conversationRef }] },
  });
  if (!conversation) throw new AppError(404, "Conversation not found");
  return conversation;
};

const assertOwnership = (conversationCustomerId: string, customerId?: string) => {
  if (customerId && conversationCustomerId !== customerId) {
    throw new AppError(403, "This conversation does not belong to you");
  }
};

const sendMessage = async (
  companyId: string,
  conversationRef: string,
  senderType: MessageSender,
  payload: ISendMessagePayload,
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationRef);
  assertOwnership(conversation.customerId, opts?.customerId);

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderType,
        content: payload.content,
        attachments: payload.attachments ? (payload.attachments as Prisma.InputJsonValue) : undefined,
      },
    });

    // A customer writing into a RESOLVED or CLOSED conversation reopens it:
    // back to its agent if it still has one, otherwise into the WAITING queue.
    if (senderType === MessageSender.CUSTOMER) {
      await tx.conversation.updateMany({
        where: {
          id: conversation.id,
          status: { in: [ConversationStatus.RESOLVED, ConversationStatus.CLOSED] },
        },
        data: { status: openStatusFor(conversation.assignedAgentId), updatedAt: new Date() },
      });
    }

    return message;
  });
};

const getMessages = async (
  companyId: string,
  conversationRef: string,
  query: IListMessagesQuery,
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationRef);
  assertOwnership(conversation.customerId, opts?.customerId);

  const limit = query.limit ?? 30;

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  });

  const hasNextPage = messages.length > limit;
  const page = hasNextPage ? messages.slice(0, -1) : messages;
  const data = page.reverse(); // chronological order for the client

  return {
    data,
    meta: { hasNextPage, nextCursor: hasNextPage ? page[0].id : null },
  };
};

const markMessagesRead = async (
  companyId: string,
  conversationRef: string,
  readerType: "AGENT" | "CUSTOMER",
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationRef);
  assertOwnership(conversation.customerId, opts?.customerId);

  const result =
    readerType === "AGENT"
      ? await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderType: { in: ["CUSTOMER", "AI"] }, readByAgentAt: null },
          data: { readByAgentAt: new Date() },
        })
      : await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderType: { in: ["AGENT", "AI"] }, readByCustomerAt: null },
          data: { readByCustomerAt: new Date() },
        });

  return { updatedCount: result.count };
};

export const MessageService = { sendMessage, getMessages, markMessagesRead };
