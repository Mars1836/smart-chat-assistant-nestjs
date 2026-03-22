export function maskSecret(value: string): string {
  const v = String(value);
  if (!v) return '****';

  // Common prefixes like sk_, pk_, etc.
  const last4 = v.slice(-4);
  if (v.length <= 8) return `****${last4}`;

  // Preserve prefix up to first underscore/dash if present
  const m = v.match(/^([a-zA-Z]{2,4}[_-])/);
  if (m) {
    return `${m[1]}****${last4}`;
  }

  return `****${last4}`;
}

/**
 * Mask api key inside workspace tool config_override.
 * - keeps other fields
 * - replaces api_key with { configured: true, masked: "..." }
 */
export function maskApiKeyInConfigOverride(
  configOverride: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (!configOverride) return configOverride ?? null;

  const cloned: Record<string, any> = { ...configOverride };
  const raw = cloned.api_key;

  const keyValue =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw.value === 'string'
        ? raw.value
        : undefined;

  if (!keyValue) return cloned;

  cloned.api_key = {
    configured: true,
    masked: maskSecret(keyValue),
  };

  return cloned;
}

/**
 * Remove plaintext api_key.value from tool.auth_config for api_key tools.
 * This prevents leaking system keys (stored in env) via tool list endpoints.
 */
export function sanitizeToolAuthConfig(authConfig: any): any {
  if (!authConfig) return authConfig;
  if (authConfig.type !== 'api_key') return authConfig;

  const cloned = { ...authConfig };
  if (cloned.api_key && typeof cloned.api_key === 'object') {
    const apiKey = { ...cloned.api_key };
    if (apiKey.value !== undefined) {
      // Add flag to indicate key is pre-configured (e.g. via seed/env)
      apiKey.is_set = true;
      delete apiKey.value;
    } else {
      apiKey.is_set = false;
    }
    cloned.api_key = apiKey;
  }
  return cloned;
}

