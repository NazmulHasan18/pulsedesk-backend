// src/realtime/socket.server.ts

import type { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisClient } from "./redis.client";
import { rooms } from "./realtime.constants";
import { RealtimeIdentity } from "./realtime.interface";

// ---- Adjust these two imports to match your actual module paths ----
import { verifyToken } from "../utils/jwt"; // expected: (token: string) => { id, role, companyId?, tokenVersion }
import env from "../config/env";
import { prisma } from "../lib/prisma";
// ----------------------------------------------------------------------

declare module "socket.io" {
  interface SocketData {
    identity: RealtimeIdentity;
  }
}

let io: IOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): IOServer => {
  io = new IOServer(httpServer, {
    path: "/realtime/socket.io",
    cors: {
      origin: "*", // TODO: restrict to allowed embed origins per company/plan
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
      const { token, siteId, externalId } = socket.handshake.auth ?? {};

      if (token) {
        // Agent / Admin / SuperAdmin connection - reuses the same JWT
        // verification as the HTTP auth() middleware.
        const decoded = verifyToken(token, env.JWT_ACCESS_SECRET) as {
          id: string;
          role: "ADMIN" | "AGENT" | "SUPERADMIN";
          companyId?: string;
        };

        socket.data.identity = {
          actorType: decoded.role === "SUPERADMIN" ? "SUPERADMIN" : "AGENT",
          actorId: decoded.id,
          companyId: decoded.companyId ?? null,
        };
        return next();
      }

      if (siteId && externalId) {
        // Anonymous widget customer - resolved by (companyId, externalId),
        // same pair used by the widget's own upsert flow.
        const company = await prisma.company.findUnique({ where: { siteId } });
        if (!company) return next(new Error("Unknown site"));

        const customer = await prisma.customer.findUnique({
          where: { companyId_externalId: { companyId: company.id, externalId } },
        });

        socket.data.identity = {
          actorType: "CUSTOMER",
          actorId: customer?.id ?? externalId,
          companyId: company.id,
        };
        return next();
      }

      return next(new Error("Authentication required"));
    } catch (err) {
      return next(new Error("Invalid or expired credentials"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const identity = socket.data.identity;

    if (identity.actorType !== "CUSTOMER" && identity.companyId) {
      socket.join(rooms.company(identity.companyId));
      socket.join(rooms.agent(identity.actorId));
    }

    // Customers don't auto-join the whole company room (they shouldn't see
    // every conversation) - they join specific conversation rooms explicitly.
    socket.on("conversation:join", (conversationId: string) => {
      // TODO: verify identity is allowed into this conversation
      // (agent of the same company, or the customer who owns it) before
      // joining - this handler currently trusts the client-supplied id.
      socket.join(rooms.conversation(conversationId));
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(rooms.conversation(conversationId));
    });

    socket.on("disconnect", () => {
      // Hook point for agent presence (emit AGENT_OFFLINE) once presence
      // tracking is built.
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
