// src/realtime/sse.manager.ts

import type { Response } from "express";
import { rooms } from "./realtime.constants.js";
import { RealtimeMessage } from "./realtime.interface.js";

interface SSEClient {
  id: string;
  companyId: string;
  rooms: Set<string>;
  res: Response;
}

// Fallback transport for contexts where websockets get blocked (corporate
// proxies, some iframe/embed setups). One HTTP response stays open per
// client and we write `event:`/`data:` frames to it as messages arrive.
class SSEManager {
  private clients = new Map<string, SSEClient>();

  addClient(id: string, companyId: string, res: Response, initialRooms: string[] = []): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // avoid nginx buffering the stream
    });
    res.write("\n");

    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);

    const client: SSEClient = { id, companyId, rooms: new Set(initialRooms), res };
    this.clients.set(id, client);

    res.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(id);
    });
  }

  joinRoom(id: string, room: string): void {
    this.clients.get(id)?.rooms.add(room);
  }

  leaveRoom(id: string, room: string): void {
    this.clients.get(id)?.rooms.delete(room);
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  // Delivers to clients of the message's company that are in one of the
  // target rooms (the company room by default) and in none of the excluded ones.
  deliver(message: RealtimeMessage): void {
    const targetRooms = message.rooms?.length ? message.rooms : [rooms.company(message.companyId)];
    const excluded = message.except ?? [];

    for (const client of this.clients.values()) {
      if (client.companyId !== message.companyId) continue;
      if (!targetRooms.some((room) => client.rooms.has(room))) continue;
      if (excluded.some((room) => client.rooms.has(room))) continue;

      client.res.write(`event: ${message.event}\n`);
      client.res.write(`data: ${JSON.stringify(message.payload)}\n\n`);
    }
  }
}

export const sseManager = new SSEManager();
