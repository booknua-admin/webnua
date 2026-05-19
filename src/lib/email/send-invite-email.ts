// =============================================================================
// sendInviteEmail — client-side trigger for the invite-email send.
//
// Client-safe: it does not import the Resend SDK or the server email modules,
// only the InviteEmailPayload type (erased) and the browser Supabase client.
// It POSTs to /api/email/invite, attaching the caller's access token so the
// route's auth gate accepts the request.
//
// Fire-and-forget by design — it never throws. The invite row is already
// persisted and the magic link is copyable from the modal, so a failed (or
// unconfigured) send must not block the UI.
// =============================================================================

import type { InviteEmailPayload } from '@/lib/email/templates';
import { supabase } from '@/lib/supabase/client';

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      console.warn('[email] no active session — invite email not sent');
      return;
    }
    const response = await fetch('/api/email/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    // 503 = RESEND_API_KEY unset; that is an expected, graceful no-op.
    if (!response.ok && response.status !== 503) {
      console.error('[email] invite email send failed:', response.status);
    }
  } catch (error) {
    console.error('[email] invite email send error:', error);
  }
}
