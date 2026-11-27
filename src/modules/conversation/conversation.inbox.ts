import { ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { OPEN_CONVERSATION_STATUSES, openStatusFor } from "./conversation.constants.js";
import { ConversationRealtime } from "./conversation.realtime.js";
import { IActor } from "./conversation.interface.js";

// The agent acting on the inbox (req.agent).
export interface InboxAgent {
  id: string;
  publicId: string;
  role: "ADMIN" | "AGENT";
}

export const INBOX_VIEWS = ["waiting", "mine", "all", "resolved"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

const CLOSED_STATUSES: ConversationStatus[] = [ConversationStatus.RESOLVED, ConversationStatus.CLOSED];

const conversationInclude = {
  customer: { omit: { visitorKeyHash: true } },
  assignedAgent: { select: { id: true, publicId: true, name: true, email: true, role: true } },
} satisfies Prisma.ConversationInclude;

const isAdmin = (agent: InboxAgent) => agent.role === "ADMIN";

const logEvent = (
  conversationId: string,
  type: Prisma.ConversationEventCreateInput["type"],
  actor: IActor,
  meta?: Prisma.InputJsonValue,
) =>
  prisma.conversationEvent.create({
    data: { conversationId, type, actorId: actor.id, actorType: actor.type, meta },
  });

const findOrThrow = async (companyId: string, publicId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { publicId, companyId },
    include: conversationInclude,
  });
  if (!conversation) throw new AppError(404, "Conversation not found");
  return conversation;
};

const reload = (id: string) =>
  prisma.conversation.findUniqueOrThrow({ where: { id }, include: conversationInclude });

// ---- list ----------------------------------------------------------------------

const viewWhere = (companyId: string, view: InboxView, agent: InboxAgent): Prisma.ConversationWhereInput => {
  switch (view) {
    case "waiting":
      return { companyId, status: ConversationStatus.WAITING };
    case "mine":
      return { companyId, assignedAgentId: agent.id, status: { in: OPEN_CONVERSATION_STATUSES } };
    case "all":
      return { companyId, status: { in: OPEN_CONVERSATION_STATUSES } };
    case "resolved":
      return { companyId, status: { in: CLOSED_STATUSES } };
  }
};

// Waiting is a queue: whoever has waited longest comes first. Everything
// else shows the most recent activity first.
const viewOrder = (view: InboxView): Prisma.ConversationOrderByWithRelationInput[] =>
  view === "waiting" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }];

// One page of the inbox, each row with its last message and how many
// customer messages agents haven't read. Three queries, not one per row.
const listInbox = async (
  companyId: string,
  agent: InboxAgent,
  query: { view: InboxView; page?: number; limit?: number },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 30;
  const where = viewWhere(companyId, query.view, agent);

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: viewOrder(query.view),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { publicId: true, name: true, email: true, externalId: true } },
        assignedAgent: { select: { publicId: true, name: true } },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true, senderType: true, content: true, createdAt: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  const unread = rows.length
    ? await prisma.message.groupBy({
        by: ["conversationId"],
        where: { conversationId: { in: rows.map((r) => r.id) }, senderType: "CUSTOMER", readByAgentAt: null },
        _count: { _all: true },
      })
    : [];
  const unreadById = new Map(unread.map((u) => [u.conversationId, u._count._all]));

  const data = rows.map((row) => ({
    publicId: row.publicId,
    status: row.status,
    priority: row.priority,
    labels: row.labels,
    createdAt: row.createdAt,
    lastActivityAt: row.updatedAt,
    customer: row.customer,
    assignedAgent: row.assignedAgent,
    lastMessage: row.messages[0] ?? null,
    unreadCount: unreadById.get(row.id) ?? 0,
  }));

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// Tab badges and the sidebar's waiting count.
const inboxCounts = async (companyId: string, agent: InboxAgent) => {
  const [waiting, mine, all] = await Promise.all([
    prisma.conversation.count({ where: viewWhere(companyId, "waiting", agent) }),
    prisma.conversation.count({ where: viewWhere(companyId, "mine", agent) }),
    prisma.conversation.count({ where: viewWhere(companyId, "all", agent) }),
  ]);
  return { waiting, mine, all };
};

// ---- actions -------------------------------------------------------------------
//
// Every action is a single conditional UPDATE: the rule ("still waiting",
// "still yours") is part of the WHERE clause, so the database settles races.
// If two agents claim at the same moment, one update matches and the other
// matches zero rows. Reading first and writing after would let both "win".

