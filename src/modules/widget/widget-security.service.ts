import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { ChatbotWidgetConfig, ChatbotWidgetSecurityConfig } from './widget-security.types';
import { RedisRateLimiterService } from '../../common/rate-limiter/redis-rate-limiter.service';

@Injectable()
export class WidgetSecurityService {
  constructor(
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    private readonly rateLimiter: RedisRateLimiterService,
  ) {}

  async validateRequestAndGetChatbot(
    req: Request,
    chatbotId: string,
  ): Promise<{
    chatbot: Chatbot;
    widgetConfig: ChatbotWidgetConfig;
    rateLimited: boolean;
  }> {
    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId },
    });

    if (!chatbot || !chatbot.enabled) {
      throw new ForbiddenException('Chatbot not found or disabled');
    }

    const rawConfig = (chatbot.widget_config ?? {}) as Partial<ChatbotWidgetConfig>;
    const widgetConfig: ChatbotWidgetConfig = {
      ui: rawConfig.ui ?? null,
      security: this.normalizeSecurityConfig(rawConfig.security),
    };

    const { origin, originHostname } = this.extractOrigin(req);
    const ip = this.extractIp(req);
    const apiKey = this.extractApiKey(req);

    this.checkWhitelist(widgetConfig.security, origin, originHostname, ip);
    this.checkApiKey(widgetConfig.security, apiKey);
    const rateOk = await this.checkRateLimit(
      widgetConfig.security,
      chatbot.id,
      {
        origin: originHostname,
        ip,
        apiKey,
      },
    );

    return { chatbot, widgetConfig, rateLimited: !rateOk };
  }

  private normalizeSecurityConfig(
    security?: Partial<ChatbotWidgetSecurityConfig> | null,
  ): ChatbotWidgetSecurityConfig {
    const base: ChatbotWidgetSecurityConfig = {
      enabled: true,
      allowed_origins: [],
      allowed_ips: null,
      public_api_key: null,
      rate_limit_window_sec: 60,
      rate_limit_max_requests: 30,
    };

    if (!security) {
      return base;
    }

    return {
      ...base,
      ...security,
      allowed_origins: security.allowed_origins ?? base.allowed_origins,
      allowed_ips: security.allowed_ips ?? base.allowed_ips,
      rate_limit_window_sec:
        security.rate_limit_window_sec ?? base.rate_limit_window_sec,
      rate_limit_max_requests:
        security.rate_limit_max_requests ?? base.rate_limit_max_requests,
    };
  }

  private extractOrigin(req: Request): { origin: string | null; originHostname: string | null } {
    const originHeader = (req.headers['origin'] ??
      req.headers['referer'] ??
      null) as string | null;
    if (!originHeader) {
      return { origin: null, originHostname: null };
    }

    try {
      const url = new URL(originHeader);
      return { origin: url.origin, originHostname: url.hostname };
    } catch {
      return { origin: null, originHostname: null };
    }
  }

  private extractIp(req: Request): string | null {
    const forwarded = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (forwarded && forwarded.length > 0) {
      return forwarded[0];
    }
    return (req.ip as string) ?? null;
  }

  private extractApiKey(req: Request): string | null {
    const header = req.headers['x-widget-key'];
    if (!header) return null;
    if (Array.isArray(header)) {
      return header[0] ?? null;
    }
    return header;
  }

  private checkWhitelist(
    security: ChatbotWidgetSecurityConfig,
    origin: string | null,
    originHostname: string | null,
    ip: string | null,
  ) {
    if (!security.enabled) {
      throw new ForbiddenException('Widget is disabled');
    }

    if (security.allowed_origins && security.allowed_origins.length > 0) {
      if (!origin || !originHostname) {
        throw new ForbiddenException('Origin is not allowed');
      }

      const ok = security.allowed_origins.some((pattern) =>
        this.isAllowedOrigin(origin, originHostname, pattern),
      );
      if (!ok) {
        throw new ForbiddenException('Origin is not allowed');
      }
    }

    if (security.allowed_ips && security.allowed_ips.length > 0) {
      if (!ip) {
        throw new ForbiddenException('IP is not allowed');
      }

      const ok = security.allowed_ips.some((allowedIp) => allowedIp === ip);
      if (!ok) {
        throw new ForbiddenException('IP is not allowed');
      }
    }
  }

  private isAllowedOrigin(
    origin: string,
    hostname: string,
    pattern: string,
  ): boolean {
    if (!pattern) return false;

    // Full origin match
    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      // Wildcard in host: https://*.mydomain.com
      try {
        const url = new URL(pattern.replace('*.', 'PLACEHOLDER.'));
        const hostPattern = url.hostname;
        if (hostPattern.includes('PLACEHOLDER')) {
          const regex = new RegExp(
            '^' +
              hostPattern
                .replace('PLACEHOLDER', '[^.]+')
                .split('.')
                .map((p) => p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&'))
                .join('\\.') +
              '$',
          );
          return regex.test(hostname) && origin.startsWith(url.protocol);
        }

        return origin === `${url.protocol}//${url.host}`;
      } catch {
        return false;
      }
    }

    // Hostname-only patterns, support wildcard: *.mydomain.com
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".mydomain.com"
      return hostname.endsWith(suffix) && hostname.split('.').length > 2;
    }

    // Exact hostname
    return hostname === pattern;
  }

  private checkApiKey(
    security: ChatbotWidgetSecurityConfig,
    apiKey: string | null,
  ) {
    if (!security.public_api_key) return;

    if (!apiKey || apiKey !== security.public_api_key) {
      throw new UnauthorizedException('Invalid widget API key');
    }
  }

  private async checkRateLimit(
    security: ChatbotWidgetSecurityConfig,
    chatbotId: string,
    ctx: { ip: string | null; origin: string | null; apiKey: string | null },
  ): Promise<boolean> {
    const key = this.getRateKey(ctx);
    const bucketKey = `widget:${chatbotId}:${key}`;

    const result = await this.rateLimiter.checkAndConsume(
      'rl',
      bucketKey,
      security.rate_limit_window_sec,
      security.rate_limit_max_requests,
    );

    if (!result.allowed) {
      return false;
    }

    return true;
  }

  private getRateKey(ctx: {
    ip: string | null;
    origin: string | null;
    apiKey: string | null;
  }): string {
    // Đơn giản hóa: chỉ rate limit theo IP
    return ctx.ip ?? 'unknown-ip';
  }
}

