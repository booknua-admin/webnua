// =============================================================================
// Rate limiter — DB-backed, generic over (action, key, window, limit).
//
// Backs every Pattern B quota:
//   • signup_attempt    {ip}        10/IP/hour
//   • signup_success    {ip}         3/IP/24h
//   • ai_site_gen       {client_id}  3/client/24h
//   • ai_funnel_gen     {client_id}  3/client/24h
//   • ai_section_regen  {client_id} 10/client/hour
//
// Storage is `public.rate_limit_hits` (migration 0085) — one append-only row
// per attempt. The 0086 cron deletes rows older than 7 days. The query shape
// (count rows in a sliding window) is covered by the composite index on
// (action, key, occurred_at desc).
//
// SERVER-ONLY — uses the service-role Supabase client to bypass RLS. Never
// import from client code.
//
// API DISCIPLINE
//   • `checkAndRecord` performs the count, records the attempt, and returns
//     the decision in one call. Atomic-enough for V1: the count + record
//     happens across two round-trips, so a perfectly-timed burst can
//     overshoot by a small margin. Acceptable — the limits are
//     soft (5 instead of 3 over 24h is fine; 10 instead of 3 is not, but
//     that requires sustained burst that the IP layer would catch).
//   • The function NEVER throws on a DB failure — a Supabase outage falls
//     back to `{ allowed: true }` (fail-open). Rate limiting is a guardrail,
//     not a critical-path block; a 5-minute Supabase blip must not break
//     signup or AI generation for legitimate users.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export type RateLimitAction =
  | 'signup_attempt'
  | 'signup_success'
  | 'ai_site_gen'
  | 'ai_funnel_gen'
  | 'ai_section_regen'
  | 'verification_code_request'
  | 'verification_code_attempt';

/** A rate-limit configuration: count this many of this action's key per
 *  windowSeconds. The same `action` always uses the same window in the
 *  app; this is bundled as `RATE_LIMITS` below so each call site picks the
 *  named config. */
export type RateLimitConfig = {
  action: RateLimitAction;
  /** Sliding-window length in seconds. */
  windowSeconds: number;
  /** Inclusive cap — `limit` attempts in `windowSeconds` is allowed, the
   *  `(limit + 1)`th in that window is blocked. */
  limit: number;
  /** Human-friendly window label for the error message (e.g. "hour"). */
  windowLabel: string;
};

/** The canonical Pattern B limits — referenced by name everywhere. Change
 *  here, not at call sites. The values are the brief's locked numbers. */
export const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  signup_attempt: {
    action: 'signup_attempt',
    windowSeconds: 60 * 60, // 1 hour
    limit: 10,
    windowLabel: 'hour',
  },
  signup_success: {
    action: 'signup_success',
    windowSeconds: 24 * 60 * 60, // 24 hours
    limit: 3,
    windowLabel: '24 hours',
  },
  ai_site_gen: {
    action: 'ai_site_gen',
    windowSeconds: 24 * 60 * 60,
    limit: 3,
    windowLabel: '24 hours',
  },
  ai_funnel_gen: {
    action: 'ai_funnel_gen',
    windowSeconds: 24 * 60 * 60,
    limit: 3,
    windowLabel: '24 hours',
  },
  ai_section_regen: {
    action: 'ai_section_regen',
    windowSeconds: 60 * 60,
    limit: 10,
    windowLabel: 'hour',
  },
  // Conversational onboarding — code verification (Session B).
  // Per-EMAIL keys (not per-IP). The existing signup_attempt per-IP limit
  // still applies on the /api/sign-up/request-code route as the outer guard.
  verification_code_request: {
    action: 'verification_code_request',
    windowSeconds: 60 * 60,
    limit: 3,
    windowLabel: 'hour',
  },
  verification_code_attempt: {
    action: 'verification_code_attempt',
    windowSeconds: 15 * 60,
    limit: 5,
    windowLabel: '15 minutes',
  },
};

export type RateLimitDecision =
  | {
      allowed: true;
      remaining: number;
      windowLabel: string;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      windowLabel: string;
      limit: number;
      message: string;
    };

