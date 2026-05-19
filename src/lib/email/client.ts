// =============================================================================
// Resend client — transactional email, server-only.
//
// Powers invite emails today; the automation/messaging engine (Phase 8) will
// reuse the same client for automation message sends. The API key is read from
// a non-NEXT_PUBLIC_ env var and never reaches the browser — this module must
// only ever be imported by server code (route handlers / server components).
//
// When RESEND_API_KEY is unset the app still works: callers check
// isEmailConfigured() and degrade gracefully (the invite is still created, the
// magic link is still copyable) rather than failing.
// =============================================================================

import { Resend } from 'resend';

let cached: Resend | null = null;

/** True when a Resend API key is configured. Callers branch on this to degrade
 *  gracefully rather than throwing when email is not set up. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** The Resend client. Throws if RESEND_API_KEY is unset — only ever called
 *  after isEmailConfigured() has been checked, so this never aborts the build. */
export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('getResendClient: RESEND_API_KEY must be set to send email.');
  }
  if (!cached) cached = new Resend(key);
  return cached;
}

/** The From address every Webnua email is sent from. RESEND_FROM_EMAIL must be
 *  an address on a domain verified in the Resend dashboard; the fallback is
 *  Resend's shared onboarding sender, which works only for testing. */
export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'Webnua <onboarding@resend.dev>';
}
