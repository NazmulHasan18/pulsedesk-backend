// src/realtime/socket.server.ts

import type { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { createRedisClient } from "./redis.client.js";
import { CLIENT_EVENTS, REALTIME_EVENTS, rooms } from "./realtime.constants.js";
import { RealtimeIdentity } from "./realtime.interface.js";
import { presence } from "./presence.js";
import { verifyToken, verifyWidgetToken } from "../utils/jwt.js";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { isOriginAllowed, resolveWidgetSettings } from "../modules/company/company.settings.js";

interface JoinedConversation {
  id: string;
  publicId: string;
}

declare module "socket.io" {
  interface SocketData {
    identity: RealtimeIdentity;
    // Conversations this socket was allowed to join, keyed by both id and publicId.
    conversations: Map<string, JoinedConversation>;
    // Last typing state sent per conversation, for throttling.
    typing: Map<string, { isTyping: boolean; at: number }>;
  }
}

type JoinAck = (result: { ok: true; conversationId: string } | { ok: false; error: string }) => void;

// A client may repeat the same typing state at most this often.
const TYPING_THROTTLE_MS = 1000;

let io: IOServer | null = null;
let adapterClients: Redis[] = [];

// Resolves who is connecting. Agents/super-admins send their access JWT as
// `token`; widget visitors send their widget session token as `widgetToken`.
// Every check the HTTP auth() middleware does (tokenVersion, isActive) is
// repeated here so a logged-out or deactivated agent can't keep a socket open.
//
// `origin` is the browser's Origin header. Agents may only connect from the
// dashboard (CORS_ORIGINS); visitors only from the company's allowed websites.
// Non-browser clients send no Origin and are not restricted by it.
export const authenticateSocket = async (
  auth: Record<string, unknown>,
  origin?: string,
): Promise<RealtimeIdentity> => {
  const { token, widgetToken } = auth;

  if (typeof token === "string" && token) {
    if (origin && !env.CORS_ORIGINS.includes(origin)) {
      throw new Error("Origin not allowed");
    }

    const decoded = verifyToken(token, env.JWT_ACCESS_SECRET);

    if (decoded.userType === "superadmin") {
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { publicId: decoded.id },
        select: { id: true, tokenVersion: true },
      });
      if (!superAdmin || superAdmin.tokenVersion !== decoded.tokenVersion) {
        throw new Error("Session expired");
      }
      return { actorType: "SUPERADMIN", actorId: superAdmin.id, companyId: null };
    }

    const agent = await prisma.agent.findUnique({
      where: { publicId: decoded.id },
      select: { id: true, name: true, companyId: true, tokenVersion: true, isActive: true },
    });
    if (!agent || agent.tokenVersion !== decoded.tokenVersion) {
      throw new Error("Session expired");
    }
    if (!agent.isActive) {
      throw new Error("Account deactivated");
    }
    return { actorType: "AGENT", actorId: agent.id, companyId: agent.companyId, name: agent.name };
  }

  if (typeof widgetToken === "string" && widgetToken) {
    const claims = verifyWidgetToken(widgetToken, env.WIDGET_SESSION_SECRET);
    const customer = await prisma.customer.findFirst({
      where: { id: claims.customerId, companyId: claims.companyId },
      select: { id: true, companyId: true, company: { select: { name: true, settings: true } } },
    });
    if (!customer) {
      throw new Error("Widget session is no longer valid");
    }
    if (!isOriginAllowed(origin, resolveWidgetSettings(customer.company).allowedOrigins)) {
      throw new Error("Origin not allowed");
    }
    return { actorType: "CUSTOMER", actorId: customer.id, companyId: customer.companyId };
  }

  throw new Error("Authentication required");
};

// A socket may join a conversation room only if the conversation belongs to
// its company, and - for a widget visitor - only if it is their own.
export const findJoinableConversation = async (identity: RealtimeIdentity, conversationRef: string) => {
  if (!identity.companyId) return null;

  return prisma.conversation.findFirst({
    where: {
      OR: [{ id: conversationRef }, { publicId: conversationRef }],
      companyId: identity.companyId,
      ...(identity.actorType === "CUSTOMER" ? { customerId: identity.actorId } : {}),
    },
    select: { id: true, publicId: true },
  });
};

const handleJoin = async (socket: Socket, conversationRef: unknown, ack?: JoinAck) => {
  const reply: JoinAck = typeof ack === "function" ? ack : () => undefined;

  if (typeof conversationRef !== "string" || !conversationRef) {
    return reply({ ok: false, error: "conversationId is required" });
  }

  try {
    const conversation = await findJoinableConversation(socket.data.identity, conversationRef);
    if (!conversation) {
      return reply({ ok: false, error: "Conversation not found" });
    }

    await socket.join(rooms.conversation(conversation.id));
    socket.data.conversations.set(conversation.id, conversation);
    socket.data.conversations.set(conversation.publicId, conversation);
    return reply({ ok: true, conversationId: conversation.publicId });
  } catch {
    return reply({ ok: false, error: "Could not join conversation" });
  }
};

