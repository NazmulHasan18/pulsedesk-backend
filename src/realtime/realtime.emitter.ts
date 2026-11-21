// src/realtime/realtime.emitter.ts

import { randomUUID } from "crypto";
import { getSocketServer } from "./socket.server.js";
import { sseManager } from "./sse.manager.js";
import { RedisPubSubAdapter } from "./pubsub.adapter.js";
import { rooms } from "./realtime.constants.js";
import { RealtimeEventName, RealtimeMessage } from "./realtime.interface.js";

const INSTANCE_ID = randomUUID();

export interface EmitTarget {
  rooms?: string[];
  except?: string[];
}

// This is the only thing services/controllers should ever import. It never
// touches Socket.io or SSE directly - it publishes to Redis, and every app
// instance (including the one that published) receives it back through the
// subscription and delivers it to its own local sockets. That means
// single-instance and multi-instance deployments behave identically.
//
// Services call emit() after their database write has committed and do not
// await it: a Redis hiccup must never fail a request whose data is already
// saved. Until init() runs (tests, scripts) emit() is a no-op.
class RealtimeEmitter {
  private pubsub: RedisPubSubAdapter | null = null;

  async init(): Promise<void> {
    if (this.pubsub) return;
    this.pubsub = new RedisPubSubAdapter();
    await this.pubsub.subscribe((message) => this.deliverLocally(message));
  }

  async emit<T>(event: RealtimeEventName, companyId: string, payload: T, target: EmitTarget = {}): Promise<void> {
    if (!this.pubsub) return;

    const message: RealtimeMessage<T> = {
      event,
      companyId,
      rooms: target.rooms,
      except: target.except,
      payload,
      emittedAt: new Date().toISOString(),
      originInstanceId: INSTANCE_ID,
    };

    try {
      await this.pubsub.publish(message);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[realtime] failed to publish ${event}:`, err);
    }
  }

  async shutdown(): Promise<void> {
    const pubsub = this.pubsub;
    this.pubsub = null;
    await pubsub?.disconnect();
  }

  private deliverLocally(message: RealtimeMessage): void {
    const targetRooms = message.rooms?.length ? message.rooms : [rooms.company(message.companyId)];

    try {
      // `local`: every instance receives this message from Redis, so each one
      // only delivers to its own sockets. Without it the Socket.io Redis
      // adapter would fan out again and clients would get duplicates.
      let operator = getSocketServer().local.to(targetRooms);
      if (message.except?.length) operator = operator.except(message.except);
      operator.emit(message.event, message.payload);
    } catch {
      // Socket.io not initialized on this process - SSE clients still get it.
    }

    sseManager.deliver(message);
  }
}

export const realtimeEmitter = new RealtimeEmitter();
