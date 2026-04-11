import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  /**
   * Bearer header (API thường) hoặc `?access_token=` / `?token=` (SSE/EventSource không gửi được header).
   */
  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) return token;
    }

    const q = request.query as Record<string, string | string[] | undefined>;
    const fromQuery = q?.access_token ?? q?.token;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) {
      return fromQuery;
    }
    if (Array.isArray(fromQuery) && fromQuery[0]) {
      return fromQuery[0];
    }

    return undefined;
  }
}
