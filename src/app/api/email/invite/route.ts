// =============================================================================
// POST /api/email/invite — send a team/client invite email through Resend.
//
// The Resend API key stays server-side (see lib/email/client.ts). The route is
// auth-gated: an unguarded email endpoint is an open relay — `to`, `magicLink`,
// and `personalNote` are all caller-supplied, so without the gate it would be
// a Webnua-branded phishing factory. Only a signed-in Webnua user may send.
//
// When RESEND_API_KEY is unset the route returns 503 and the caller degrades
// gracefully — the invite row is already persisted and the magic link is
// copyable from the modal.
// =============================================================================

import { NextResponse } from 'next/server';

import { isEmailConfigured } from '@/lib/email/client';
import { sendEmail } from '@/lib/email/send';
import { renderInviteEmail, type InviteEmailPayload } from '@/lib/email/templates';
import { getServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request): Promise<Response> {
  if (!isEmailConfigured()) {
    // Not an error — the caller falls back to the copyable magic link.
    return NextResponse.json({ error: 'email-not-configured' }, { status: 503 });
  }

  // --- auth gate -------------------------------------------------------------
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { data: userData, error: authError } = await getServiceClient().auth.getUser(token);
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // --- payload ---------------------------------------------------------------
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: 'invalid-payload' }, { status: 400 });
  }

  // --- send ------------------------------------------------------------------
  const { subject, html, text } = renderInviteEmail(payload);
  const result = await sendEmail({ to: payload.to, subject, html, text });
  if (!result.ok) {
    console.error('[email/invite] send failed:', result.error.message);
    return NextResponse.json(
      { error: 'send-failed', detail: result.error.message },
      { status: 502 },
    );
  }
  return NextResponse.json({ id: result.data.id });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validate the request body before it reaches the template. `magicLink` is
 *  restricted to http(s) to keep the templated href off `javascript:` etc. */
function isValidPayload(value: unknown): value is InviteEmailPayload {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (o.kind !== 'team' && o.kind !== 'client') return false;
  if (typeof o.to !== 'string' || !EMAIL_RE.test(o.to)) return false;
  if (typeof o.magicLink !== 'string' || !/^https?:\/\//i.test(o.magicLink)) return false;
  for (const key of ['recipientName', 'inviterName', 'workspaceName', 'personalNote', 'expiresAt']) {
    if (typeof o[key] !== 'string') return false;
  }
  if (o.roleName !== undefined && typeof o.roleName !== 'string') return false;
  return true;
}
