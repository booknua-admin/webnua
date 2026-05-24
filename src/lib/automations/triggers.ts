// =============================================================================
// Automation engine — server-side trigger helpers (Phase 8 Session 1).
//
// Thin facade over engine.onTrigger for application code (Stripe webhook,
// any future server route that needs to fire a trigger). The DB-trigger
// paths fan through `automation_trigger` jobs (handled by job-handlers.ts);
// these helpers are for the few code paths where firing directly from the
// route is cleaner than threading the data through a DB trigger.
//
// SERVER-ONLY.
// =============================================================================

import { onTrigger } from './engine';
import type {
  JobScheduledEvent,
  LeadCreatedEvent,
  PaymentFailedEvent,
  JobCompletedEvent,
  JobStatusChangedEvent,
  LeadInactiveEvent,
} from './engine-types';

/** Lead-created trigger from server code. Note: the leads INSERT DB trigger
 *  in migration 0078 already fans this for every lead row — direct callers
 *  should be rare. */
export async function fireLeadCreated(
  clientId: string,
  event: LeadCreatedEvent,
): Promise<void> {
  await onTrigger(clientId, 'lead_created', event as unknown as Record<string, unknown>);
}

export async function fireJobScheduled(
  clientId: string,
  event: JobScheduledEvent,
): Promise<void> {
  await onTrigger(clientId, 'job_scheduled', event as unknown as Record<string, unknown>);
}

export async function fireJobCompleted(
  clientId: string,
  event: JobCompletedEvent,
): Promise<void> {
  await onTrigger(clientId, 'job_completed', event as unknown as Record<string, unknown>);
}

export async function fireJobStatusChanged(
  clientId: string,
  event: JobStatusChangedEvent,
): Promise<void> {
  await onTrigger(clientId, 'job_status_changed', event as unknown as Record<string, unknown>);
}

/** Payment-failed trigger — called from the Stripe webhook. */
export async function firePaymentFailed(
  clientId: string,
  event: PaymentFailedEvent,
): Promise<void> {
  await onTrigger(clientId, 'payment_failed', event as unknown as Record<string, unknown>);
}

export async function fireLeadInactive(
  clientId: string,
  event: LeadInactiveEvent,
): Promise<void> {
  await onTrigger(clientId, 'lead_inactive', event as unknown as Record<string, unknown>);
}
