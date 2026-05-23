// =============================================================================
// POST /api/integrations/resend/sender — register / update a client's email
// sender slug.
//
// Phase 7 Resend session. Operator-only. The operator (on the sub-account
// `/settings/email` surface) provisions the per-client sender:
//
//   action 'register' — submit the slug + display_name. The route checks the
//     slug shape, ensures it is not already taken globally, and inserts the
//     client_email_senders row at status 'active'.
//   action 'update'   — change the display_name or pause/resume sending.
//
// Sending domain configuration (DKIM / SPF / DMARC on EMAIL_SENDING_DOMAIN)
// is operator infrastructure work in the Resend dashboard, not per-client —
// see CLAUDE.md "Resend email — operator setup".
//
// Auth transport: caller's Supabase access token on the Authorization header,
// same pattern as the Twilio sender route + Stripe routes.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  getSenderByClientId,
  getSenderBySlug,
  insertSender,
  isValidSenderSlug,
  updateSender,
} from '@/lib/integrations/resend/senders';
import type { EmailSenderStatus } from '@/lib/integrations/resend/types';

export async function POST(request: Request): Promise<Response> {
  let body: {
    clientId?: unknown;
    action?: unknown;
    slug?: unknown;
    displayName?: unknown;
    status?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (body.action === 'update') {
    return updateSenderHandler(clientId, body.displayName, body.status);
  }
  return registerSenderHandler(clientId, body.slug, body.displayName);
}

// --- register ----------------------------------------------------------------

async function registerSenderHandler(
  clientId: string,
  rawSlug: unknown,
  rawDisplayName: unknown,
): Promise<Response> {
  if (typeof rawSlug !== 'string' || !rawSlug) {
    return NextResponse.json({ error: 'missing-slug' }, { status: 400 });
  }
  const slug = rawSlug.trim().toLowerCase();
  if (!isValidSenderSlug(slug)) {
    return NextResponse.json({ error: 'invalid-slug' }, { status: 400 });
  }

  const displayName =
    typeof rawDisplayName === 'string' && rawDisplayName.trim()
      ? rawDisplayName.trim().slice(0, 80)
      : slug;

  // One sender per client.
  const existing = await getSenderByClientId(clientId);
  if (existing) {
    return NextResponse.json({ error: 'sender-exists' }, { status: 409 });
  }

  // Global slug uniqueness — the column is `unique` but a pre-check returns a
  // friendlier error than the constraint violation.
  const collision = await getSenderBySlug(slug);
  if (collision) {
    return NextResponse.json({ error: 'slug-taken' }, { status: 409 });
  }

  try {
    const row = await insertSender({ clientId, slug, displayName });
    return NextResponse.json({ sender: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'insert failed';
    console.error('[resend/sender] insertSender failed', message);
    return NextResponse.json(
      { error: 'sender-insert-failed', detail: message },
      { status: 500 },
    );
  }
}

// --- update -----------------------------------------------------------------

async function updateSenderHandler(
  clientId: string,
  rawDisplayName: unknown,
  rawStatus: unknown,
): Promise<Response> {
  const existing = await getSenderByClientId(clientId);
  if (!existing) {
    return NextResponse.json({ error: 'no-sender' }, { status: 404 });
  }

  const patch: { displayName?: string; status?: EmailSenderStatus } = {};
  if (typeof rawDisplayName === 'string' && rawDisplayName.trim()) {
    patch.displayName = rawDisplayName.trim().slice(0, 80);
  }
  if (rawStatus === 'active' || rawStatus === 'suspended') {
    patch.status = rawStatus;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ sender: existing });
  }

  const updated = await updateSender(existing.id, patch);
  return NextResponse.json({ sender: updated });
}
