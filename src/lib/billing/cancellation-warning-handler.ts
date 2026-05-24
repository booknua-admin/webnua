// =============================================================================
// Cancellation 7-day-warning job handler — Pattern B two-stage cancellation
// stage 2 (day 83 / 7 days before hard delete).
//
// The daily pg_cron `webnua_cancellation_lifecycle` (migration 0091)
// enqueues one job per eligible client. This handler:
//   1. Loads the client row (id, name, slug, primary_contact_email,
//      lifecycle_status, hard_delete_warning_sent_at, data_deletion_scheduled_at)
//   2. Re-checks eligibility (lifecycle_status='deleted',
//      hard_delete_warning_sent_at IS NULL) — the cron + handler can drift
//      by a tick, an operator manual reactivate could fire between, etc.
//   3. Resolves the recipient email (primary_contact_email →
//      first owner user's email)
//   4. Sends the warning email via Resend
//   5. Stamps `clients.hard_delete_warning_sent_at = now()` so the next
//      cron tick skips this client (send-once-per-cancellation semantics)
//
// Failure modes (same pattern as re-engagement-handler):
//   • Email 'failed' → re-throw so the job retries (Resend hiccup)
//   • Email 'skipped' (RESEND_API_KEY unset) → log + stamp anyway so the
//     cron doesn't loop the job forever on every tick
//   • No matching client / no recipient → no-op + stamp + return
//
// SERVER-ONLY.
// =============================================================================

import { env, getAppBaseUrl } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';

import { sendCancellationWarningEmail } from './cancellation-warning-email';

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  primary_contact_email: string | null;
  lifecycle_status: string;
  hard_delete_warning_sent_at: string | null;
  data_deletion_scheduled_at: string | null;
};

type ClientUserRow = { email: string };

async function loadClient(clientId: string): Promise<ClientRow | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('clients')
    .select(
      'id, name, slug, primary_contact_email, lifecycle_status, hard_delete_warning_sent_at, data_deletion_scheduled_at',
    )
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

async function stampWarningSent(clientId: string): Promise<void> {
  const db = getIntegrationDb();
  await db
    .from('clients')
    .update({ hard_delete_warning_sent_at: new Date().toISOString() } as never)
    .eq('id', clientId);
}

/** Compute days-remaining until hard delete from the scheduled-at anchor.
 *  data_deletion_scheduled_at + 60 days = hard-delete moment; current day
 *  + 7 days should land on/near that for the warning email to be timely. */
function computeDaysRemaining(scheduledAt: string | null): number {
  if (!scheduledAt) return 7; // safe default — the cron's filter targets ~day 83
  const parsed = Date.parse(scheduledAt);
  if (Number.isNaN(parsed)) return 7;
  const hardDelete = new Date(parsed);
  hardDelete.setUTCDate(hardDelete.getUTCDate() + 60);
  const now = new Date();
  const ms = hardDelete.getTime() - now.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function buildSupportUrl(): string {
  const base = getAppBaseUrl();
  // The /tickets/new page is the canonical support entry from logged-in
  // surfaces; for a logged-out cancelled customer the marketing site's
  // /contact would be more appropriate. We send them to the dashboard's
  // sign-in (where they can use the cancellation banner's CTA) — they
  // can still sign in while 'cancelled', and we want them to reach the
  // grace-period UI rather than a static page.
  return base ? `${base}/dashboard` : 'https://app.webnua.com/dashboard';
}

type JobPayload = { client_id?: string };

registerJobHandler('send_cancellation_warning_email', async (payload) => {
  const clientId = (payload as JobPayload)?.client_id;
  if (!clientId) {
    console.warn('[cancellation-warning] job missing client_id; skipping');
    return;
  }

  const client = await loadClient(clientId);
  if (!client) {
    console.warn(`[cancellation-warning] client ${clientId} not found; skipping`);
    return;
  }

  // Eligibility re-check — the client may have been reactivated, hard-
  // deleted (cron drift), or already warned between the cron tick and this
  // handler run.
  if (client.lifecycle_status !== 'deleted' || client.hard_delete_warning_sent_at !== null) {
    return;
  }

  const recipient = await resolveRecipientEmail(client);
  if (!recipient) {
    console.warn(
      `[cancellation-warning] client ${clientId} has no contact email; stamping + skipping`,
    );
    await stampWarningSent(clientId);
    return;
  }

  const daysRemaining = computeDaysRemaining(client.data_deletion_scheduled_at);
  const outcome = await sendCancellationWarningEmail({
    recipientEmail: recipient,
    businessName: client.name,
    daysRemaining,
    supportUrl: buildSupportUrl(),
  });

  if (outcome === 'failed') {
    // Re-throw — the job retries on the next executor tick. We do NOT stamp
    // because a real transient Resend failure should retry. The cron only
    // re-enqueues for unstamped rows, so we won't double-queue between
    // retries within the same day.
    throw new Error(`cancellation-warning email send failed for ${recipient}`);
  }

  // 'sent' AND 'skipped' (no API key) both stamp the row so the cron does
  // not re-enqueue. A 'skipped' deploy that later gets keys configured
  // won't retroactively send (the row is stamped); operator clears the
  // timestamp manually to force a resend.
  await stampWarningSent(clientId);

  // Voice the env import so eslint doesn't strip a "used elsewhere" import
  // if a future edit removes the email-builder reference to env. Cheap, no
  // runtime cost.
  void env.EMAIL_SENDING_DOMAIN;
});
