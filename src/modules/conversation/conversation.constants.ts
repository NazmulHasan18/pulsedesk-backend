import { ConversationStatus } from "@prisma/client";

// Conversations that are still in progress (a customer message can arrive and
// someone - an agent or the AI - is expected to answer).
export const OPEN_CONVERSATION_STATUSES: ConversationStatus[] = [
  ConversationStatus.WAITING,
  ConversationStatus.ACTIVE,
  ConversationStatus.AI_HANDLED,
];

export const isOpenStatus = (status: ConversationStatus) => OPEN_CONVERSATION_STATUSES.includes(status);

// Status a conversation should have when it (re)opens, based on whether an agent owns it.
export const openStatusFor = (assignedAgentId: string | null) =>
  assignedAgentId ? ConversationStatus.ACTIVE : ConversationStatus.WAITING;
