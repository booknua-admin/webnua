// =============================================================================
// POST /api/sign-up/request-code — conversational onboarding (Session B).
//
// Body: { email }
//
// Flow:
//   1. Validate email shape + reject disposable domains.
//   2. Per-IP rate limit (signup_attempt: 10/IP/hour) — the outer guard,
//      shared with /api/sign-up (legacy) so an attacker can't pivot.
//   3. Per-email rate limit (verification_code_request: 3/email/hour).
//   4. Generate a 6-digit code via crypto.randomInt — uniformly distributed,
//      not predictable.
//   5. Mark any prior active codes for this email consumed.
//   6. Insert the new code (hashed) with 10-min expiry.
//   7. Send the verification-code email with a 30s timeout. On timeout,
//      silently fall back to the magic-link path:
//        - we'd need an auth user for the magic link, but the user has not
//          yet provisioned (they're still in turn-1 / turn-2 of the chat),
//        - so the fallback message just tells them to retry in a minute.
//        Future hardening: pre-provision an unconfirmed user here too, but
//        that requires the firstMessage (which the request-code route does
//        not have) — Session C concern.
//
// Auth: PUBLIC route (no session). Same as /api/sign-up.
// =============================================================================

import { createHash, randomInt } from 'node:crypto';

import { NextResponse } from 'next/server';

import { sendVerificationCodeEmail } from '@/lib/auth/verification-code-email';
import { isDisposableEmail } from '@/lib/email/disposable-domains';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { checkAndRecord } from '@/lib/rate-limit';

type Body = { email?: unknown };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MINUTES = 10;

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function generateCode(): string {
  // 100000..999999 inclusive — randomInt's upper bound is exclusive.
  return String(randomInt(100000, 1000000));
}

function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}`).digest('hex');
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email-invalid' }, { status: 400 });
  }
  if (email.length > 200) {
    return NextResponse.json({ error: 'email-too-long' }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: 'disposable-email' }, { status: 400 });
  }

  const ip = callerIp(request);

  // Per-IP signup_attempt — the outer guard, shared with the legacy route.
  const ipDecision = await checkAndRecord('signup_attempt', { key: ip, ip });
  if (!ipDecision.allowed) {
    return NextResponse.json(
      {
        error: 'rate-limited-ip',
        detail: ipDecision.message,
        retryAfterSeconds: ipDecision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // Per-email verification_code_request — 3/email/hour.
  const emailDecision = await checkAndRecord('verification_code_request', { key: email });
  if (!emailDecision.allowed) {
    return NextResponse.json(
      {
        error: 'rate-limited-email',
        detail: emailDecision.message,
        retryAfterSeconds: emailDecision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const db = getIntegrationDb();

  // Mark any prior active codes consumed. The verify route always reads the
  // most-recent unconsumed row, so even without this UPDATE the older codes
  // would be ignored — but explicitly consuming them keeps the audit log
  // honest (an old code that was never used reads as 'consumed' rather than
  // 'expired').
  try {
    await db
      .from('email_verification_codes')
      .update({ consumed_at: new Date().toISOString() } as never)
      .eq('email', email)
      .is('consumed_at', null);
  } catch (error) {
    console.warn('[request-code] failed to consume prior codes:', error);
  }

  const code = generateCode();
  const codeHash = hashCode(email, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error: insertError } = await db
    .from('email_verification_codes')
    .insert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    } as never);
  if (insertError) {
    console.error('[request-code] insert failed:', insertError.message);
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 });
  }

  const outcome = await sendVerificationCodeEmail({
    recipientEmail: email,
    code,
    expiresInMinutes: CODE_TTL_MINUTES,
  });

  if (outcome === 'skipped') {
    // Dev only — RESEND_API_KEY is unset. Log the code so the developer can
    // verify the flow. NEVER returned to the browser.
    console.warn(`[request-code] (dev) code for ${email}: ${code}`);
  }

  if (outcome === 'timeout') {
    return NextResponse.json({
      success: false,
      fallback: 'retry',
      message:
        "We're having trouble sending your code right now. Wait a minute and tap Resend code below.",
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  }

  if (outcome === 'failed') {
    // Real Resend error — the code IS in the DB, but no email was delivered.
    // Tell the user honestly.
    return NextResponse.json({
      success: false,
      fallback: 'retry',
      message:
        'We could not send your code. Wait a minute and tap Resend code below.',
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  }

  return NextResponse.json({
    success: true,
    expiresInMinutes: CODE_TTL_MINUTES,
    emailOutcome: outcome,
  });
}
