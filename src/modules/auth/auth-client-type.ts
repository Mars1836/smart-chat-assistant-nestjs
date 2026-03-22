import type { Request } from 'express';

export const AUTH_CLIENT_HEADER = 'x-client-type';

export type AuthClientType = 'web' | 'mobile';

export function isAuthClientType(s: string | undefined): s is AuthClientType {
  return s === 'web' || s === 'mobile';
}

/**
 * Header X-Client-Type wins over body `client_type`. Defaults to `web`.
 */
export function resolveAuthClientType(
  req: Request,
  bodyClient?: string,
): AuthClientType {
  const rawHeader = req.headers[AUTH_CLIENT_HEADER];
  const header =
    typeof rawHeader === 'string'
      ? rawHeader
      : Array.isArray(rawHeader)
        ? rawHeader[0]
        : undefined;
  const h = header?.toLowerCase()?.trim();
  if (h === 'web' || h === 'mobile') return h;
  const b = bodyClient?.toLowerCase()?.trim();
  if (b === 'web' || b === 'mobile') return b;
  return 'web';
}
