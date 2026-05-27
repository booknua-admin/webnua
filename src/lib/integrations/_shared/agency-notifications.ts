// =============================================================================
// Stream A — agency notification stream. Sends operator-facing alerts about
// platform events (new ticket, new signup, cancellation, integration failure)
// to the recipients on `agency_notification_recipients`.
//
// The DB triggers from migration 0107 (ticket_messages, clients lifecycle
// transitions) enqueue `send_agency_notification` integration_jobs carrying
// the event_type + structured payload. This module:
//
//   1. Registers the handler that processes those jobs.
//   2. Resolves the relevant recipients (active + opted-in to the event type).
//   3. Builds the per-event branded HTML body (inline — matches the
//      `stripe-payment-failed` precedent for one-shot alerts; cheaper than
//      a platform_email_templates row for low-volume operator chrome).
//   4. Calls `sendOperatorEmail` per recipient.
//
// Distinct from Stream B (notification_preferences — per-sub-account, ABOUT
// that sub-account's leads / bookings / reviews) and Stream C (the
// automations engine — sub-account → lead).
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';

import { EMAIL_BRAND_FOOTER, EMAIL_BRAND_FOOTER_TEXT } from '@/lib/email/footer';
import { sendOperatorEmail } from '@/lib/integrations/stripe/notify';

import { getIntegrationDb } from './db-types';
import { registerJobHandler } from './jobs';

// --- types -------------------------------------------------------------------

export const SEND_AGENCY_NOTIFICATION_JOB = 'send_agency_notification';

export type AgencyNotificationEventType =
  | 'new_ticket'
  | 'new_signup'
  | 'cancellation'
  | 'integration_failure';

export type AgencyNotificationPayload =
  | { event_type: 'new_ticket'; ticket_id: string; message_id: string }
  | { event_type: 'new_signup'; client_id: string }
  | { event_type: 'cancellation'; client_id: string; lifecycle_status: string }
  | { event_type: 'integration_failure'; client_id: string; provider: string; detail: string };

type AgencyRecipientRow = {
  email: string;
  display_name: string | null;
  notify_on_new_ticket: boolean;
  notify_on_new_signup: boolean;
  notify_on_cancellation: boolean;
  notify_on_integration_failure: boolean;
};

// --- handler -----------------------------------------------------------------

registerJobHandler(SEND_AGENCY_NOTIFICATION_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as Partial<AgencyNotificationPayload>;
  const eventType = payload.event_type as AgencyNotificationEventType | undefined;
  if (!eventType) {
    throw new Error('send_agency_notification: missing event_type');
  }

  const recipients = await fetchActiveRecipients(eventType);
  if (recipients.length === 0) {
    return { skipped: true, reason: 'no_active_recipients' };
  }

  const built = await buildEmail(payload as AgencyNotificationPayload);
  if (!built) {
    return { skipped: true, reason: 'no_event_data' };
  }

  const results: { email: string; outcome: string }[] = [];
  for (const recipient of recipients) {
    const outcome = await sendOperatorEmail({
      clientId: '00000000-0000-0000-0000-000000000000', // platform-level event
      recipientEmail: recipient.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      templateName: `agency_${eventType}`,
    });
    results.push({ email: recipient.email, outcome });
  }
  return { sent: results.length, results };
});

export {};

// --- recipients --------------------------------------------------------------

async function fetchActiveRecipients(
  eventType: AgencyNotificationEventType,
): Promise<AgencyRecipientRow[]> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('agency_notification_recipients')
    .select(
      'email, display_name, notify_on_new_ticket, notify_on_new_signup, notify_on_cancellation, notify_on_integration_failure',
    )
    .eq('is_active', true);
  if (error) {
    console.error('[agency-notifications] recipient fetch failed', error);
    return [];
  }
  const rows = (data as AgencyRecipientRow[] | null) ?? [];
  const optInFlag: Record<AgencyNotificationEventType, keyof AgencyRecipientRow> = {
    new_ticket: 'notify_on_new_ticket',
    new_signup: 'notify_on_new_signup',
    cancellation: 'notify_on_cancellation',
    integration_failure: 'notify_on_integration_failure',
  };
  const flag = optInFlag[eventType];
  return rows.filter((r) => r[flag] === true);
}

