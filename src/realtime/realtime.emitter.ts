// src/realtime/realtime.emitter.ts

import { randomUUID } from 'crypto';
import { getSocketServer } from './socket.server';
import { sseManager } from './sse.manager';
import { RedisPubSubAdapter } from './pubsub.adapter';
import { rooms } from './realtime.constants';
import { RealtimeEventName, RealtimeMessage } from './realtime.interface';

const INSTANCE_ID = randomUUID();

// This is the only thing services/controllers should ever import. It never
// touches Socket.io or SSE directly - it publishes to Redis, and every app
// instance (including the one that published) receives it back through the
// subscription and delivers it locally. That means single-instance and
// multi-instance deployments behave identically, and adding a new instance
// later requires zero changes at call sites.
class RealtimeEmitter {
  private pubsub = new RedisPubSubAdapter();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.pubsub.subscribe((message) => this.deliverLocally(message));
    this.initialized = true;
  }

  async emit<T>(event: RealtimeEventName, companyId: string, payload: T, room?: string): Promise<void> {
    const message: RealtimeMessage<T> = {
      event,
      companyId,
      room,
      payload,
      emittedAt: new Date().toISOString(),
      originInstanceId: INSTANCE_ID,
    };
    await this.pubsub.publish(message);
  }

  async shutdown(): Promise<void> {
    await this.pubsub.disconnect();
  }

  private deliverLocally(message: RealtimeMessage): void {
    const targetRoom = message.room ?? rooms.company(message.companyId);

    try {
      getSocketServer().to(targetRoom).emit(message.event, message.payload);
    } catch {
      // Socket.io not initialized yet (e.g. during tests/scripts) - SSE
      // clients still get the message below.
    }

    sseManager.deliver(message);
  }
}

export const realtimeEmitter = new RealtimeEmitter();
