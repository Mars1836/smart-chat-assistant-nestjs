import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { parseExpiresToMs } from './auth-time.util';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/auth';

/**
 * Refresh cookie: FE và BE khác domain (cross-site) cần SameSite=None + Secure
 * (trình duyệt mới gửi cookie kèp request cross-origin có credentials).
 *
 * Cấu hình: đặt REFRESH_COOKIE_CROSS_SITE=true hoặc REFRESH_COOKIE_SAMESITE=none
 * (kèm HTTPS / REFRESH_COOKIE_SECURE=true nếu không phải production).
 */
function baseCookieOptions(configService: ConfigService): Pick<
  CookieOptions,
  'httpOnly' | 'secure' | 'sameSite' | 'path' | 'domain'
> {
  const explicit = configService.get<string>('REFRESH_COOKIE_SAMESITE');
  const crossSite =
    configService.get<string>('REFRESH_COOKIE_CROSS_SITE') === 'true';

  let sameSite: CookieOptions['sameSite'] = 'lax';
  if (explicit === 'none' || explicit === 'lax' || explicit === 'strict') {
    sameSite = explicit;
  } else if (crossSite) {
    // FE / BE khác site: bắt buộc None để trình duyệt gửi cookie (fetch credentials)
    sameSite = 'none';
  } else {
    const treatAsProd =
      configService.get<string>('NODE_ENV') === 'production' ||
      configService.get<string>('REFRESH_COOKIE_SECURE') === 'true';
    sameSite = treatAsProd ? 'none' : 'lax';
  }

  const secureBase =
    configService.get<string>('NODE_ENV') === 'production' ||
    configService.get<string>('REFRESH_COOKIE_SECURE') === 'true';

  // SameSite=None bắt buộc Secure (HTTPS); không thì trình duyệt bỏ qua cookie
  const finalSecure = sameSite === 'none' ? true : secureBase;

  const domain = configService.get<string>('REFRESH_COOKIE_DOMAIN');
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
