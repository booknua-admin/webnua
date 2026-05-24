// =============================================================================
// billing/cancellation — Pattern B's two-stage cancellation lifecycle.
//
// Stage 1 (day 0–30): `lifecycle_status='cancelled'`. Customer can log in,
// sees a read-only banner with Reactivate CTA. `cancelled_at` + 30-day
// `data_deletion_scheduled_at` are set when the Stripe webhook fires
// `subscription.deleted`.
//
// Stage 2 (day 30): cron promotes 'cancelled' → 'deleted'. Customer locked
// out. Operator-only recovery for 60 more days.
//
// Stage 3 (day 83): cron enqueues the 7-day-warning email.
// Stage 4 (day 90): cron HARD-deletes the row.
//
// This module is SERVER-ONLY — every helper uses the service-role client. The
// reactivate path is special: it clears the cancellation timestamps and
// flips lifecycle_status back to 'active'. The webhook calls
// `reactivateClient` directly on `customer.subscription.created` when the
// prior state was 'cancelled'. The customer-facing route also calls it
// after a successful Stripe Checkout (defence in depth — if the webhook
// arrives first the route is a no-op).
// =============================================================================

import { getServiceClient } from '@/lib/supabase/server';

import type { ClientLifecycle } from '@/lib/auth/lifecycle';

/** Days from cancellation until 'cancelled' → 'deleted'. The first stage of
 *  the grace period. Mirror of the SQL `interval '30 days'` math in the
 *  migration 0091 cron — keep in lockstep with whatever the cron computes. */
export const STAGE_1_GRACE_DAYS = 30;
/** Days from data_deletion_scheduled_at to the 7-day-warning email
 *  (i.e. day 83 of the cancellation lifecycle). */
export const STAGE_2_WARNING_DAYS_AFTER_SCHEDULE = 53;
/** Days from data_deletion_scheduled_at to the hard delete (day 90). */
export const STAGE_3_HARD_DELETE_DAYS_AFTER_SCHEDULE = 60;

export type ClientCancellationRow = {
  id: string;
  name: string;
  slug: string;
  lifecycle_status: ClientLifecycle;
  cancelled_at: string | null;
  data_deletion_scheduled_at: string | null;
  hard_delete_warning_sent_at: string | null;
};

/** Load the cancellation-relevant columns for a client. Returns null if
 *  the row doesn't exist (a deleted-and-cron-swept workspace). */
export async function loadCancellationState(
  clientId: string,
): Promise<ClientCancellationRow | null> {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('clients')
    .select(
      'id, name, slug, lifecycle_status, cancelled_at, data_deletion_scheduled_at, hard_delete_warning_sent_at',
    )
    .eq('id', clientId)
    .maybeSingle();
  if (error) {
    console.error('[cancellation] load failed', error);
    return null;
  }
  return (data as ClientCancellationRow | null) ?? null;
}

/**
 * Apply the Stripe `subscription.deleted` cancellation. Sets:
 *   - lifecycle_status = 'cancelled'
 *   - cancelled_at = now()
 *   - data_deletion_scheduled_at = now() + 30 days
 *
 * Idempotent: a duplicate webhook delivery sees lifecycle_status already
 * 'cancelled' and the UPDATE no-ops (the WHERE clause filters out terminal
 * states). Returns the resolved client id on success or null when no row
 * matched the guard.
 */
export async function applyStripeCancellation(
  clientId: string,
): Promise<{ ok: true; clientId: string } | { ok: false; reason: string }> {
  const svc = getServiceClient();
  const cancelledAt = new Date();
  const scheduledAt = new Date(cancelledAt);
  scheduledAt.setUTCDate(scheduledAt.getUTCDate() + STAGE_1_GRACE_DAYS);

  // Guard: only flip from a paying / paused state. We refuse to overwrite
  // an already-'cancelled' row's timestamps (so a duplicate webhook
  // doesn't reset the grace clock), and we don't touch 'banned' / 'deleted'
  // (terminal — both should never receive a subscription.deleted in
  // practice, but defensive).
  const { data, error } = await svc
    .from('clients')
    .update({
      lifecycle_status: 'cancelled' as never,
      cancelled_at: cancelledAt.toISOString() as never,
      data_deletion_scheduled_at: scheduledAt.toISOString() as never,
      hard_delete_warning_sent_at: null as never,
    })
    .eq('id', clientId)
    // The cancellation-eligible prior states. We exclude 'cancelled' /
    // 'deleted' / 'banned' / 'pending_verification' / 'churned' so a
    // duplicate webhook can't reset the grace clock and a terminal-state
    // row stays terminal. Cast to `never[]` so the .in() type narrows
    // through the column's generated literal union without complaining.
    .in('lifecycle_status', ['active', 'live', 'paused', 'preview', 'onboarding'] as never[])
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }
  if (!data) {
    // No-op — the row was already cancelled, deleted, banned, or doesn't
    // exist. The webhook caller treats this as success (idempotent).
    return { ok: true, clientId };
  }
  return { ok: true, clientId: (data as { id: string }).id };
}

/**
 * Clear the cancellation state on a reactivation. Called from:
 *   - the Stripe webhook on `subscription.created` if the prior lifecycle
 *     was 'cancelled' (the customer re-subscribed via the portal); flips
 *     'cancelled' → 'active'.
 *   - the /api/clients/[id]/reactivate route as a belt-and-braces clear
 *     after the route initiates Checkout.
 *
 * The lifecycle transition is gated on the prior value being 'cancelled' —
 * we never promote a 'deleted' row back to 'active' via this path (the
 * 'deleted' recovery is an operator-only out-of-band action, since the
 * customer has already lost dashboard access).
 *
 * Returns the resolved state. `ok: true` with `transitioned: false` means
 * the row was found but wasn't eligible for reactivation (e.g. already
 * active, or in 'deleted' state).
 */
export async function reactivateClient(
  clientId: string,
): Promise<
  | { ok: true; transitioned: boolean; clientId: string }
  | { ok: false; reason: string }
> {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('clients')
    .update({
      lifecycle_status: 'active' as never,
      cancelled_at: null as never,
      data_deletion_scheduled_at: null as never,
      hard_delete_warning_sent_at: null as never,
    })
    .eq('id', clientId)
    .eq('lifecycle_status', 'cancelled' as never)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, transitioned: data != null, clientId };
}

/** Time-remaining helper for the cancellation banner. Returns the number of
 *  whole days between now and the scheduled deletion date. Negative when
 *  past due (the cron is about to / already promoted to 'deleted'); zero
 *  on the day. Reads UTC midnight-to-midnight so timezone drift doesn't
 *  add or subtract a day's display. */
export function daysUntilDeletion(scheduledAt: string | null): number | null {
  if (!scheduledAt) return null;
  const parsed = Date.parse(scheduledAt);
  if (Number.isNaN(parsed)) return null;
  const scheduled = new Date(parsed);
  const now = new Date();
  const scheduledDay = Date.UTC(
    scheduled.getUTCFullYear(),
    scheduled.getUTCMonth(),
    scheduled.getUTCDate(),
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((scheduledDay - today) / (1000 * 60 * 60 * 24));
}
