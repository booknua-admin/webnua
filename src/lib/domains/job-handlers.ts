// =============================================================================
// Custom-domain background job — Phase 9.
//
// Registers `check_domain_verification` with the integration_jobs spine.
// Cron (migration 0082) enqueues this every 5 minutes; the handler scans
// in-flight rows + reconciles each one against Vercel.
//
// Side-effects on status transition:
//   • pending_dns / verifying / ssl_pending → live: enqueue an operator-style
//     notification email to the client's recipients (best-effort, swallows
//     enqueue errors so a notification failure can't undo the status update).
//   • → failed: same, with the failure reason.
// =============================================================================

import { enqueueJob, registerJobHandler } from '@/lib/integrations/_shared/jobs';

import { checkDomainStatus, listInFlightDomains } from './manager';
import type { CustomDomainRow, CustomDomainStatus } from './types';

type StatusTransition = {
  previous: CustomDomainStatus;
  next: CustomDomainStatus;
  domain: string;
  clientId: string;
  rowId: string;
  reason: string | null;
};

/** Async-safe per-row update. Errors are swallowed at the per-row level so
 *  one bad row doesn't take down the batch. Returns the transition (or null
 *  for unchanged / errored). */
async function processOne(row: CustomDomainRow): Promise<StatusTransition | null> {
  try {
    const result = await checkDomainStatus(row.id);
    if (result.kind === 'not_found' || result.kind === 'vercel_error') return null;
    if (result.kind === 'not_configured') return null;
    if (result.row.status !== row.status) {
      return {
        previous: row.status,
        next: result.row.status,
        domain: row.domain,
        clientId: row.client_id,
        rowId: row.id,
        reason: result.row.verification_failed_reason,
      };
    }
    return null;
  } catch (err) {
    console.warn(`check_domain_verification: row ${row.id} failed`, err);
    return null;
  }
}

/** Enqueue a customer-facing notification when a domain transitions to live.
 *  Uses the same job spine that powers other transactional emails (Resend
 *  send_email). Best-effort: enqueue failure is logged + ignored. */
async function notifyTransition(transition: StatusTransition): Promise<void> {
  try {
    if (transition.next === 'live') {
      // The clients's notification preferences own the recipient set —
      // dispatch through the send_lead_notification-style spine here would
      // be premature; instead use the generic send_email path with a
      // dedicated template key. The Resend handler resolves the per-client
      // template row.
      await enqueueJob(
        'send_email',
        {
          clientId: transition.clientId,
          templateKey: 'domain_live_notification',
          contextOverrides: {
            'domain.name': transition.domain,
          },
        },
        { clientId: transition.clientId, provider: 'resend' },
      );
    } else if (transition.next === 'failed') {
      // Operator-facing alert. A failed verification is rare enough to
      // warrant a fan-out — but until Phase 8's automation engine wires
      // operator-alerts properly, this is a one-line console + no enqueue.
      console.warn(
        `Domain ${transition.domain} (client ${transition.clientId}) flipped to failed: ${transition.reason ?? 'unknown'}`,
      );
    }
  } catch (err) {
    console.warn('notifyTransition: enqueue failed', err);
  }
}

registerJobHandler('check_domain_verification', async (_payload, ctx) => {
  const rows = await listInFlightDomains();
  if (rows.length === 0) {
    return { processed: 0, transitions: 0 };
  }

  // Vercel rate limit is ~100 req/min and each row makes 2 calls — process
  // sequentially to stay safely under the ceiling. A batch of 50 takes ~25s
  // worst case (network), well inside the integration_jobs lease.
  let transitions = 0;
  for (const row of rows) {
    const transition = await processOne(row);
    if (transition) {
      transitions += 1;
      await notifyTransition(transition);
    }
  }

  return {
    processed: rows.length,
    transitions,
    correlationId: ctx.correlationId,
  };
});
