// =============================================================================
// Re-engagement job handler — Pattern B's send_re_engagement_email job type.
//
// The daily pg_cron `webnua_re_engagement_scan` (migration 0086) enqueues
// one job per eligible client. This handler:
//   1. Loads the client row (id, name, slug, primary_contact_email)
//   2. Resolves the client's owner-user email if no primary_contact_email
//      is set
//   3. Sends the re-engagement email via Resend
//   4. Stamps `clients.re_engagement_sent_at = now()` so the next scan
//      skips this client (send-once-per-client semantics; the cron's WHERE
//      already filters re_engagement_sent_at IS NULL)
//
// Failure modes:
//   • Email send 'failed' → re-throw so the job retries (Resend hiccup)
//   • Email send 'skipped' (RESEND_API_KEY unset) → log + stamp the row
//     anyway, so a dev deploy without keys doesn't loop the cron forever
//   • Client not eligible any more (lifecycle changed, already sent) →
//     no-op and return; the next scan filters this out automatically
//
// SERVER-ONLY.
// =============================================================================

import { env, getAppBaseUrl } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';

import { sendReEngagementEmail } from './re-engagement-email';

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  primary_contact_email: string | null;
  lifecycle_status: string;
  re_engagement_sent_at: string | null;
};

type ClientUserRow = {
  email: string;
};

async function loadClient(clientId: string): Promise<ClientRow | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('clients')
    .select('id, name, slug, primary_contact_email, lifecycle_status, re_engagement_sent_at')
    .eq('id', clientId)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

async function resolveRecipientEmail(client: ClientRow): Promise<string | null> {
  if (client.primary_contact_email) return client.primary_contact_email;
  const db = getIntegrationDb();
  const { data } = await db
    .from('users')
    .select('email')
    .eq('client_id', client.id)
    .eq('role', 'client')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as ClientUserRow | null)?.email ?? null;
}

function publicSiteDomain(): string {
  return (env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev').toLowerCase();
}

function buildPreviewUrl(slug: string): string {
  return `https://${slug}.${publicSiteDomain()}`;
}

function buildDashboardUrl(): string {
  const base = getAppBaseUrl();
  return base ? `${base}/dashboard` : 'https://app.webnua.com/dashboard';
}

async function stampSent(clientId: string): Promise<void> {
  const db = getIntegrationDb();
  await db
    .from('clients')
    .update({ re_engagement_sent_at: new Date().toISOString() } as never)
    .eq('id', clientId);
}

type JobPayload = { client_id?: string };

registerJobHandler('send_re_engagement_email', async (payload) => {
  const clientId = (payload as JobPayload)?.client_id;
  if (!clientId) {
    console.warn('[re-engagement] job missing client_id; skipping');
    return;
  }

  const client = await loadClient(clientId);
  if (!client) {
    console.warn(`[re-engagement] client ${clientId} not found; skipping`);
    return;
  }

  // Eligibility re-check — the row may have published OR been already-sent
  // between the cron scan and this handler running.
  if (client.lifecycle_status !== 'preview' || client.re_engagement_sent_at !== null) {
    return;
  }

  const recipient = await resolveRecipientEmail(client);
  if (!recipient) {
    console.warn(`[re-engagement] client ${clientId} has no contact email; stamping + skipping`);
    await stampSent(clientId);
    return;
  }

  const outcome = await sendReEngagementEmail({
    recipientEmail: recipient,
    businessName: client.name,
    dashboardUrl: buildDashboardUrl(),
    previewUrl: buildPreviewUrl(client.slug),
  });

  if (outcome === 'failed') {
    // Throw so the job retries on the next executor tick. We do NOT stamp
    // re_engagement_sent_at — a real transient Resend failure should retry
    // until success or job-attempts exhausted.
    throw new Error(`re-engagement email send failed for ${recipient}`);
  }

  // Both 'sent' and 'skipped' (no API key) stamp the row so the cron does
  // not re-enqueue on every scan. A 'skipped' deploy that later gets keys
  // configured won't retroactively send (the row is stamped); operator can
  // NULL it manually to force a resend.
  await stampSent(clientId);
});
