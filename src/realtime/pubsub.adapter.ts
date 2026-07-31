// src/realtime/pubsub.adapter.ts

import { createRedisClient } from './redis.client';
import { REALTIME_CHANNEL } from './realtime.constants';
import { IPubSubAdapter, RealtimeMessage } from './realtime.interface';

export class RedisPubSubAdapter implements IPubSubAdapter {
  private pubClient = createRedisClient('realtime-pub');
  private subClient = createRedisClient('realtime-sub');
  private handlers: Array<(message: RealtimeMessage) => void> = [];

  async publish(message: RealtimeMessage): Promise<void> {
    await this.pubClient.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }

  async subscribe(onMessage: (message: RealtimeMessage) => void): Promise<void> {
    this.handlers.push(onMessage);

    // Bind the underlying Redis SUBSCRIBE only once, no matter how many
    // local handlers register (in practice RealtimeEmitter is the only caller).
    if (this.handlers.length === 1) {
      await this.subClient.subscribe(REALTIME_CHANNEL);

      this.subClient.on('message', (_channel, raw) => {
        let parsed: RealtimeMessage;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[realtime] failed to parse pub/sub message:', err);
          return;
        }
        this.handlers.forEach((handler) => handler(parsed));
      });
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.pubClient.quit(), this.subClient.quit()]);
  }
}
