// =============================================================================
// POST /api/clients/[id]/request-review
//
// Pattern B optional path: a client opts for "operator review before
// publishing" instead of direct publish. Sets `clients.review_requested_at` =
// now, fires an operator notification email via Resend, returns success.
//
// Idempotent — calling it again on a client with a pending request just
// re-stamps the timestamp (latest wins). The operator clears the request
// (sets `review_requested_at = NULL`) after they've handled it via the
// operator dashboard's "Mark handled" action.
//
// Auth: requireClientAccess — a client may request a review on their own
// workspace; an operator may do it on the customer's behalf (concierge
// support call).
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { sendOperatorEmail } from '@/lib/integrations/stripe/notify';
import { getAppBaseUrl } from '@/lib/env';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getIntegrationDb();

  // Fetch the client name + primary contact for the email body. Done first so
  // we don't stamp a request for a client we can't even read.
  const { data: client, error: readErr } = await db
    .from('clients')
    .select('id, name, slug, primary_contact_email, primary_contact_name')
    .eq('id', clientId)
    .single();
  if (readErr || !client) {
    return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
  }
  const clientRow = client as {
    id: string;
    name: string;
    slug: string;
    primary_contact_email: string | null;
    primary_contact_name: string | null;
  };

  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from('clients')
    .update({ review_requested_at: now })
    .eq('id', clientId);
  if (updateErr) {
    console.error(
      `[request-review] clients update failed for ${clientId}: ${updateErr.message}`,
    );
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }

  // Resolve operator recipients. notification_preferences keys on the operator
  // address per client; if none are configured, fall back to every admin-role
  // user's email so the request still surfaces somewhere.
  let recipients: string[] = [];
  const { data: prefs } = await db
    .from('notification_preferences')
    .select('operator_email')
    .eq('client_id', clientId);
  if (prefs && prefs.length > 0) {
    recipients = (prefs as { operator_email: string }[]).map((p) => p.operator_email);
  } else {
    const { data: admins } = await db
      .from('users')
      .select('email')
      .eq('role', 'admin');
    if (admins) {
      recipients = (admins as { email: string }[]).map((a) => a.email).filter(Boolean);
    }
  }

  if (recipients.length === 0) {
    console.warn(
      `[request-review] no operator recipients resolved for ${clientId} — request stamped, email skipped`,
    );
    return NextResponse.json({ ok: true, recipients: 0 });
  }

  const dashboardBase = getAppBaseUrl() ?? 'https://app.webnua.com';
  const subject = `Review requested: ${clientRow.name}`;
  const html = renderReviewRequestEmail({
    clientName: clientRow.name,
    contactName: clientRow.primary_contact_name,
    contactEmail: clientRow.primary_contact_email,
    dashboardUrl: `${dashboardBase}/clients/${clientRow.slug}`,
    requestedAt: now,
  });

  // Fire-and-forget the emails in parallel — a single send failure should not
  // fail the whole request (the timestamp is already stamped, the queue still
  // has the work).
  await Promise.all(
    recipients.map((to) =>
      sendOperatorEmail({
        clientId,
        recipientEmail: to,
        subject,
        html,
        templateName: 'review_request',
      }),
    ),
  );

  return NextResponse.json({ ok: true, recipients: recipients.length });
}

function renderReviewRequestEmail({
  clientName,
  contactName,
  contactEmail,
  dashboardUrl,
  requestedAt,
}: {
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  dashboardUrl: string;
  requestedAt: string;
}): string {
  const contactLine = [contactName, contactEmail].filter(Boolean).join(' · ');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
      <p style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #d24317; margin: 0 0 16px;">
        // Review requested
      </p>
      <h1 style="font-size: 22px; line-height: 1.25; font-weight: 800; color: #0a0a0a; margin: 0 0 12px;">
        ${escapeHtml(clientName)} asked for review before publishing.
      </h1>
      <p style="font-size: 14px; line-height: 1.5; color: #2a2a28; margin: 0 0 16px;">
        They picked "Request operator review first" instead of publishing
        directly. Reach out to walk through their preview, then either publish
        on their behalf or let them know they're good to go.
      </p>
      ${
        contactLine
          ? `<p style="font-size: 13px; line-height: 1.5; color: #4a4a45; margin: 0 0 20px;">Primary contact: <strong>${escapeHtml(contactLine)}</strong></p>`
          : ''
      }
      <p style="font-size: 13px; line-height: 1.5; color: #4a4a45; margin: 0 0 24px;">
        Requested: ${escapeHtml(requestedAt)}
      </p>
      <p>
        <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background: #d24317; color: #f5f1ea; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
          Open ${escapeHtml(clientName)} →
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.4; color: #6e685c; margin: 32px 0 0;">
        Mark the request handled from the operator dashboard after you've
        contacted ${escapeHtml(clientName)}.
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
