import AppError from "../../utils/AppError";
import { ConversationStatus, MessageSender, Prisma } from "@prisma/client";
import { IListMessagesQuery, ISendMessagePayload } from "./message.interface";
import { prisma } from "../../lib/prisma";

const getConversationOrThrow = async (companyId: string, conversationId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
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
  conversationId: string,
  senderType: MessageSender,
  payload: ISendMessagePayload,
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationId);
  assertOwnership(conversation.customerId, opts?.customerId);

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderType,
        content: payload.content,
        attachments: payload.attachments ? (payload.attachments as Prisma.InputJsonValue) : undefined,
      },
    });

    const currentConversation = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true },
    });

    // A customer following up on a CLOSED conversation reopens it.
    if (senderType === MessageSender.CUSTOMER && currentConversation?.status === ConversationStatus.CLOSED) {
      await tx.conversation.updateMany({
        where: { id: conversationId, status: ConversationStatus.CLOSED },
        data: { status: ConversationStatus.OPEN, updatedAt: new Date() },
      });
    }

    return message;
  });
};

const getMessages = async (
  companyId: string,
  conversationId: string,
  query: IListMessagesQuery,
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationId);
  assertOwnership(conversation.customerId, opts?.customerId);

  const limit = query.limit ?? 30;

  const messages = await prisma.message.findMany({
    where: { conversationId },
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
  conversationId: string,
  readerType: "AGENT" | "CUSTOMER",
  opts?: { customerId?: string },
) => {
  const conversation = await getConversationOrThrow(companyId, conversationId);
  assertOwnership(conversation.customerId, opts?.customerId);

  const result =
    readerType === "AGENT"
      ? await prisma.message.updateMany({
          where: { conversationId, senderType: { in: ["CUSTOMER", "AI"] }, readByAgentAt: null },
          data: { readByAgentAt: new Date() },
        })
      : await prisma.message.updateMany({
          where: { conversationId, senderType: { in: ["AGENT", "AI"] }, readByCustomerAt: null },
          data: { readByCustomerAt: new Date() },
        });

  return { updatedCount: result.count };
};

export const MessageService = { sendMessage, getMessages, markMessagesRead };
