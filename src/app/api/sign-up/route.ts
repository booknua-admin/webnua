// =============================================================================
// POST /api/sign-up — start a self-serve Webnua signup.
//
// Locked Q2 (subscribe-before-workspace): the flow ends at Stripe Checkout,
// NOT at a workspace creation. The actual workspace is provisioned by the
// Stripe webhook AFTER `customer.subscription.created` arrives — see
// `app/api/integrations/stripe/webhook/route.ts` and
// `lib/auth/signup-workspace.ts`. This route's only job is to:
//
//   1. Validate the captured signup details (business name + email + category).
//   2. Refuse a re-signup whose email already has an auth.users row — we
//      surface a clear "already registered, sign in instead" error rather
//      than blast the webhook with a guaranteed-to-fail createUser later.
//   3. Mint a Stripe Checkout session in subscription mode with our metadata
//      (`kind=signup` + the captured details) AND the captured email pre-
//      filled. Stripe creates the Customer at Checkout completion.
//   4. Return the Checkout URL — the browser navigates to it.
//
// The route is UNAUTHENTICATED — a stranger landing on /sign-up is signed
// out. The Supabase service-role client (used by the email-precheck) and the
// Stripe API are the only writes; both run server-side only.
//
// Mild abuse protection: rate-limit by IP via a tiny in-memory window. The
// real signal — a fake signup that completes Checkout with a stolen card —
// is Stripe's own fraud layer; this just defangs trivial spamming the
// Checkout-URL mint.
// =============================================================================

import { NextResponse } from 'next/server';

import { emailAlreadyRegistered } from '@/lib/auth/signup-workspace';
import { isStripeConfigured } from '@/lib/integrations/stripe/client';

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

// --- rate limit --------------------------------------------------------------
//
// In-memory token bucket: 5 signups per IP per 10 minutes. Per-edge-instance
// only (the rate limit is best-effort; a real serverside store would be a
// later concern — Stripe's own checks are the real defence). A burst above
// this rate is almost certainly script abuse, not real product use.

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: boolean; resetAt?: number } {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { ok: false, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { ok: true };
}

function callerIp(request: Request): string {
  // X-Forwarded-For is the canonical Vercel header; fall back to the remote
  // address surrogate if for some reason the chain is empty.
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

  const rate = rateLimit(callerIp(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate-limited', retryAfter: rate.resetAt },
      { status: 429 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'stripe-not-configured' }, { status: 503 });
  }

  // Refuse a re-signup whose email already has an auth row. Without this
  // check the webhook would fail when it tries to createUser later; better
  // to fail the signup BEFORE creating a Stripe Customer + Checkout session.
  if (await emailAlreadyRegistered(businessEmail)) {
    return NextResponse.json({ error: 'email-already-registered' }, { status: 409 });
  }

  // -- mint the Checkout session --
  //
  // We do NOT create a Stripe Customer first (the operator path does, because
  // it has a clients row to attach to; we do not yet). Stripe creates the
  // Customer at Checkout completion based on the email collected on the
  // hosted page (we pre-fill it via customer_email).
  //
  // Both `metadata` (on the session) AND `subscription_data.metadata` (on
  // the subscription Stripe creates) are stamped — the webhook reads from
  // the subscription, since `customer.subscription.created` carries it
  // directly. The session's own metadata is a safety belt for the rare
  // event where we need to reconcile from the session id.
  const origin = new URL(request.url).origin;
  const session = await createSignupCheckoutSession({
    origin,
    businessName,
    businessEmail,
    businessCategory,
  });
  if (!session.ok) {
    console.error('[sign-up] Checkout session mint failed', session.error);
    return NextResponse.json(
      { error: 'stripe-checkout-failed', detail: session.error },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkoutUrl: session.url });
}

// --- Stripe wrapper -----------------------------------------------------------

type SignupCheckoutInput = {
  origin: string;
  businessName: string;
  businessEmail: string;
  businessCategory: string;
};

async function createSignupCheckoutSession(
  input: SignupCheckoutInput,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // We can't call `createCheckoutSession` from `lib/integrations/stripe/client.ts`
  // directly — it requires a pre-existing stripeCustomerId + clientId. Build
  // our own session with the params we need: customer_email + metadata kind,
  // no pre-existing customer.
  //
  // Importing the lower-level `stripeCall` would couple us tighter than
  // helpful; instead we model the call shape inline.
  const { env } = await import('@/lib/env');
  const { callExternal } = await import('@/lib/integrations/_shared/call');

  const secretKey = env.STRIPE_SECRET_KEY;
  const priceId = env.STRIPE_PRICE_ID_STANDARD;
  if (!secretKey || !priceId) return { ok: false, error: 'stripe-not-configured' };

  const params: Record<string, string> = {
    mode: 'subscription',
    customer_email: input.businessEmail,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${input.origin}/sign-up/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/sign-up?cancelled=1`,
    // Tell Stripe to always create a Customer (default behaviour for
    // subscription mode, but explicit here so the customer exists in the
    // subscription event we react to).
    customer_creation: 'always',
    // Session-level metadata — useful for reconciliation from session id.
    'metadata[kind]': 'signup',
    'metadata[signup_business_name]': input.businessName,
    'metadata[signup_business_email]': input.businessEmail,
    'metadata[signup_business_category]': input.businessCategory,
    // Subscription-level metadata — what the webhook handler reads from
    // `customer.subscription.created`.
    'subscription_data[metadata][kind]': 'signup',
    'subscription_data[metadata][signup_business_name]': input.businessName,
    'subscription_data[metadata][signup_business_email]': input.businessEmail,
    'subscription_data[metadata][signup_business_category]': input.businessCategory,
  };

  const result = await callExternal<{ id: string; url: string | null }>({
    provider: 'stripe',
    operation: 'create_signup_checkout',
    url: 'https://api.stripe.com/v1/checkout/sessions',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': crypto.randomUUID(),
    },
    rawBody: new URLSearchParams(params).toString(),
  });

  if (!result.ok) return { ok: false, error: result.error.message };
  if (!result.data.url) return { ok: false, error: 'no-checkout-url' };
  return { ok: true, url: result.data.url };
}
