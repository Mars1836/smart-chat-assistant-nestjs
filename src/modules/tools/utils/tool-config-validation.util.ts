import { BadRequestException } from '@nestjs/common';
import { assertSafeOutboundUrl } from './ssrf-protection.util';

function collectCandidateUrls(value: any, results: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      results.push(value);
    }
    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCandidateUrls(item, results);
    }
    return results;
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (
        typeof nestedValue === 'string' &&
        /^https?:\/\//i.test(nestedValue) &&
        /(url|uri|endpoint|base_url|baseUrl|webhook|host)/i.test(key)
      ) {
        results.push(nestedValue);
      } else {
        collectCandidateUrls(nestedValue, results);
      }
    }
  }

  return results;
}

export async function validateNoPrivateOutboundUrls(
  config: Record<string, any> | null | undefined,
  contextLabel: string,
): Promise<void> {
  if (!config) return;

  const candidates = Array.from(new Set(collectCandidateUrls(config)));
  for (const candidate of candidates) {
    try {
      await assertSafeOutboundUrl(candidate);
    } catch (error: any) {
      throw new BadRequestException(
        `${contextLabel} contains a blocked outbound URL: ${candidate}. ${error.message}`,
      );
    }
  }
}
