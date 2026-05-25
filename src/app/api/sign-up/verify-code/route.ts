// =============================================================================
// POST /api/sign-up/verify-code — conversational onboarding (Session B).
//
// Body: { email, code, firstMessage }
//
// Flow:
//   1. Per-email rate limit (verification_code_attempt: 5/email/15min).
//   2. Lookup the most-recent active code; verify hash.
//   3. On match:
//        a. Mark the code consumed.
//        b. Provision the workspace via provisionPendingSignup with placeholder
//           businessName / businessCategory derived from the email (Session C
//           overwrites via AI extraction from firstMessage).
//        c. Confirm the email server-side (admin.updateUserById) so the 0085
//           trigger flips lifecycle 'pending_verification' → 'preview'.
//        d. Set a server-generated password and return it to the client so
//           the client can immediately sign in via supabase.auth.signInWith
//           Password — matches the acceptInvite session-mint pattern.
//        e. Seed clients.conversation_state with the user's first message
//           and the 'verified' flag.
//
// Auth: PUBLIC route (no session). Sets up the session on success.
// =============================================================================

import { createHash, randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';

import { emailAlreadyRegistered, provisionPendingSignup } from '@/lib/auth/signup-workspace';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { getServiceClient } from '@/lib/supabase/server';
import { checkAndRecord } from '@/lib/rate-limit';

type Body = {
  email?: unknown;
  code?: unknown;
  firstMessage?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const MAX_ATTEMPTS = 5;
const ATTEMPT_LOCKOUT_MINUTES = 15;

type CodeRow = {
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
};

function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}`).digest('hex');
}

function deriveBusinessNameFromEmail(email: string): string {
  // "user@cool-trade.com" → "cool-trade". Session C overwrites with the
  // AI-extracted business name once it parses firstMessage.
  const local = email.split('@')[1]?.split('.')[0] ?? 'business';
  return local.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'New Business';
}

function generatePassword(): string {
  // 24 random bytes → 32 chars base64url. Returned to the client for the
  // immediate sign-in; never persisted in app code (Supabase hashes it).
  return randomBytes(24).toString('base64url');
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60_000));
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const firstMessage = typeof body.firstMessage === 'string' ? body.firstMessage.trim() : '';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email-invalid' }, { status: 400 });
  }
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: 'code-format-invalid' }, { status: 400 });
  }
  if (firstMessage.length === 0) {
    return NextResponse.json({ error: 'first-message-required' }, { status: 400 });
  }
  if (firstMessage.length > 4000) {
    return NextResponse.json({ error: 'first-message-too-long' }, { status: 400 });
  }

  // Per-email attempt limit — 5 per 15 minutes. This is the per-email outer
  // guard; the per-row attempts counter (below) is the per-code inner guard.
  const decision = await checkAndRecord('verification_code_attempt', { key: email });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: 'too-many-attempts',
        detail: decision.message,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const db = getIntegrationDb();

  // Most-recent active code for this email.
  const { data: rows, error: lookupError } = await db
    .from('email_verification_codes')
    .select('email, code_hash, expires_at, attempts, consumed_at, created_at')
    .eq('email', email)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error('[verify-code] lookup failed:', lookupError.message);
    return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
  }

  const row = (rows as unknown as CodeRow[] | null)?.[0] ?? null;
  if (!row) {
    return NextResponse.json({ error: 'code-expired-or-invalid' }, { status: 400 });
  }

  // Per-code attempt cap. If we've already burned through, refuse and report
  // how long until the code itself expires (which forces a fresh request).
  if (row.attempts >= MAX_ATTEMPTS) {
    const lockoutMinutes = minutesUntil(row.expires_at);
    return NextResponse.json(
      {
        error: 'too-many-attempts',
        retryAfterMinutes: Math.min(ATTEMPT_LOCKOUT_MINUTES, Math.max(1, lockoutMinutes)),
      },
      { status: 429 },
    );
  }

  const submittedHash = hashCode(email, code);
  if (submittedHash !== row.code_hash) {
    const nextAttempts = row.attempts + 1;
    await db
      .from('email_verification_codes')
      .update({ attempts: nextAttempts } as never)
      .eq('email', email)
      .eq('created_at', row.created_at);
    return NextResponse.json(
      {
        error: 'wrong-code',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
      },
      { status: 400 },
    );
  }

  // Code matches. Mark consumed BEFORE provisioning so a double-submit can't
  // replay the same code.
  await db
    .from('email_verification_codes')
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq('email', email)
    .eq('created_at', row.created_at);

  // Refuse if an auth user already exists — the user should sign in via
  // /login (the conversational flow can't take an existing account through
  // turn-1 without losing context).
  if (await emailAlreadyRegistered(email)) {
    return NextResponse.json({ error: 'email-already-registered' }, { status: 409 });
  }

  const businessName = deriveBusinessNameFromEmail(email);
  const businessCategory = 'Pending — captured in chat';
  const requestOrigin = new URL(request.url).origin;

  let provisioned: Awaited<ReturnType<typeof provisionPendingSignup>>;
  try {
    provisioned = await provisionPendingSignup({
      businessName,
      businessEmail: email,
      businessCategory,
      redirectToBase: requestOrigin,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[verify-code] provisionPendingSignup failed:', message);
    return NextResponse.json({ error: 'provision-failed', detail: message }, { status: 500 });
  }

  // Resolve the auth user we just created so we can set a password + confirm
  // the email. admin.listUsers is paginated — we iterate until we find the
  // matching email. Same pagination shape as emailAlreadyRegistered.
  const svc = getServiceClient();
  let authUserId: string | null = null;
  const PAGE_SIZE = 200;
  const MAX_PAGES = 25;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.trim().toLowerCase() === email);
    if (match) {
      authUserId = match.id;
      break;
    }
    if (users.length < PAGE_SIZE) break;
  }
  if (!authUserId) {
    console.error('[verify-code] could not resolve newly-created auth user for', email);
    return NextResponse.json({ error: 'provision-failed' }, { status: 500 });
  }

  // Set a server-generated password + confirm the email in ONE updateUserById
  // call. Setting email_confirm: true here is what fires the 0085 trigger.
  const password = generatePassword();
  const { error: updateError } = await svc.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  });
  if (updateError) {
    console.error('[verify-code] updateUserById failed:', updateError.message);
    return NextResponse.json({ error: 'session-setup-failed' }, { status: 500 });
  }

  // Seed conversation_state with the first message + verified flag. Failure
  // here is non-fatal — Session C's first save through the conversation-state
  // route would rehydrate from server defaults.
  const initialState = {
    messages: [
      {
        id: `msg_${Date.now()}_user`,
        role: 'user' as const,
        content: firstMessage,
        timestamp: new Date().toISOString(),
      },
    ],
    capturedFacts: {},
    current_turn: 2,
    verified: true,
  };
  const { error: stateError } = await svc
    .from('clients')
    .update({ conversation_state: initialState } as never)
    .eq('id', provisioned.clientId);
  if (stateError) {
    console.warn(
      `[verify-code] conversation_state seed failed for client ${provisioned.clientId}: ${stateError.message}`,
    );
  }

  return NextResponse.json({
    success: true,
    email,
    password,
    clientId: provisioned.clientId,
    clientSlug: provisioned.clientSlug,
    redirect: '/sign-up?step=2',
  });
}
