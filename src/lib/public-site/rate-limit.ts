// =============================================================================
// In-memory rate limiter — for the public form endpoints.
//
// Fixed-window counter keyed by IP, held in a module-scope Map. This is
// BEST-EFFORT: on a serverless host the Map is per-instance and per-warm-
// lifetime, so a determined attacker hitting many instances is not fully
// stopped. It does blunt a single client hammering one instance, with zero
// dependencies. A durable limit (Upstash/Redis) is the real fix if abuse
// becomes a problem.
// =============================================================================

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Returns true if the call is allowed, false if the key is over its limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic prune so the Map can't grow unbounded.
  if (windows.size > 2000) {
    for (const [k, w] of windows) {
      if (now >= w.resetAt) windows.delete(k);
    }
  }

  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Best-effort client IP from the standard proxy headers. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
