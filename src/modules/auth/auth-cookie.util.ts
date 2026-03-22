import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { parseExpiresToMs } from './auth-time.util';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/auth';

function baseCookieOptions(configService: ConfigService): Pick<
  CookieOptions,
  'httpOnly' | 'secure' | 'sameSite' | 'path' | 'domain'
> {
  const secure =
    configService.get<string>('NODE_ENV') === 'production' ||
    configService.get<string>('REFRESH_COOKIE_SECURE') === 'true';
  const sameSiteEnv = configService.get<string>('REFRESH_COOKIE_SAMESITE');
  let sameSite: CookieOptions['sameSite'] = secure ? 'none' : 'lax';
  if (
    sameSiteEnv === 'none' ||
    sameSiteEnv === 'lax' ||
    sameSiteEnv === 'strict'
  ) {
    sameSite = sameSiteEnv;
  }
  const domain = configService.get<string>('REFRESH_COOKIE_DOMAIN');
  const finalSecure = sameSite === 'none' ? true : secure;
  return {
    httpOnly: true,
    secure: finalSecure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
    ...(domain ? { domain } : {}),
  };
}

export function getRefreshCookieSetOptions(
  configService: ConfigService,
): CookieOptions {
  const maxAge = parseExpiresToMs(
    configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN') ?? '7d',
  );
  return {
    ...baseCookieOptions(configService),
    maxAge,
  };
}

/** Options passed to `clearCookie` must match set options (path/domain). */
export function getRefreshCookieClearOptions(
  configService: ConfigService,
): CookieOptions {
  return baseCookieOptions(configService);
}
