export type TAgentRole = 'ADMIN' | 'AGENT';

export type TCreateAgentPayload = {
  name: string;
  email: string;
  role?: TAgentRole;
  password: string;
};

export type TInviteAgentPayload = {
  name: string;
  email: string;
  role?: TAgentRole;
};

export type TUpdateAgentPayload = {
  name?: string;
  email?: string;
  role?: TAgentRole;
};

export type TAgentStatusPayload = {
  isActive: boolean;
};

export type TAgentListQuery = {
  search?: string;
  role?: TAgentRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
};
