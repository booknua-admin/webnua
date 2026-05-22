// =============================================================================
// POST /api/internal/job-executor — runs one integration job.
//
// Phase 7 Session 1. Called by two dispatchers:
//   • the pg_cron poller (migration 0049 — every minute, due jobs);
//   • enqueueJobImmediate (fire-and-forget self-POST, for near-instant runs).
// Both POST { jobId } with the shared-secret header. runJob's atomic claim
// makes the two paths race-safe — exactly one claims a given job.
//
// Internal-only: the request must carry the x-webnua-internal-secret header
// matching the INTERNAL_JOB_SECRET env var (compared in constant time). With
// no secret configured the route refuses every request (503) — it cannot
// authenticate a caller, so it must not run jobs.
//
// The job-handler manifest is imported for its side effects: it registers
// every integration's handlers so runJob can find one for the job's type.
// =============================================================================

import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { runJob } from '@/lib/integrations/_shared/jobs';
import '@/lib/integrations/job-handler-manifest';

// Job handlers may make slow external calls — give the function room.
export const maxDuration = 300;

/** Constant-time string compare — avoids leaking the secret via timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const secret = env.INTERNAL_JOB_SECRET;
  if (!secret) {
    // Cannot authenticate callers — refuse rather than run jobs unguarded.
    return NextResponse.json({ error: 'job-executor-not-configured' }, { status: 503 });
  }

  const provided = request.headers.get('x-webnua-internal-secret') ?? '';
  if (!secretsMatch(provided, secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let body: { jobId?: unknown };
  try {
    body = (await request.json()) as { jobId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (typeof body.jobId !== 'string' || body.jobId.length === 0) {
    return NextResponse.json({ error: 'missing-jobId' }, { status: 400 });
  }

  try {
    const outcome = await runJob(body.jobId);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    console.error('[job-executor] runJob threw', error);
    return NextResponse.json({ ok: false, error: 'executor-failed' }, { status: 500 });
  }
}