// --- email body builder ------------------------------------------------------

type BuiltEmail = { subject: string; html: string; text: string };

async function buildEmail(payload: AgencyNotificationPayload): Promise<BuiltEmail | null> {
  const base = `https://${env.APP_HOST ?? 'app.webnua.com'}`;

  switch (payload.event_type) {
    case 'new_ticket': {
      const ticketDetails = await fetchTicketDetails(payload.ticket_id, payload.message_id);
      if (!ticketDetails) return null;
      const link = `${base}/tickets`;
      return {
        subject: `New ticket from ${ticketDetails.clientName} — ${truncate(ticketDetails.subject, 60)}`,
        html: agencyEmailHtml({
          eyebrow: '// New ticket',
          headline: `${ticketDetails.clientName} opened a ticket.`,
          summary: `<strong>${escapeHtml(ticketDetails.subject)}</strong>`,
          quote: ticketDetails.preview,
          metaParts: [
            `From <strong>${escapeHtml(ticketDetails.authorName)}</strong>`,
            ticketDetails.category ? `Category: ${escapeHtml(ticketDetails.category)}` : null,
          ],
          ctaLabel: 'Open ticket inbox →',
          ctaHref: link,
        }),
        text: agencyEmailText({
          headline: `${ticketDetails.clientName} opened a ticket.`,
          parts: [
            ticketDetails.subject,
            ticketDetails.preview,
            `From: ${ticketDetails.authorName}`,
            ticketDetails.category ? `Category: ${ticketDetails.category}` : null,
            `Open: ${link}`,
          ],
        }),
      };
    }
    case 'new_signup': {
      const client = await fetchClientName(payload.client_id);
      if (!client) return null;
      const link = `${base}/clients/${client.slug ?? payload.client_id}`;
      return {
        subject: `New signup — ${client.name}`,
        html: agencyEmailHtml({
          eyebrow: '// New signup',
          headline: `${client.name} just signed up.`,
          summary: 'A new sub-account verified their email and entered preview.',
          metaParts: [
            client.industry ? `Industry: ${escapeHtml(client.industry)}` : null,
            client.email ? `Email: <strong>${escapeHtml(client.email)}</strong>` : null,
          ],
          ctaLabel: 'Open sub-account →',
          ctaHref: link,
        }),
        text: agencyEmailText({
          headline: `${client.name} just signed up.`,
          parts: [
            'A new sub-account verified their email and entered preview.',
            client.industry ? `Industry: ${client.industry}` : null,
            client.email ? `Email: ${client.email}` : null,
            `Open: ${link}`,
          ],
        }),
      };
    }
    case 'cancellation': {
      const client = await fetchClientName(payload.client_id);
      if (!client) return null;
      const status = payload.lifecycle_status;
      const isHardDelete = status === 'deleted';
      const link = `${base}/clients/${client.slug ?? payload.client_id}`;
      return {
        subject: isHardDelete
          ? `Sub-account deleted — ${client.name}`
          : `Sub-account cancelled — ${client.name}`,
        html: agencyEmailHtml({
          eyebrow: isHardDelete ? '// Sub-account deleted' : '// Sub-account cancelled',
          headline: isHardDelete
            ? `${client.name} has been deleted.`
            : `${client.name} cancelled their subscription.`,
          summary: isHardDelete
            ? 'The 30-day grace + 60-day operator-recovery windows have elapsed and the row has been purged.'
            : 'They have a 30-day grace before deletion. Reach out if you want to save the relationship.',
          ctaLabel: 'Open sub-account →',
          ctaHref: link,
        }),
        text: agencyEmailText({
          headline: isHardDelete
            ? `${client.name} has been deleted.`
            : `${client.name} cancelled their subscription.`,
          parts: [
            isHardDelete
              ? 'The 30-day grace + 60-day operator-recovery windows have elapsed and the row has been purged.'
              : 'They have a 30-day grace before deletion. Reach out if you want to save the relationship.',
            `Open: ${link}`,
          ],
        }),
      };
    }
    case 'integration_failure': {
      // V2 — defer wiring. Returning null skips the send.
      console.info('[agency-notifications] integration_failure event not yet wired');
      return null;
    }
  }
}