type CheckOptions = {
  /** Per-action key — IP for signup limits, client UUID for AI-gen limits. */
  key: string;
  /** Optional: stamp the row with a client_id so a client-deletion CASCADE
   *  clears their hits. Set for AI-gen actions; omitted for signup actions
   *  (no client exists yet on signup_attempt). */
  clientId?: string | null;
  /** Optional: the caller IP, stored on the row for operator audit. Set on
   *  signup actions; null for AI-gen (the client is the unit, not the IP). */
  ip?: string | null;
};

/**
 * Count attempts in the sliding window AND record this attempt.
 *
 * On the count `limit` reached, the function:
 *   • returns `{ allowed: false, retryAfterSeconds, message, … }`
 *   • records the attempt with `status='blocked'` + a `reason` for the
 *     operator audit dashboard.
 * Otherwise:
 *   • returns `{ allowed: true, remaining }`
 *   • records the attempt with `status='ok'`.
 */
export async function checkAndRecord(
  action: RateLimitAction,
  options: CheckOptions,
): Promise<RateLimitDecision> {
  const config = RATE_LIMITS[action];
  const since = new Date(Date.now() - config.windowSeconds * 1000).toISOString();

  let count = 0;
  let oldestInWindow: string | null = null;
  try {
    const db = getIntegrationDb();
    // ONE round-trip: PostgREST's `count: 'exact'` populates `count` on the
    // response envelope. We order ASC + limit(1) so the data array carries
    // the oldest-in-window row (used to compute retryAfter when blocked).
    const { data, count: exactCount, error } = await db
      .from('rate_limit_hits')
      .select('occurred_at', { count: 'exact' })
      .eq('action', action)
      .eq('key', options.key)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: true })
      .limit(1);
    if (error) {
      console.warn(`[rate-limit] check failed for ${action}/${options.key}:`, error.message);
      return { allowed: true, remaining: config.limit, windowLabel: config.windowLabel };
    }
    count = typeof exactCount === 'number' ? exactCount : 0;
    oldestInWindow =
      (data as unknown as { occurred_at: string }[] | null)?.[0]?.occurred_at ?? null;
  } catch (error) {
    console.warn(`[rate-limit] check threw for ${action}/${options.key}:`, error);
    return { allowed: true, remaining: config.limit, windowLabel: config.windowLabel };
  }

  const allowed = count < config.limit;

  // Record the attempt — fire-and-forget but awaited so the row is written
  // before the route returns. A write failure is logged and the decision
  // stands (we already computed it).
  try {
    const db = getIntegrationDb();
    await db.from('rate_limit_hits').insert({
      action,
      key: options.key,
      client_id: options.clientId ?? null,
      ip: options.ip ?? null,
      status: allowed ? 'ok' : 'blocked',
      reason: allowed ? null : `Limit ${config.limit}/${config.windowLabel} reached`,
    });
  } catch (error) {
    console.warn(`[rate-limit] insert failed for ${action}/${options.key}:`, error);
  }

  if (allowed) {
    return {
      allowed: true,
      remaining: Math.max(0, config.limit - count - 1),
      windowLabel: config.windowLabel,
    };
  }

  // Bucket free-up time: the oldest-in-window row's age subtracted from the
  // window length gives the seconds until that row exits the window. Falls
  // back to the full window length if we couldn't read it.
  let retryAfterSeconds = config.windowSeconds;
  if (oldestInWindow) {
    const oldestMs = Date.parse(oldestInWindow);
    if (Number.isFinite(oldestMs)) {
      const elapsed = (Date.now() - oldestMs) / 1000;
      retryAfterSeconds = Math.max(60, Math.ceil(config.windowSeconds - elapsed));
    }
  }

  return {
    allowed: false,
    retryAfterSeconds,
    windowLabel: config.windowLabel,
    limit: config.limit,
    message: `Too many ${humanise(action)} attempts — try again in ${formatRetry(
      retryAfterSeconds,
    )}.`,
  };
}

function humanise(action: RateLimitAction): string {
  switch (action) {
    case 'signup_attempt': return 'signup';
    case 'signup_success': return 'signup';
    case 'ai_site_gen': return 'site-generation';
    case 'ai_funnel_gen': return 'funnel-generation';
    case 'ai_section_regen': return 'section-regeneration';
    case 'verification_code_request': return 'verification-code';
    case 'verification_code_attempt': return 'verification-code';
  }
}

function formatRetry(seconds: number): string {
  if (seconds < 90) return `${Math.max(60, seconds)} seconds`;
  if (seconds < 60 * 60 * 2) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}
