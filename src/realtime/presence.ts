// src/realtime/presence.ts

import { Redis } from "ioredis";
import { prisma } from "../lib/prisma.js";
import { createRedisClient } from "./redis.client.js";
import { REALTIME_EVENTS, rooms } from "./realtime.constants.js";
import { realtimeEmitter } from "./realtime.emitter.js";

// An agent is online while at least one of their sockets (any tab, any server
// instance) is connected. The count lives in Redis so every instance agrees;
// the expiry cleans up after a crashed instance that never sent DECR.
const COUNT_TTL_SECONDS = 24 * 60 * 60;
const key = (agentId: string) => `pulsedesk:presence:agent:${agentId}`;

let redis: Redis | null = null;
const client = () => (redis ??= createRedisClient("presence"));

export const areAgentsOnline = async (companyId: string) =>
  (await prisma.agent.count({ where: { companyId, isActive: true, isOnline: true } })) > 0;

const setOnline = async (agentId: string, companyId: string, isOnline: boolean) => {
  const agent = await prisma.agent.update({
    where: { id: agentId },
    data: { isOnline },
    select: { id: true, publicId: true },
  });

  void realtimeEmitter.emit(
    isOnline ? REALTIME_EVENTS.AGENT_ONLINE : REALTIME_EVENTS.AGENT_OFFLINE,
    companyId,
    { agentId: agent.id, publicId: agent.publicId, isOnline },
    { rooms: [rooms.company(companyId)] },
  );

  // Visitors only learn whether someone is available, never who.
  void realtimeEmitter.emit(
    REALTIME_EVENTS.AGENTS_AVAILABILITY,
    companyId,
    { agentsOnline: await areAgentsOnline(companyId) },
    { rooms: [rooms.visitors(companyId)] },
  );
};

const agentConnected = async (agentId: string, companyId: string) => {
  const count = await client().incr(key(agentId));
  await client().expire(key(agentId), COUNT_TTL_SECONDS);
  if (count === 1) await setOnline(agentId, companyId, true);
};

const agentDisconnected = async (agentId: string, companyId: string) => {
  const count = await client().decr(key(agentId));
  if (count <= 0) {
    await client().del(key(agentId));
    await setOnline(agentId, companyId, false);
  }
};

const shutdown = async () => {
  const current = redis;
  redis = null;
  await current?.quit();
};

export const presence = { agentConnected, agentDisconnected, shutdown };
