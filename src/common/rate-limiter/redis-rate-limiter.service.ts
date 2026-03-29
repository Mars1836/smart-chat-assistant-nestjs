import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type {
  RateLimiter,
  RateLimiterCheckResult,
} from './rate-limiter.interface';

const LUA_SLIDING_WINDOW = `
-- KEYS[1] = rate key
-- ARGV[1] = windowSec
-- ARGV[2] = maxRequests
-- ARGV[3] = now (milliseconds)
local windowSec = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local windowMs = windowSec * 1000
local minScore = now - windowMs

-- Xoá các request cũ hơn window
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, minScore)

-- Đếm số request hiện tại trong window
local current = redis.call("ZCARD", KEYS[1])

if current >= limit then
  -- Lấy request cũ nhất để tính TTL còn lại
  local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  local oldestScore = tonumber(oldest[2]) or now
  local ttlMs = windowMs - (now - oldestScore)
  if ttlMs < 0 then ttlMs = 0 end
  return {0, math.floor(ttlMs / 1000), current}
end

-- Thêm request mới
redis.call("ZADD", KEYS[1], now, now)
redis.call("PEXPIRE", KEYS[1], windowMs)

local newCount = current + 1
local ttl = redis.call("TTL", KEYS[1])
return {1, ttl, newCount}
`;

@Injectable()
export class RedisRateLimiterService
  implements RateLimiter, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisRateLimiterService.name);
  private client: RedisClientType | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url =
      this.configService.get<string>('REDIS_URL') ??
      `redis://${this.configService.get('REDIS_HOST') ?? 'localhost'}:${this.configService.get('REDIS_PORT') ?? 6379}`;

    this.client = createClient({ url });

    this.client.on('error', (err) => {
      this.logger.error(
        'Redis client error in RedisRateLimiterService',
        err as any,
      );
    });

    await this.client.connect();
    this.logger.log(`RedisRateLimiterService connected to ${url}`);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  async checkAndConsume(
    scope: string,
    key: string,
    windowSec: number,
    maxRequests: number,
  ): Promise<RateLimiterCheckResult> {
    const now = Date.now();

    if (!this.client) {
      // Fallback: allow all if Redis not ready
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + windowSec * 1000,
      };
    }

    const redisKey = `${scope}:${key}`;

    try {
      const raw = (await this.client.eval(LUA_SLIDING_WINDOW, {
        keys: [redisKey],
        arguments: [String(windowSec), String(maxRequests), String(now)],
      })) as [number, number, number];

      const allowedFlag = raw?.[0] ?? 1;
      const ttl = raw?.[1] ?? windowSec;
      const current = raw?.[2] ?? 0;

      const allowed = allowedFlag === 1;
      const remaining = Math.max(0, maxRequests - current);
      const resetAt = now + ttl * 1000;

      return { allowed, remaining, resetAt };
    } catch (err) {
      this.logger.error('Error executing Redis rate limit script', err as any);
      // Nếu Redis lỗi, tránh chặn user: cho phép request
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + windowSec * 1000,
      };
    }
  }
}
