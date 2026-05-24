// =============================================================================
// POST /api/invites/[token]/accept — public (no auth) invite acceptance.
//
// Body: { password: string; fullName?: string }
//
// Creates the auth.users row (via service-role admin.createUser, email_confirm:
// true, password set from the body), which fires the 0017 trigger to insert
// the public.users row, which fires the 0088 trigger to grant CLIENT_OWNER_
// DEFAULTS when the user is the FIRST client-role user of their workspace.
// Marks the invite consumed_at + status='accepted'.
//
// Returns { ok: true, email, redirectTo } on success — the page then signs
// the user in client-side via supabase.auth.signInWithPassword and routes
// to /dashboard.
//
// Rate-limited via the same DB-backed limiter as /api/sign-up — 10 attempts
// / IP / hour. Set high because legitimate users misclick passwords (one
// invite, a few retries before the password sticks); the cap is for
// brute-force defence against the token endpoint, not to penalise users.
// =============================================================================

import { NextResponse } from 'next/server';

import { isAppError, normalizeError } from '@/lib/errors';
import { acceptInvite } from '@/lib/invites/server';
import { checkAndRecord } from '@/lib/rate-limit';

type Body = {
  password?: unknown;
  fullName?: unknown;
};

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: 'invite-not-found' }, { status: 404 });
  }

  // Rate-limit per IP. Same limiter as /api/sign-up — reuses the
  // signup_attempt key so a single IP can't pivot between routes to evade
  // the cap (the limiter is keyed on the family, not the path).
  const ip = callerIp(request);
  const decision = await checkAndRecord('signup_attempt', { key: ip, ip });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'rate-limited', detail: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName : undefined;

  try {
    const result = await acceptInvite({ token, password, fullName });
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) {
      const status =
        error.kind === 'not_found'
          ? 404
          : error.kind === 'validation'
            ? 400
            : error.kind === 'conflict'
              ? 409
              : 500;
      return NextResponse.json({ error: error.message, kind: error.kind }, { status });
    }
    const fallback = normalizeError(error);
    console.error('[invite-accept] unexpected:', fallback.message);
    return NextResponse.json({ error: fallback.message }, { status: 500 });
  }
}
