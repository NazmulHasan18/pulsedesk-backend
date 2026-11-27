import AppError from "../../utils/AppError.js";
import { ConversationStatus, Message, MessageSender, Prisma } from "@prisma/client";
import { IListMessagesQuery, ISendMessagePayload } from "./message.interface.js";
import { prisma } from "../../lib/prisma.js";
import { openStatusFor } from "../conversation/conversation.constants.js";
import { ConversationRealtime } from "../conversation/conversation.realtime.js";

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

const findByClientMessageId = (conversationId: string, clientMessageId: string) =>
  prisma.message.findUnique({
    where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
  });

// Saves the message, then broadcasts it. Sending again with the same
// clientMessageId (a retry after a timeout or reconnect) returns the original
// message with `created: false` and broadcasts nothing.
const sendMessage = async (
  companyId: string,
  conversationRef: string,
  senderType: MessageSender,
  payload: ISendMessagePayload,
  opts?: { customerId?: string; agent?: { id: string; role: "ADMIN" | "AGENT" } },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationRef);
  assertOwnership(conversation.customerId, opts?.customerId);

  // One agent per conversation: an agent claims it before replying. Admins
  // may always step in.
  const agent = opts?.agent;
  if (agent && agent.role !== "ADMIN" && conversation.assignedAgentId !== agent.id) {
    throw new AppError(403, "Claim this conversation before replying");
  }

  const { clientMessageId } = payload;
  if (clientMessageId) {
    const existing = await findByClientMessageId(conversation.id, clientMessageId);
    if (existing) return { message: existing, created: false };
  }

  const reopensTo =
    senderType === MessageSender.CUSTOMER ? openStatusFor(conversation.assignedAgentId) : null;

  let result: { message: Message; reopened: boolean };
  try {
    result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType,
          content: payload.content,
          clientMessageId,
          attachments: payload.attachments ? (payload.attachments as Prisma.InputJsonValue) : undefined,
        },
      });

      // A customer writing into a RESOLVED or CLOSED conversation reopens it:
      // back to its agent if it still has one, otherwise into the WAITING queue.
      let reopened = false;
      if (reopensTo) {
        const { count } = await tx.conversation.updateMany({
          where: {
            id: conversation.id,
            status: { in: [ConversationStatus.RESOLVED, ConversationStatus.CLOSED] },
          },
          data: { status: reopensTo, updatedAt: new Date() },
        });
        reopened = count > 0;
      }

      // Inbox lists sort by last activity.
      await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

      return { message, reopened };
    });
  } catch (err) {
    // Two identical retries raced: the other one saved it first.
    if (clientMessageId && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await findByClientMessageId(conversation.id, clientMessageId);
      if (existing) return { message: existing, created: false };
    }
    throw err;
  }

  ConversationRealtime.messageCreated(conversation, result.message);
  if (result.reopened && reopensTo) {
    ConversationRealtime.statusChanged(conversation, reopensTo, conversation.status);
  }

  return { message: result.message, created: true };
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

  // Catch-up after a reconnect: everything newer than the last message the
  // client has, oldest first. Same (createdAt, id) order as the pages below.
  if (query.after) {
    const anchor = await prisma.message.findFirst({
      where: { id: query.after, conversationId: conversation.id },
      select: { id: true, createdAt: true },
    });
    if (!anchor) throw new AppError(404, "Message not found in this conversation");

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        OR: [
          { createdAt: { gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { gt: anchor.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    });

    const hasNextPage = messages.length > limit;
    const data = hasNextPage ? messages.slice(0, -1) : messages;
    // To keep catching up, call again with after = the last id returned.
    return { data, meta: { hasNextPage, nextCursor: null } };
  }

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

  const readAt = new Date();
  const result =
    readerType === "AGENT"
      ? await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderType: { in: ["CUSTOMER", "AI"] }, readByAgentAt: null },
          data: { readByAgentAt: readAt },
        })
      : await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderType: { in: ["AGENT", "AI"] }, readByCustomerAt: null },
          data: { readByCustomerAt: readAt },
        });

  if (result.count > 0) {
    ConversationRealtime.messagesRead(conversation, readerType, readAt);
  }

  return { updatedCount: result.count };
};

export const MessageService = { sendMessage, getMessages, markMessagesRead };
