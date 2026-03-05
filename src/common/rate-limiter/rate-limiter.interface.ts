export interface RateLimiterCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  checkAndConsume(
    scope: string,
    key: string,
    windowSec: number,
    maxRequests: number,
  ): Promise<RateLimiterCheckResult>;
}

