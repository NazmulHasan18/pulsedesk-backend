// src/realtime/realtime.constants.ts

export const REALTIME_EVENTS = {
  MESSAGE_CREATED: 'message:created',
  MESSAGE_READ: 'message:read',
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_STATUS_CHANGED: 'conversation:status_changed',
  CONVERSATION_PRIORITY_CHANGED: 'conversation:priority_changed',
  CONVERSATION_ASSIGNED: 'conversation:assigned',
  CONVERSATION_UNASSIGNED: 'conversation:unassigned',
  CONVERSATION_LABEL_ADDED: 'conversation:label_added',
  CONVERSATION_LABEL_REMOVED: 'conversation:label_removed',
  NOTE_ADDED: 'conversation:note_added',
  AGENT_ONLINE: 'agent:online',
  AGENT_OFFLINE: 'agent:offline',
  AGENT_TYPING: 'agent:typing',
  CUSTOMER_TYPING: 'customer:typing',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// Single Redis channel for everything. The event name travels inside the
// payload, so we don't need to manage N channels or dynamic subscriptions -
// every instance subscribes once and re-emits locally to whatever transport
// (socket room / SSE room) is listening.
export const REALTIME_CHANNEL = 'pulsedesk:realtime';

// Canonical room-name builders shared by Socket.io and SSE so the two
// transports never drift apart on naming.
export const rooms = {
  company: (companyId: string) => `company:${companyId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  agent: (agentId: string) => `agent:${agentId}`,
};
