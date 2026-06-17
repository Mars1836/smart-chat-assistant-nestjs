/**
 * Parses JWT-style expires strings used by this app (e.g. `15m`, `7d`).
 */
export function parseExpiresToMs(expiresIn: string): number {
  const s = expiresIn.trim();
  const m = /^(\d+)([smhd])$/i.exec(s);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * (multipliers[u] ?? 86_400_000);
}
