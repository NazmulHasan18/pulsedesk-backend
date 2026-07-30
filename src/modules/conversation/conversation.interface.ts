import { ConversationStatus, ConversationPriority, ConversationSource } from "@prisma/client";

export interface ICreateConversationPayload {
  customerId: string;
  source?: ConversationSource;
}

export interface IUpdateStatusPayload {
  status: ConversationStatus;
}

export interface IUpdatePriorityPayload {
  priority: ConversationPriority;
}

export interface IAssignAgentPayload {
  agentId: string | null; // null = unassign
}

export interface IAddLabelPayload {
  label: string;
}

export interface ICreateNotePayload {
  content: string;
}

export interface IConversationFilters {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assignedAgentId?: string;
  label?: string;
  page?: number;
  limit?: number;
}

export interface IActor {
  id: string;
  type: "AGENT" | "SUPERADMIN" | "SYSTEM";
}
