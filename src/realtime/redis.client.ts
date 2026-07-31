// src/realtime/redis.client.ts

import Redis, { RedisOptions } from "ioredis";
import env from "../config/env";

const REDIS_URL = env.REDIS_URL || "redis://localhost:6379";

const baseOptions: RedisOptions = {
  // Required by both the Socket.io Redis adapter and long-lived subscriber
  // clients - without this, ioredis will throw instead of queueing commands
  // while reconnecting.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

// ioredis needs a dedicated connection per subscriber (a client in
// subscribe-mode can't run other commands), and the Socket.io adapter wants
// its own pub/sub pair too - so this is a small factory, not a singleton.
export const createRedisClient = (connectionName: string): Redis => {
  const client = new Redis(REDIS_URL, { ...baseOptions, connectionName });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[redis:${connectionName}] connection error:`, err.message);
  });

  return client;
};
