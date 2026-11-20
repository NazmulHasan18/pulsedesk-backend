// src/realtime/socket.server.ts

import type { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisClient } from "./redis.client.js";
import { rooms } from "./realtime.constants.js";
import { RealtimeIdentity } from "./realtime.interface.js";
import { verifyToken, verifyWidgetToken } from "../utils/jwt.js";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";

declare module "socket.io" {
  interface SocketData {
    identity: RealtimeIdentity;
  }
}

type JoinAck = (result: { ok: true; conversationId: string } | { ok: false; error: string }) => void;

let io: IOServer | null = null;

// Resolves who is connecting. Agents/super-admins send their access JWT as
// `token`; widget visitors send their widget session token as `widgetToken`.
// Every check the HTTP auth() middleware does (tokenVersion, isActive) is
// repeated here so a logged-out or deactivated agent can't keep a socket open.
export const authenticateSocket = async (auth: Record<string, unknown>): Promise<RealtimeIdentity> => {
  const { token, widgetToken } = auth;

  if (typeof token === "string" && token) {
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
      select: { id: true, companyId: true, tokenVersion: true, isActive: true },
    });
    if (!agent || agent.tokenVersion !== decoded.tokenVersion) {
      throw new Error("Session expired");
    }
    if (!agent.isActive) {
      throw new Error("Account deactivated");
    }
    return { actorType: "AGENT", actorId: agent.id, companyId: agent.companyId };
  }

  if (typeof widgetToken === "string" && widgetToken) {
    const claims = verifyWidgetToken(widgetToken, env.WIDGET_SESSION_SECRET);
    const customer = await prisma.customer.findFirst({
      where: { id: claims.customerId, companyId: claims.companyId },
      select: { id: true, companyId: true },
    });
    if (!customer) {
      throw new Error("Widget session is no longer valid");
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
    select: { id: true },
  });
};

export const initSocketServer = (httpServer: HttpServer): IOServer => {
  io = new IOServer(httpServer, {
    path: "/realtime/socket.io",
    cors: {
      // TODO(1.2): widget sockets come from customer websites - validate them
      // against each company's allowedOrigins once widget settings exist.
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  // Redis adapter lets rooms/broadcasts work correctly when you run more
  // than one server instance behind a load balancer.
  const adapterPub = createRedisClient("socketio-adapter-pub");
  const adapterSub = createRedisClient("socketio-adapter-sub");
  io.adapter(createAdapter(adapterPub, adapterSub));

  io.use(async (socket, next) => {
    try {
      socket.data.identity = await authenticateSocket(socket.handshake.auth ?? {});
      return next();
    } catch {
      return next(new Error("Invalid or expired credentials"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const identity = socket.data.identity;

    if (identity.actorType === "AGENT" && identity.companyId) {
      socket.join(rooms.company(identity.companyId));
      socket.join(rooms.agent(identity.actorId));
    }

    // Customers don't auto-join the company room (they shouldn't see every
    // conversation) - they join their own conversation rooms explicitly.
    socket.on("conversation:join", async (conversationRef: unknown, ack?: JoinAck) => {
      const reply: JoinAck = typeof ack === "function" ? ack : () => undefined;

      if (typeof conversationRef !== "string" || !conversationRef) {
        return reply({ ok: false, error: "conversationId is required" });
      }

      try {
        const conversation = await findJoinableConversation(identity, conversationRef);
        if (!conversation) {
          return reply({ ok: false, error: "Conversation not found" });
        }

        await socket.join(rooms.conversation(conversation.id));
        return reply({ ok: true, conversationId: conversation.id });
      } catch {
        return reply({ ok: false, error: "Could not join conversation" });
      }
    });

    socket.on("conversation:leave", (conversationId: unknown) => {
      if (typeof conversationId === "string") {
        socket.leave(rooms.conversation(conversationId));
      }
    });

    socket.on("disconnect", () => {
      // Hook point for agent presence (emit AGENT_OFFLINE) - step 1.3.
    });
  });

  return io;
};

export const getSocketServer = (): IOServer => {
  if (!io) {
    throw new Error("Socket.io server not initialized - call initSocketServer(httpServer) first");
  }
  return io;
};