// --- DB lookups --------------------------------------------------------------

async function fetchTicketDetails(
  ticketId: string,
  messageId: string,
): Promise<{
  subject: string;
  preview: string;
  clientName: string;
  authorName: string;
  category: string | null;
} | null> {
  const db = getIntegrationDb();
  const { data: ticket } = await db
    .from('tickets')
    .select('subject, category, client_id, clients(name)')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) return null;
  const ticketRow = ticket as unknown as {
    subject: string | null;
    category: string | null;
    client_id: string;
    clients: { name: string } | null;
  };

  const { data: message } = await db
    .from('ticket_messages')
    .select('body, author_user_id, users(display_name, email)')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) return null;
  const msgRow = message as unknown as {
    body: string | null;
    author_user_id: string | null;
    users: { display_name: string | null; email: string | null } | null;
  };

  const authorName =
    msgRow.users?.display_name ??
    (msgRow.users?.email ? msgRow.users.email.split('@')[0] : 'a teammate');

  return {
    subject: ticketRow.subject ?? '(no subject)',
    preview: truncate((msgRow.body ?? '').trim(), 240),
    clientName: ticketRow.clients?.name ?? 'A sub-account',
    authorName,
    category: ticketRow.category ?? null,
  };
}

async function fetchClientName(
  clientId: string,
): Promise<{ name: string; slug: string | null; industry: string | null; email: string | null } | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('clients')
    .select('name, slug, industry, primary_contact_email')
    .eq('id', clientId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    name: string | null;
    slug: string | null;
    industry: string | null;
    primary_contact_email: string | null;
  };
  return {
    name: row.name ?? 'A sub-account',
    slug: row.slug,
    industry: row.industry,
    email: row.primary_contact_email,
  };
}

// --- branded chrome ----------------------------------------------------------

type AgencyEmailBuild = {
  eyebrow: string;
  headline: string;
  summary?: string;
  quote?: string;
  metaParts?: Array<string | null>;
  ctaLabel: string;
  ctaHref: string;
};

function agencyEmailHtml(input: AgencyEmailBuild): string {
  const metaLine = (input.metaParts ?? [])
    .filter((p): p is string => p !== null && p !== undefined && p.length > 0)
    .join(' · ');

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">${escapeHtml(input.eyebrow)}</div>
    <h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;color:#0a0a0a;">${escapeHtml(input.headline)}</h1>
    ${
      input.summary
        ? `<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 18px 0;">${input.summary}</p>`
        : ''
    }
    ${
      input.quote
        ? `<div style="margin:0 0 18px 0;padding:14px 16px;background:#f5f1ea;border-left:3px solid #d24317;border-radius:6px;">
             <p style="font-size:13px;line-height:1.55;color:#0a0a0a;margin:0;font-style:italic;">${escapeHtml(input.quote)}</p>
           </div>`
        : ''
    }
    ${
      metaLine
        ? `<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.06em;color:#6e685c;margin:0 0 22px 0;">${metaLine}</p>`
        : ''
    }
    <p style="margin:0 0 4px 0;">
      <a href="${escapeAttr(input.ctaHref)}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">${escapeHtml(input.ctaLabel)}</a>
    </p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function agencyEmailText(input: {
  headline: string;
  parts: Array<string | null>;
}): string {
  return [
    input.headline,
    '',
    ...input.parts.filter((p): p is string => p !== null && p !== undefined && p.length > 0),
    '',
    EMAIL_BRAND_FOOTER_TEXT,
  ].join('\n');
}

// --- pure helpers ------------------------------------------------------------

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + '…';
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
