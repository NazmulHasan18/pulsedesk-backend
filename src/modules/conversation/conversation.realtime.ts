import { ConversationStatus, Message } from "@prisma/client";
import { realtimeEmitter } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS, rooms } from "../../realtime/realtime.constants.js";

// Live updates for conversations. Called after the database write has
// committed, never awaited (see RealtimeEmitter).
//
// Who receives what:
//  - company room       = the company's agents: full objects.
//  - conversation room  = agents who opened it + the visitor who owns it:
//                         only what a visitor may see. Internal notes and agent
//                         details beyond the name never go here.

interface ConversationRef {
  id: string;
  publicId: string;
  companyId: string;
}

const bothRooms = (c: ConversationRef) => [rooms.conversation(c.id), rooms.company(c.companyId)];

// Sent once to anyone in either room (Socket.io de-duplicates across rooms).
const messageCreated = (conversation: ConversationRef, message: Message) => {
  void realtimeEmitter.emit(
    REALTIME_EVENTS.MESSAGE_CREATED,
    conversation.companyId,
    { conversationId: conversation.publicId, message },
    { rooms: bothRooms(conversation) },
  );
};

const messagesRead = (conversation: ConversationRef, readerType: "AGENT" | "CUSTOMER", readAt: Date) => {
  void realtimeEmitter.emit(
    REALTIME_EVENTS.MESSAGE_READ,
    conversation.companyId,
    { conversationId: conversation.publicId, readerType, readAt },
    { rooms: bothRooms(conversation) },
  );
};

const conversationCreated = (conversation: ConversationRef) => {
  void realtimeEmitter.emit(REALTIME_EVENTS.CONVERSATION_CREATED, conversation.companyId, { conversation });
};

const statusChanged = (conversation: ConversationRef, status: ConversationStatus, previousStatus: ConversationStatus) => {
  if (status === previousStatus) return;
  void realtimeEmitter.emit(
    REALTIME_EVENTS.CONVERSATION_STATUS_CHANGED,
    conversation.companyId,
    { conversationId: conversation.publicId, status, previousStatus },
    { rooms: bothRooms(conversation) },
  );
};

// Agents get the whole updated conversation; the visitor only learns the name
// of the agent now handling their chat.
const assignmentChanged = (
  conversation: ConversationRef & { assignedAgent: { name: string } | null },
) => {
  const event = conversation.assignedAgent
    ? REALTIME_EVENTS.CONVERSATION_ASSIGNED
    : REALTIME_EVENTS.CONVERSATION_UNASSIGNED;

  void realtimeEmitter.emit(event, conversation.companyId, {
    conversationId: conversation.publicId,
    conversation,
  });
  void realtimeEmitter.emit(
    event,
    conversation.companyId,
    {
      conversationId: conversation.publicId,
      agent: conversation.assignedAgent ? { name: conversation.assignedAgent.name } : null,
    },
    { rooms: [rooms.conversation(conversation.id)], except: [rooms.company(conversation.companyId)] },
  );
};

// Agent-only updates: company room.
const updatedForAgents = (
  event:
    | typeof REALTIME_EVENTS.CONVERSATION_PRIORITY_CHANGED
    | typeof REALTIME_EVENTS.CONVERSATION_LABEL_ADDED
    | typeof REALTIME_EVENTS.CONVERSATION_LABEL_REMOVED,
  conversation: ConversationRef,
) => {
  void realtimeEmitter.emit(event, conversation.companyId, { conversationId: conversation.publicId, conversation });
};

const noteAdded = (conversation: ConversationRef, note: unknown) => {
  void realtimeEmitter.emit(REALTIME_EVENTS.NOTE_ADDED, conversation.companyId, {
    conversationId: conversation.publicId,
    note,
  });
};

export const ConversationRealtime = {
  messageCreated,
  messagesRead,
  conversationCreated,
  statusChanged,
  assignmentChanged,
  updatedForAgents,
  noteAdded,
};
