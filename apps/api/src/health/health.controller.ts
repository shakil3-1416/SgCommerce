import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { RedisService } from '../infrastructure/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection()
    private readonly mongoConnection: Connection,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async getHealth() {
    let redisStatus = 'disconnected';

    try {
      const response = await this.redis.ping();
      redisStatus = response === 'PONG' ? 'connected' : 'degraded';
    } catch {
      redisStatus = 'disconnected';
    }

    return {
      status:
        this.mongoConnection.readyState === 1 &&
        redisStatus === 'connected'
          ? 'ok'
          : 'degraded',

      service: 'sgcommerce-api',

      timestamp: new Date().toISOString(),

      dependencies: {
        mongodb:
          this.mongoConnection.readyState === 1
            ? 'connected'
            : 'disconnected',

        redis: redisStatus,
      },
    };
  }
}
