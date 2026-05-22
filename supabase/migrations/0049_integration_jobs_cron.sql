-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · integration_jobs poller (pg_cron).
--
-- Every minute, pg_cron dispatches due jobs to the Node executor over HTTP
-- (pg_net) — job handlers are TypeScript and cannot run inside Postgres.
--
-- Dispatch model — a deliberate refinement of the Session 1 brief. The brief
-- said "cron updates jobs to running, then POSTs". This migration does NOT
-- pre-mark jobs 'running'. It POSTs the job id; the executor performs an
-- atomic claim (UPDATE ... WHERE status = 'pending'). Two reasons:
--   1. Race-safety. The cron path and the enqueueJobImmediate path can POST the
--      same job concurrently. Whichever lands first wins the conditional
--      UPDATE; the other is a harmless 200 no-op. If the cron pre-marked
--      'running', the immediate path would need a second coordination check.
--   2. No stranded jobs. If the cron marked 'running' and the POST then failed
--      to land, the job would be stuck 'running' forever. Letting the executor
--      claim means an undispatched job simply stays 'pending' and is retried
--      next minute.
-- Stale 'running' jobs (executor crashed mid-handler, or its result write
-- failed) are reclaimed here after a 10-minute lease.
--
-- Runtime config — executor base URL + shared secret — lives in
-- private.integration_runtime_config: pg_cron runs inside Postgres and cannot
-- read the Node process's env vars. The table holds an internal shared secret
-- in plaintext. Acceptable for V1: it sits in the `private` schema, which
-- PostgREST does not expose and which has no role grants — only service_role /
-- the postgres superuser can read it. Migrate to Supabase Vault alongside the
-- Phase 7 OAuth session (operator decision: Vault deferred this session).
--
-- OPERATOR ACTION REQUIRED post-deploy — see the table comment below.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- --- runtime config ----------------------------------------------------------
-- Single-row table: the boolean primary key with `default true check (id)`
-- makes a second row impossible.
create table private.integration_runtime_config (
  id                  boolean primary key default true check (id),
  -- Absolute origin of the Webnua deployment, e.g. https://app.webnua.com.
  app_base_url        text,
  -- Must equal the INTERNAL_JOB_SECRET env var the Node side reads.
  job_executor_secret text,
  updated_at          timestamptz not null default now()
);

insert into private.integration_runtime_config (id) values (true);

comment on table private.integration_runtime_config is
  'Phase 7 job-poller runtime config. The operator MUST run this once after '
  'deploy, or the poller can reclaim stale jobs but cannot dispatch new ones: '
  'update private.integration_runtime_config set '
  'app_base_url = ''https://app.webnua.com'', '
  'job_executor_secret = ''<same value as the INTERNAL_JOB_SECRET env var>'', '
  'updated_at = now() where id;';

-- --- dispatcher --------------------------------------------------------------
-- SECURITY DEFINER: a poll is a system job; it reaches public.integration_jobs
-- (which has no `authenticated` policies) and private.integration_runtime_config
-- as the definer. Empty search_path per the 0003 hardening convention.
create function private.dispatch_integration_jobs()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_base   text;
  v_secret text;
  v_job    record;
begin
  -- 1. Reclaim stale 'running' jobs — the executor crashed, or its terminal
  --    status write never landed. Lease is 10 minutes. Requeue if attempts
  --    remain, otherwise fail. (attempts was incremented at claim time, so a
  --    reclaimed job does not loop forever.)
  update public.integration_jobs
     set status        = case when attempts >= max_attempts then 'failed'
                              else 'pending' end,
         error_class   = 'lease_expired',
         error_message = 'job execution lease expired (no executor result)',
         run_after     = now(),
         started_at    = null
   where status = 'running'
     and started_at < now() - interval '10 minutes';

  -- 2. Load runtime config. With no config the reclaim above still ran, but
  --    there is nothing to dispatch to.
  select app_base_url, job_executor_secret
    into v_base, v_secret
    from private.integration_runtime_config
   where id;

  if v_base is null or v_secret is null then
    return;
  end if;

  -- 3. Dispatch due pending jobs to the Node executor — fire-and-forget HTTP
  --    via pg_net. The executor performs the atomic claim. A job POSTed twice
  --    (cron + immediate) is safe: the second claim matches zero rows.
  for v_job in
    select id from public.integration_jobs
     where status = 'pending'
       and run_after <= now()
     order by run_after
     limit 100
  loop
    perform net.http_post(
      url := v_base || '/api/internal/job-executor',
      body := jsonb_build_object('jobId', v_job.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webnua-internal-secret', v_secret
      ),
      timeout_milliseconds := 10000
    );
  end loop;
end;
$$;

revoke all on function private.dispatch_integration_jobs() from public;

-- --- schedule ----------------------------------------------------------------
-- Every minute. Guarded so re-applying the migration re-creates the job
-- cleanly rather than erroring on a duplicate jobname.
do $$
begin
  perform cron.unschedule('webnua-integration-jobs-poll');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'webnua-integration-jobs-poll',
  '* * * * *',
  $$select private.dispatch_integration_jobs()$$
);
