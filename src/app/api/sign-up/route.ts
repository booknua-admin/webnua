// =============================================================================
// POST /api/sign-up — Pattern B: free signup, verify email, build a preview.
//
// Architectural shift from Session 1 (Pattern A): Stripe Checkout is GONE
// from this endpoint. The flow now is:
//
//   1. Validate the captured signup (business name + email + category).
//   2. Refuse disposable-email domains (mailinator, tempmail, etc.).
//   3. IP rate-limit (10 attempts/IP/hour; 3 successes/IP/24h) via the
//      DB-backed rate_limit_hits table (migration 0085).
//   4. Refuse a re-signup whose email already has an auth.users row.
//   5. `provisionPendingSignup` — inserts the clients row with
//      lifecycle_status='pending_verification', creates the unconfirmed auth
//      user, generates the magic link. The clients row's AFTER INSERT
//      triggers fan templates + automations.
//   6. Send the verification email (Resend platform send) with the magic
//      link.
//   7. Respond with the "check your email" success state — the form swaps
//      to a check-your-email screen.
//
// The recipient clicks the magic link → Supabase confirms the email + sets
// a session → the migration 0085 trigger advances the client from
// 'pending_verification' to 'preview' → user lands on /dashboard which
// mounts the IntegrationOnboarding wizard for the 'preview' state.
//
// Stripe Checkout fires from the dashboard's "Publish to go live" CTA in
// a SEPARATE moment — handled by the existing /api/integrations/stripe/checkout
// route (widened to requireClientAccess in Session 1). When that subscription
// payment succeeds, the webhook calls `markClientActiveOnPublish` which
// flips the client from 'preview' → 'active'.
//
// SERVER-ONLY (route handler).
// =============================================================================

import { NextResponse } from 'next/server';

import { provisionPendingSignup, emailAlreadyRegistered } from '@/lib/auth/signup-workspace';
import { sendVerificationEmail } from '@/lib/auth/verification-email';
import { isDisposableEmail } from '@/lib/email/disposable-domains';
import { checkAndRecord } from '@/lib/rate-limit';

// --- input shape -------------------------------------------------------------

type SignupBody = {
  businessName?: unknown;
  businessEmail?: unknown;
  businessCategory?: unknown;
};

type Validated = {
  businessName: string;
  businessEmail: string;
  businessCategory: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body: SignupBody): { ok: true; data: Validated } | { ok: false; error: string } {
  const name = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const email = typeof body.businessEmail === 'string' ? body.businessEmail.trim().toLowerCase() : '';
  const category = typeof body.businessCategory === 'string' ? body.businessCategory.trim() : '';

  if (name.length < 2) return { ok: false, error: 'business-name-required' };
  if (name.length > 80) return { ok: false, error: 'business-name-too-long' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'business-email-invalid' };
  if (email.length > 200) return { ok: false, error: 'business-email-too-long' };
  if (category.length < 2) return { ok: false, error: 'business-category-required' };
  if (category.length > 120) return { ok: false, error: 'business-category-too-long' };

  return { ok: true, data: { businessName: name, businessEmail: email, businessCategory: category } };
}

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// --- route -------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const validation = validate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { businessName, businessEmail, businessCategory } = validation.data;

  const ip = callerIp(request);

  // --- 1. signup_attempt rate limit (counts EVERY attempt) ---
  //
  // The attempt-limit (10/IP/hour) fires before any other guard. Failed
  // validations don't count (we already returned 400 above); the limit
  // counts attempts that reached this point AND every later failure mode.
  const attemptDecision = await checkAndRecord('signup_attempt', { key: ip, ip });
  if (!attemptDecision.allowed) {
    return NextResponse.json(
      {
        error: 'rate-limited-attempt',
        detail: attemptDecision.message,
        retryAfterSeconds: attemptDecision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // --- 2. disposable email check ---
  if (isDisposableEmail(businessEmail)) {
    return NextResponse.json({ error: 'disposable-email' }, { status: 400 });
  }

  // --- 3. duplicate email check ---
  //
  // Refuse a re-signup BEFORE inserting any DB rows. Without this guard the
  // auth.admin.createUser call would 422 with a duplicate-email error,
  // leaving an orphan clients row behind.
  if (await emailAlreadyRegistered(businessEmail)) {
    return NextResponse.json({ error: 'email-already-registered' }, { status: 409 });
  }

  // --- 4. signup_success rate limit (counts successful workspace creates) ---
  //
  // We check BEFORE provisioning so a blocked attempt doesn't leak through
  // as a half-created workspace. The narrower limit (3/IP/24h) catches
  // sustained signup abuse the attempt-limit would let through.
  const successDecision = await checkAndRecord('signup_success', { key: ip, ip });
  if (!successDecision.allowed) {
    return NextResponse.json(
      {
        error: 'rate-limited-success',
        detail: successDecision.message,
        retryAfterSeconds: successDecision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // --- 5. provision the pending workspace + auth user + magic link ---
  let result: Awaited<ReturnType<typeof provisionPendingSignup>>;
  try {
    result = await provisionPendingSignup({
      businessName,
      businessEmail,
      businessCategory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sign-up] provisionPendingSignup failed', message);
    return NextResponse.json(
      { error: 'provision-failed', detail: message },
      { status: 500 },
    );
  }

  // --- 6. send the verification email ---
  //
  // The send is best-effort — if Resend fails OR the API key is unset, the
  // workspace still exists. We surface the outcome on the response so the
  // form can decide whether to recommend the user check their inbox or
  // contact support. The 'skipped' state is dev-mode (no Resend key) and
  // looks like 'sent' to the user (they should still try checking their
  // email in case the SMTP fallback worked).
  const emailOutcome = await sendVerificationEmail({
    recipientEmail: businessEmail,
    businessName,
    magicLink: result.magicLink,
  });

  return NextResponse.json({
    ok: true,
    emailOutcome,
    clientSlug: result.clientSlug,
    // The magic link is NEVER returned to the public browser — only via the
    // Resend send above. A client losing their email today re-runs signup
    // (with a fresh email or after the 7-day pending-verification sweep).
  });
}
