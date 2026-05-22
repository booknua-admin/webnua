// =============================================================================
// Async jobs — enqueue, handler registry, and the executor body.
//
// Phase 7 Session 1. The integration_jobs table (migration 0048) is the queue;
// the pg_cron poller (0049) dispatches; this module is the Node side:
//   • enqueueJob          — insert a job row, return its id.
//   • enqueueJobImmediate — enqueue + fire-and-forget POST to the executor so
//                           the job runs near-instantly on the happy path;
//                           pg_cron remains the safety net if that POST fails.
//   • registerJobHandler  — an integration registers what processes a job_type.
//   • runJob              — the executor body: atomic claim → run handler →
//                           write the terminal status. Called by the
//                           /api/internal/job-executor route.
//
// SERVER-ONLY — uses the service-role client and reads server env.
// =============================================================================

import { env, getAppBaseUrl } from '@/lib/env';

import { getIntegrationDb, type IntegrationJobInsert, type IntegrationJobRow } from './db-types';
import { computeBackoffDelay, DEFAULT_RETRY_CONFIG } from './retry';

// --- handler registry --------------------------------------------------------

/** Context passed to every job handler — identifies the run and the tenant. */
export type JobContext = {
  jobId: string;
  jobType: string;
  /** This run's attempt number (1-indexed, includes the current run). */
  attempts: number;
  maxAttempts: number;
  clientId: string | null;
  correlationId: string | null;
};

/** A job handler. The returned value is stored on integration_jobs.result.
 *  Throwing signals failure — runJob requeues (with backoff) or fails the job
 *  depending on attempts remaining. */
export type JobHandler = (payload: unknown, ctx: JobContext) => Promise<unknown>;

// Module-level registry. Populated by side-effect imports collected in
// src/lib/integrations/job-handler-manifest.ts, which the executor route
// imports — so registrations are present in the executor's module graph.
const handlers = new Map<string, JobHandler>();

/** Register the handler for a job type. Throws on a duplicate registration —
 *  two handlers for one job_type is a programmer error. */
export function registerJobHandler(jobType: string, handler: JobHandler): void {
  if (handlers.has(jobType)) {
    throw new Error(`registerJobHandler: duplicate handler for job type "${jobType}"`);
  }
  handlers.set(jobType, handler);
}

/** The registered handler for a job type, or undefined. */
export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType);
}

// --- enqueue -----------------------------------------------------------------

export type EnqueueOptions = {
  /** Provider slug recorded on the row (telemetry). */
  provider?: string;
  /** Defer the job — it becomes dispatchable once run_after passes. */
  runAfter?: Date;
  /** Total attempts before the job is failed. Defaults to 3. */
  maxAttempts?: number;
  /** Tenant attribution. */
  clientId?: string | null;
  /** Trace id linking the job to related calls/jobs. */
  correlationId?: string;
};

/** Insert a job row. Returns the new job id. The pg_cron poller picks it up
 *  within ~1 minute (or sooner — see enqueueJobImmediate). */
export async function enqueueJob(
  jobType: string,
  payload: unknown,
  options: EnqueueOptions = {},
): Promise<string> {
  const row: IntegrationJobInsert = {
    job_type: jobType,
    payload: payload ?? {},
    provider: options.provider ?? null,
    run_after: (options.runAfter ?? new Date()).toISOString(),
    max_attempts: options.maxAttempts ?? 3,
    client_id: options.clientId ?? null,
    correlation_id: options.correlationId ?? null,
  };
  const { data, error } = await getIntegrationDb()
    .from('integration_jobs')
    .insert(row)
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`enqueueJob: insert failed — ${error?.message ?? 'no row returned'}`);
  }
  return (data as { id: string }).id;
}

/** Like enqueueJob, but also fire-and-forget POSTs the executor so the job runs
 *  within a couple of seconds on the happy path. The POST is best-effort: if it
 *  fails (executor down, secret unset), the pg_cron poller still picks the job
 *  up next minute. */
