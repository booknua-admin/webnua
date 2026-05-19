// =============================================================================
// sendEmail — the single transactional-email send boundary, server-only.
//
// Generic on purpose: invite emails use it today, the Phase 8 messaging engine
// will use the same helper for automation message sends. Returns a Result<T>
// (the imperative-call-site half of the error contract — see lib/errors.ts);
// callers decide whether a failed send is fatal.
// =============================================================================

import { AppError, type Result, err, normalizeError, ok } from '@/lib/errors';
import { getFromAddress, getResendClient, isEmailConfigured } from './client';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative — always supply one; some clients prefer it and
   *  it improves deliverability. */
  text: string;
  /** Optional Reply-To override (defaults to the From address). */
  replyTo?: string;
};

/** Send one transactional email through Resend. A missing API key, a Resend
 *  rejection, or a thrown error all resolve to a typed AppError — never throw. */
export async function sendEmail(input: SendEmailInput): Promise<Result<{ id: string }>> {
  if (!isEmailConfigured()) {
    return err(AppError.unexpected(undefined, 'Email is not configured (RESEND_API_KEY unset).'));
  }

  try {
    const { data, error } = await getResendClient().emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (error) {
      return err(AppError.unexpected(error, error.message || 'Resend rejected the email.'));
    }
    if (!data) {
      return err(AppError.unexpected(undefined, 'Resend returned no message id.'));
    }
    return ok({ id: data.id });
  } catch (caught) {
    return err(normalizeError(caught));
  }
}
