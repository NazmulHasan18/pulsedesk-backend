import { prisma } from "../../lib/prisma"; // adjust to your actual prisma client path
import AppError from "../../utils/AppError";
import { IActor, IConversationFilters } from "./conversation.interface";
import { ConversationStatus, ConversationPriority, ConversationSource, Prisma } from "@prisma/client";

const conversationInclude = {
  customer: true,
  assignedAgent: {
    select: { id: true, publicId: true, name: true, email: true, role: true },
  },
};

const logEvent = (
  conversationId: string,
  type: Parameters<typeof prisma.conversationEvent.create>[0]["data"]["type"],
  actor: IActor | null,
  meta?: Prisma.InputJsonValue,
) => {
  return prisma.conversationEvent.create({
    data: {
      conversationId,
      type,
      meta: meta ?? undefined,
      actorId: actor?.id,
      actorType: actor?.type,
    },
  });
};

const findByPublicIdOrThrow = async (companyId: string, publicId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { publicId, companyId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  return conversation;
};

const createOrOpenConversation = async (
  companyId: string,
  customerId: string,
  source: ConversationSource = ConversationSource.AI,
) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });

  if (!customer) {
    throw new AppError(404, "Customer not found for this company");
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      companyId,
      customerId,
      status: { in: [ConversationStatus.OPEN, ConversationStatus.PENDING] },
    },
    include: conversationInclude,
  });

  if (existing) {
    return existing;
  }

  const conversation = await prisma.conversation.create({
    data: { companyId, customerId, source },
    include: conversationInclude,
  });

  await logEvent(conversation.id, "CREATED", { id: "SYSTEM", type: "SYSTEM" }, { source });

  return conversation;
};

const getConversations = async (companyId: string, filters: IConversationFilters) => {
  const { status, priority, assignedAgentId, label, page = 1, limit = 20 } = filters;

  const where = {
    companyId,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(assignedAgentId && { assignedAgentId }),
    ...(label && { labels: { has: label } }),
  };

  const [data, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: conversationInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getConversationDetail = async (companyId: string, publicId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { publicId, companyId },
    include: {
      ...conversationInclude,
      messages: { orderBy: { createdAt: "asc" } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  return conversation;
};

const updateStatus = async (
  companyId: string,
  publicId: string,
  status: ConversationStatus,
  actor: IActor,
) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  if (conversation.status === status) {
    return conversation;
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status },
    include: conversationInclude,
  });

  await logEvent(conversation.id, "STATUS_CHANGED", actor, {
    from: conversation.status,
    to: status,
  });

  return updated;
};

const updatePriority = async (
  companyId: string,
  publicId: string,
  priority: ConversationPriority,
  actor: IActor,
) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  if (conversation.priority === priority) {
    return conversation;
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { priority },
    include: conversationInclude,
  });

  await logEvent(conversation.id, "PRIORITY_CHANGED", actor, {
    from: conversation.priority,
    to: priority,
  });

  return updated;
};

const assignAgent = async (companyId: string, publicId: string, agentId: string | null, actor: IActor) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  if (agentId) {
    const agent = await prisma.agent.findFirst({ where: { id: agentId, companyId } });
    if (!agent) {
      throw new AppError(404, "Agent not found in this company");
    }
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { assignedAgentId: agentId },
    include: conversationInclude,
  });

  await logEvent(conversation.id, agentId ? "ASSIGNED" : "UNASSIGNED", actor, {
    previousAgentId: conversation.assignedAgentId,
    newAgentId: agentId,
  });

  return updated;
};

const addLabel = async (companyId: string, publicId: string, label: string, actor: IActor) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  if (conversation.labels.includes(label)) {
    return conversation;
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { labels: { push: label } },
    include: conversationInclude,
  });

  await logEvent(conversation.id, "LABEL_ADDED", actor, { label });

  return updated;
};

const removeLabel = async (companyId: string, publicId: string, label: string, actor: IActor) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { labels: conversation.labels.filter((l) => l !== label) },
    include: conversationInclude,
  });

  await logEvent(conversation.id, "LABEL_REMOVED", actor, { label });

  return updated;
};

const addNote = async (
  companyId: string,
  publicId: string,
  authorId: string,
  content: string,
  actor: IActor,
) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  const note = await prisma.conversationNote.create({
    data: { conversationId: conversation.id, authorId, content },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logEvent(conversation.id, "NOTE_ADDED", actor, { noteId: note.id });

  return note;
};

const getNotes = async (companyId: string, publicId: string) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  return prisma.conversationNote.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
};

const getHistory = async (companyId: string, publicId: string) => {
  const conversation = await findByPublicIdOrThrow(companyId, publicId);

  return prisma.conversationEvent.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
  });
};

export const ConversationService = {
  createOrOpenConversation,
  getConversations,
  getConversationDetail,
  updateStatus,
  updatePriority,
  assignAgent,
  addLabel,
  removeLabel,
  addNote,
  getNotes,
  getHistory,
};