const handleLeave = (socket: Socket, conversationRef: unknown) => {
  if (typeof conversationRef !== "string") return;

  const conversation = socket.data.conversations.get(conversationRef);
  if (!conversation) return;

  socket.leave(rooms.conversation(conversation.id));
  socket.data.conversations.delete(conversation.id);
  socket.data.conversations.delete(conversation.publicId);
  socket.data.typing.delete(conversation.id);
};

// Typing is relayed straight to the other people in the conversation room and
// never stored. Only sockets that joined the conversation may send it.
const handleTyping = (socket: Socket, input: unknown) => {
  if (!input || typeof input !== "object") return;
  const { conversationId, isTyping = true } = input as { conversationId?: unknown; isTyping?: unknown };
  if (typeof conversationId !== "string" || typeof isTyping !== "boolean") return;

  const conversation = socket.data.conversations.get(conversationId);
  if (!conversation) return;

  const now = Date.now();
  const last = socket.data.typing.get(conversation.id);
  if (last && last.isTyping === isTyping && now - last.at < TYPING_THROTTLE_MS) return;
  socket.data.typing.set(conversation.id, { isTyping, at: now });

  const { identity } = socket.data;
  const event = identity.actorType === "CUSTOMER" ? REALTIME_EVENTS.CUSTOMER_TYPING : REALTIME_EVENTS.AGENT_TYPING;
  const payload =
    identity.actorType === "CUSTOMER"
      ? { conversationId: conversation.publicId, isTyping }
      : { conversationId: conversation.publicId, isTyping, agent: { name: identity.name ?? "Agent" } };

  socket.to(rooms.conversation(conversation.id)).emit(event, payload);
};

const logPresenceError = (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[realtime] presence update failed:", err);
};

export const initSocketServer = (httpServer: HttpServer): IOServer => {
  io = new IOServer(httpServer, {
    path: "/realtime/socket.io",
    // Widget sockets come from customer websites, so the transport accepts any
    // origin. Who may connect from where is decided in authenticateSocket,
    // which checks the Origin against the dashboard list or the company's
    // allowedOrigins. Auth travels in the handshake, not in cookies.
    cors: { origin: true },
  });

  // Redis adapter lets rooms/broadcasts work correctly when you run more
  // than one server instance behind a load balancer.
  const adapterPub = createRedisClient("socketio-adapter-pub");
  const adapterSub = createRedisClient("socketio-adapter-sub");
  adapterClients = [adapterPub, adapterSub];
  io.adapter(createAdapter(adapterPub, adapterSub));

  io.use(async (socket, next) => {
    try {
      socket.data.identity = await authenticateSocket(socket.handshake.auth ?? {}, socket.handshake.headers.origin);
      socket.data.conversations = new Map();
      socket.data.typing = new Map();
      return next();
    } catch {
      return next(new Error("Invalid or expired credentials"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { identity } = socket.data;

    // Agents get every company-wide event (new conversations, assignments,
    // presence). Customers never join the company room - only their own
    // conversation rooms, via conversation:join.
    if (identity.actorType === "AGENT" && identity.companyId) {
      const companyId = identity.companyId;
      socket.join(rooms.company(companyId));
      socket.join(rooms.agent(identity.actorId));

      // The disconnect update waits for the connect update, so a socket that
      // drops immediately can't leave the counter (and isOnline) stuck.
      const connected = presence.agentConnected(identity.actorId, companyId).catch(logPresenceError);
      socket.on("disconnect", () => {
        connected
          .then(() => presence.agentDisconnected(identity.actorId, companyId))
          .catch(logPresenceError);
      });
    }

    if (identity.actorType === "CUSTOMER" && identity.companyId) {
      socket.join(rooms.visitors(identity.companyId));
    }

    socket.on(CLIENT_EVENTS.JOIN_CONVERSATION, (ref: unknown, ack?: JoinAck) => handleJoin(socket, ref, ack));
    socket.on(CLIENT_EVENTS.LEAVE_CONVERSATION, (ref: unknown) => handleLeave(socket, ref));
    socket.on(CLIENT_EVENTS.TYPING, (input: unknown) => handleTyping(socket, input));
  });

  return io;
};

export const getSocketServer = (): IOServer => {
  if (!io) {
    throw new Error("Socket.io server not initialized - call initSocketServer(httpServer) first");
  }
  return io;
};

// Closes every socket, the adapter's Redis connections and (Socket.io does
// this itself) the HTTP server it is attached to.
export const closeSocketServer = async (): Promise<void> => {
  const server = io;
  io = null;
  if (server) {
    server.disconnectSockets(true);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await Promise.all(adapterClients.map((c) => c.quit().catch(() => undefined)));
  adapterClients = [];
};
