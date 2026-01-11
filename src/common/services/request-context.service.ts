import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getUserId(): string | null {
    const user = this.request['user'] as { sub?: string } | undefined;
    return user?.sub || null;
  }
}
