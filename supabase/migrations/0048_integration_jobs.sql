-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · integration_jobs.
--
-- The async-work queue for every Phase 7 integration. A job is a unit of
-- deferred / retryable work — send an SMS, sync a Stripe customer, refresh an
-- OAuth token. Enqueued by src/lib/integrations/_shared/jobs.ts; dispatched by
-- the pg_cron poller (migration 0049) and by enqueueJobImmediate; executed by
-- the /api/internal/job-executor route.
--
-- Architecture (operator-locked): a polled jobs TABLE — NOT Edge Functions,
-- NOT Vercel Cron, NOT an external queue. The poll runs inside Postgres
-- (pg_cron); execution runs in Node (the route handler) because job handlers
-- are TypeScript.
--
-- Trust model: this is an internal infrastructure table. NEITHER operators nor
-- client users get ANY access — RLS is enabled with zero policies and every
-- `authenticated` privilege (SELECT included) is revoked outright, so the
-- table never surfaces to a signed-in session. Only service_role — the
-- executor and the enqueue helpers — touches it; service_role bypasses RLS.
-- =============================================================================

create table public.integration_jobs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  -- The job becomes dispatchable once run_after has passed (deferred + backoff).
  run_after      timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  status         text not null default 'pending'
                   check (status in
                     ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempts       integer not null default 0,
  max_attempts   integer not null default 3,
  provider       text,
  job_type       text not null,
  payload        jsonb not null default '{}',
  result         jsonb,
  error_message  text,
  error_class    text,
  client_id      uuid references public.clients (id) on delete set null,
  correlation_id uuid
);

-- The poller's hot path: pending jobs whose run_after has passed. Partial index
-- so it stays tiny — completed/failed history does not bloat it.
create index integration_jobs_poll_idx
  on public.integration_jobs (run_after)
  where status = 'pending';
-- Stale-running reclaim (the poller resets jobs whose executor lease expired).
create index integration_jobs_running_idx
  on public.integration_jobs (started_at)
  where status = 'running';
create index integration_jobs_correlation_idx
  on public.integration_jobs (correlation_id)
  where correlation_id is not null;

-- --- RLS ---------------------------------------------------------------------
-- Internal infrastructure: no operator, no client access. RLS on with zero
-- policies denies `authenticated`; the 0018 DML grant is revoked outright
-- (SELECT included) so the table is fully invisible to any signed-in session.
alter table public.integration_jobs enable row level security;
revoke all on public.integration_jobs from authenticated;