const claim = async (companyId: string, publicId: string, agent: InboxAgent, actor: IActor) => {
  const conversation = await findOrThrow(companyId, publicId);

  const { count } = await prisma.conversation.updateMany({
    where: { id: conversation.id, status: ConversationStatus.WAITING, assignedAgentId: null },
    data: { status: ConversationStatus.ACTIVE, assignedAgentId: agent.id },
  });

  if (count === 0) {
    const current = await reload(conversation.id);
    if (current.assignedAgentId === agent.id) return current; // already yours: claiming twice is fine
    if (current.assignedAgent) {
      throw new AppError(409, `${current.assignedAgent.name} already claimed this conversation`);
    }
    throw new AppError(409, "This conversation is no longer waiting");
  }

  const updated = await reload(conversation.id);
  await logEvent(conversation.id, "ASSIGNED", actor, { previousAgentId: null, newAgentId: agent.id, claimed: true });
  await logEvent(conversation.id, "STATUS_CHANGED", actor, { from: ConversationStatus.WAITING, to: ConversationStatus.ACTIVE });
  ConversationRealtime.assignmentChanged(updated);
  ConversationRealtime.statusChanged(updated, ConversationStatus.ACTIVE, ConversationStatus.WAITING);
  return updated;
};

// Puts an active conversation back in the waiting queue. Only the agent
// handling it, or an admin.
const unclaim = async (companyId: string, publicId: string, agent: InboxAgent, actor: IActor) => {
  const conversation = await findOrThrow(companyId, publicId);

  const { count } = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      status: ConversationStatus.ACTIVE,
      assignedAgentId: isAdmin(agent) ? { not: null } : agent.id,
    },
    data: { status: ConversationStatus.WAITING, assignedAgentId: null },
  });

  if (count === 0) {
    const current = await reload(conversation.id);
    if (current.status === ConversationStatus.WAITING) return current;
    if (current.status !== ConversationStatus.ACTIVE) {
      throw new AppError(409, "Only an active conversation can be released");
    }
    throw new AppError(403, "Only the assigned agent or an admin can release this conversation");
  }

  const updated = await reload(conversation.id);
  await logEvent(conversation.id, "UNASSIGNED", actor, { previousAgentId: conversation.assignedAgentId, newAgentId: null });
  await logEvent(conversation.id, "STATUS_CHANGED", actor, { from: ConversationStatus.ACTIVE, to: ConversationStatus.WAITING });
  ConversationRealtime.assignmentChanged(updated);
  ConversationRealtime.statusChanged(updated, ConversationStatus.WAITING, ConversationStatus.ACTIVE);
  return updated;
};

// Resolving keeps the assigned agent, so if the customer writes again the
// conversation goes straight back to them (see MessageService.sendMessage).
const resolve = async (companyId: string, publicId: string, agent: InboxAgent, actor: IActor) => {
  const conversation = await findOrThrow(companyId, publicId);

  const { count } = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      status: { in: OPEN_CONVERSATION_STATUSES },
      ...(isAdmin(agent) ? {} : { assignedAgentId: agent.id }),
    },
    data: { status: ConversationStatus.RESOLVED },
  });

  if (count === 0) {
    const current = await reload(conversation.id);
    if (CLOSED_STATUSES.includes(current.status)) return current;
    throw new AppError(403, "Only the assigned agent or an admin can resolve this conversation");
  }

  const updated = await reload(conversation.id);
  await logEvent(conversation.id, "STATUS_CHANGED", actor, { from: conversation.status, to: ConversationStatus.RESOLVED });
  ConversationRealtime.statusChanged(updated, ConversationStatus.RESOLVED, conversation.status);
  return updated;
};

// Back to the agent who had it, or into the waiting queue if nobody did.
const reopen = async (companyId: string, publicId: string, agent: InboxAgent, actor: IActor) => {
  const conversation = await findOrThrow(companyId, publicId);
  const nextStatus = openStatusFor(conversation.assignedAgentId);

  // An agent may reopen their own conversation or an unassigned one; an admin
  // any. Matching the assignee we read also guarantees nextStatus is still right.
  const mayReopen = isAdmin(agent) || !conversation.assignedAgentId || conversation.assignedAgentId === agent.id;
  const { count } = mayReopen
    ? await prisma.conversation.updateMany({
        where: { id: conversation.id, status: { in: CLOSED_STATUSES }, assignedAgentId: conversation.assignedAgentId },
        data: { status: nextStatus },
      })
    : { count: 0 };

  if (count === 0) {
    const current = await reload(conversation.id);
    if (!mayReopen) throw new AppError(403, "Only the assigned agent or an admin can reopen this conversation");
    if (OPEN_CONVERSATION_STATUSES.includes(current.status)) return current;
    throw new AppError(409, "This conversation changed, refresh and try again");
  }

  const updated = await reload(conversation.id);
  await logEvent(conversation.id, "STATUS_CHANGED", actor, { from: conversation.status, to: nextStatus });
  ConversationRealtime.statusChanged(updated, nextStatus, conversation.status);
  return updated;
};

export const InboxService = { listInbox, inboxCounts, claim, unclaim, resolve, reopen };
