import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import Redis from 'ioredis';

@Injectable()
export class RedisService
  implements OnModuleDestroy
{
  private readonly client:
    Redis;

  private readyPromise:
    Promise<void> |
    null = null;

  constructor() {
    this.client =
      new Redis(
        process.env.REDIS_URL ??
          'redis://localhost:6379',
        {
          lazyConnect:
            true,

          maxRetriesPerRequest:
            1,

          enableOfflineQueue:
            false,

          connectTimeout:
            5000,
        },
      );

    this.client.on(
      'error',
      (
        error,
      ) => {
        console.error(
          'Redis error:',
          error.message,
        );
      },
    );
  }

  private async ensureReady():
    Promise<void> {
    if (
      this.client.status ===
      'ready'
    ) {
      return;
    }

    if (
      this.readyPromise
    ) {
      return this.readyPromise;
    }

    this.readyPromise =
      this.connectAndWait()
        .finally(
          () => {
            this.readyPromise =
              null;
          },
        );

    return this.readyPromise;
  }

  private async connectAndWait():
    Promise<void> {
    const status =
      this.client.status;

    if (
      status ===
        'wait' ||
      status ===
        'end'
    ) {
      try {
        await this.client
          .connect();
      } catch (
        error
      ) {
        if (
          this.client
            .status !==
          'ready'
        ) {
          throw error;
        }
      }
    }

    if (
      this.client.status ===
      'ready'
    ) {
      return;
    }

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        const timeout =
          setTimeout(
            () => {
              cleanup();

              reject(
                new Error(
                  `Redis did not become ready. Current status: ${this.client.status}`,
                ),
              );
            },
            5000,
          );

        const onReady =
          () => {
            cleanup();
            resolve();
          };

        const onError =
          (
            error:
              Error,
          ) => {
            cleanup();
            reject(
              error,
            );
          };

        const cleanup =
          () => {
            clearTimeout(
              timeout,
            );

            this.client
              .off(
                'ready',
                onReady,
              );

            this.client
              .off(
                'error',
                onError,
              );
          };

        this.client.once(
          'ready',
          onReady,
        );

        this.client.once(
          'error',
          onError,
        );

        if (
          this.client.status ===
          'ready'
        ) {
          cleanup();
          resolve();
        }
      },
    );
  }

  async ping():
    Promise<string> {
    await this.ensureReady();

    return this.client
      .ping();
  }

  async rateLimit(
    scope: string,
    identity: string,
    limit: number,
    windowSeconds: number,
  ) {
    await this.ensureReady();

    const key =
      `sgcommerce:rate:${scope}:${identity}`;

    const script = `
      local current = redis.call('INCR', KEYS[1])

      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end

      local ttl = redis.call('TTL', KEYS[1])

      return { current, ttl }
    `;

    const result =
      await this.client.eval(
        script,
        1,
        key,
        String(
          windowSeconds,
        ),
      ) as [
        number,
        number,
      ];

    const current =
      Number(
        result[0],
      );

    const ttl =
      Math.max(
        1,
        Number(
          result[1],
        ),
      );

    return {
      allowed:
        current <= limit,

      remaining:
        Math.max(
          0,
          limit - current,
        ),

      retryAfter:
        ttl,
    };
  }

  async acquireLock(
    key: string,
    ttlMs = 15000,
  ): Promise<
    string | null
  > {
    await this.ensureReady();

    const token =
      randomUUID();

    const result =
      await this.client.set(
        `sgcommerce:lock:${key}`,
        token,
        'PX',
        ttlMs,
        'NX',
      );

    return result ===
      'OK'
      ? token
      : null;
  }

  async releaseLock(
    key: string,
    token: string,
  ): Promise<void> {
    await this.ensureReady();

    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end

      return 0
    `;

    await this.client.eval(
      script,
      1,
      `sgcommerce:lock:${key}`,
      token,
    );
  }

  async onModuleDestroy():
    Promise<void> {
    if (
      this.client.status ===
        'wait' ||
      this.client.status ===
        'end'
    ) {
      this.client
        .disconnect();

      return;
    }

    try {
      await this.client
        .quit();
    } catch {
      this.client
        .disconnect();
    }
  }
}
