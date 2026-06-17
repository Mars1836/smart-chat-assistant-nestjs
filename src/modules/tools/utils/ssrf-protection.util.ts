import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

const MAX_REDIRECTS = 3;

function ipv4ToNumber(ip: string): number {
  return ip
    .split('.')
    .map((part) => Number(part))
    .reduce((acc, octet) => (acc << 8) + octet, 0);
}

function isIpv4InCidr(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(base) & mask);
}

function isBlockedIpv4(ip: string): boolean {
  const blockedRanges: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
  ];

  return blockedRanges.some(([base, prefix]) => isIpv4InCidr(ip, base, prefix));
}

function normalizeIpv6(ip: string): string {
  const lower = ip.toLowerCase();
  const zoneIndex = lower.indexOf('%');
  return zoneIndex >= 0 ? lower.slice(0, zoneIndex) : lower;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = normalizeIpv6(ip);

  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe90:') ||
    normalized.startsWith('fea0:') ||
    normalized.startsWith('feb0:')
  ) {
    return true;
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length);
    return isIP(mappedIpv4) === 4 && isBlockedIpv4(mappedIpv4);
  }

  return false;
}

function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

async function assertResolvableToPublicIp(hostname: string): Promise<void> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new BadRequestException(`Host "${hostname}" could not be resolved`);
  }

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      throw new BadRequestException(
        `Blocked outbound request to private or loopback address (${record.address})`,
      );
    }
  }
}

export async function assertSafeOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid outbound URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException(
      'Only http and https outbound URLs are allowed',
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BadRequestException(
      `Blocked outbound request to hostname "${hostname}"`,
    );
  }

  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new BadRequestException(
        `Blocked outbound request to private or loopback address (${hostname})`,
      );
    }
    return parsed;
  }

  await assertResolvableToPublicIp(hostname);
  return parsed;
}

export async function safeFetchWithSsrfProtection(
  rawUrl: string,
  init: RequestInit = {},
  redirectCount = 0,
): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new BadRequestException('Too many outbound redirects');
  }

  const parsedUrl = await assertSafeOutboundUrl(rawUrl);
  const response = await fetch(parsedUrl.toString(), {
    ...init,
    redirect: 'manual',
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has('location')
  ) {
    const nextUrl = new URL(
      response.headers.get('location') as string,
      parsedUrl,
    ).toString();

    return safeFetchWithSsrfProtection(nextUrl, init, redirectCount + 1);
  }

  return response;
}