export async function enqueueJobImmediate(
  jobType: string,
  payload: unknown,
  options: EnqueueOptions = {},
): Promise<string> {
  const jobId = await enqueueJob(jobType, payload, options);
  void dispatchToExecutor(jobId);
  return jobId;
}

async function dispatchToExecutor(jobId: string): Promise<void> {
  const secret = env.INTERNAL_JOB_SECRET;
  const base = getAppBaseUrl();
  if (!secret || !base) {
    // Not configured for self-dispatch — pg_cron is the dispatch path.
    return;
  }
  try {
    await fetch(`${base}/api/internal/job-executor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webnua-internal-secret': secret,
      },
      body: JSON.stringify({ jobId }),
    });
  } catch (error) {
    // The job is already enqueued; pg_cron will dispatch it. Just note it.
    console.warn('[jobs] immediate dispatch failed; pg_cron will retry', error);
  }
}

// --- executor body -----------------------------------------------------------

/** The outcome of a runJob call. `claimed: false` = another dispatcher already
 *  has the job, or it is no longer pending — a harmless no-op. */
export type RunJobOutcome =
  | { claimed: false }
  | { claimed: true; jobId: string; status: 'completed' | 'failed' | 'requeued' };

/**
 * Process one job by id. Atomically claims it (UPDATE ... WHERE pending), runs
 * its handler, then writes the terminal status. The atomic claim makes the
 * cron and enqueueJobImmediate dispatch paths race-safe — exactly one caller
 * claims a given job; the rest are no-ops.
 *
 * On handler failure the job is requeued with exponential backoff while
 * attempts remain, then failed.
 */
export async function runJob(jobId: string): Promise<RunJobOutcome> {
  const db = getIntegrationDb();

  // Read the job. attempts is needed to compute the claim's attempt number.
  const { data: jobData, error: readError } = await db
    .from('integration_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (readError || !jobData) return { claimed: false };
  const job = jobData as IntegrationJobRow;
  if (job.status !== 'pending') return { claimed: false };

  // Atomic claim — conditional on the job still being 'pending'. If a
  // concurrent dispatcher already claimed it, this matches zero rows.
  const claimAttempts = job.attempts + 1;
  const { data: claimedData } = await db
    .from('integration_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      attempts: claimAttempts,
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (!claimedData) return { claimed: false };
  const claimed = claimedData as IntegrationJobRow;

  const ctx: JobContext = {
    jobId,
    jobType: claimed.job_type,
    attempts: claimAttempts,
    maxAttempts: claimed.max_attempts,
    clientId: claimed.client_id,
    correlationId: claimed.correlation_id,
  };

  const handler = getJobHandler(claimed.job_type);
  if (!handler) {
    await db
      .from('integration_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_class: 'no_handler',
        error_message: `no handler registered for job type "${claimed.job_type}"`,
      })
      .eq('id', jobId);
    return { claimed: true, jobId, status: 'failed' };
  }

  try {
    const result = await handler(claimed.payload, ctx);
    await db
      .from('integration_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: jsonSafeResult(result),
        error_class: null,
        error_message: null,
      })
      .eq('id', jobId);
    return { claimed: true, jobId, status: 'completed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (claimAttempts >= claimed.max_attempts) {
      await db
        .from('integration_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_class: 'handler_error',
          error_message: message,
        })
        .eq('id', jobId);
      return { claimed: true, jobId, status: 'failed' };
    }
    // Requeue with backoff. started_at is cleared so the poller's stale-running
    // reclaim does not also fire on this row.
    const delayMs = computeBackoffDelay(claimAttempts, DEFAULT_RETRY_CONFIG);
    await db
      .from('integration_jobs')
      .update({
        status: 'pending',
        started_at: null,
        run_after: new Date(Date.now() + delayMs).toISOString(),
        error_class: 'handler_error',
        error_message: message,
      })
      .eq('id', jobId);
    return { claimed: true, jobId, status: 'requeued' };
  }
}

/** Coerce a handler's return value to something jsonb-safe for the result
 *  column. undefined and unserialisable values become null. */
function jsonSafeResult(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}
