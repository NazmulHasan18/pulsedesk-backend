// src/realtime/realtime.interface.ts

import { REALTIME_EVENTS } from "./realtime.constants.js";

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// Who a realtime connection belongs to. Mirrors the three connection types
// the schema already supports: Agent (ADMIN/AGENT), SuperAdmin, Customer.
export type RealtimeActorType = "AGENT" | "SUPERADMIN" | "CUSTOMER";

export interface RealtimeIdentity {
  actorType: RealtimeActorType;
  actorId: string; // Agent.id / Customer.id / SuperAdmin.id
  companyId: string | null; // null for SuperAdmin, which is not company-scoped
  name?: string; // agent display name, shown in typing indicators
}

// Envelope published on Redis and delivered to transports (Socket.io / SSE).
// Every event is scoped to a companyId - this is the tenant boundary and is
// enforced at delivery time, not just at the call site.
export interface RealtimeMessage<T = unknown> {
  event: RealtimeEventName;
  companyId: string;
  // Rooms to deliver to (a socket in several of them gets the event once).
  // Defaults to the company room.
  rooms?: string[];
  // Sockets in any of these rooms are skipped, e.g. send a visitor-safe copy
  // to a conversation room except the agents (who get the full copy).
  except?: string[];
  payload: T;
  emittedAt: string; // ISO timestamp
  originInstanceId: string; // which app process published it
}

// Contract any pub/sub backend must satisfy. Redis today; swappable later
// (NATS, Kafka, Postgres LISTEN/NOTIFY) without touching emitter callers.
export interface IPubSubAdapter {
  publish(message: RealtimeMessage): Promise<void>;
  subscribe(onMessage: (message: RealtimeMessage) => void): Promise<void>;
  disconnect(): Promise<void>;
}

// Contract for anything that can push a message to connected clients.
// Socket.io server and SSEManager both satisfy this shape conceptually,
// which is what lets RealtimeEmitter treat them uniformly.
export interface IRealtimeTransport {
  deliver(message: RealtimeMessage): void;
}
