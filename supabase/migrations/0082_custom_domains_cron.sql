-- =============================================================================
-- Webnua backend — Phase 9 · custom-domain verification cron.
--
-- Every 5 minutes, enqueue one `check_domain_verification` job that runs the
-- in-app handler against Vercel for any row whose status is in-flight
-- (pending_dns / verifying / ssl_pending). Batch size is controlled
-- application-side (DOMAIN_CHECK_BATCH_SIZE, default 50) — Vercel rate limits
-- run around 100 req/min per account, so a 5-minute cadence × 50 row batch ×
-- 2 calls per row (getDomain + getDomainConfig) sits well under the ceiling.
--
-- The job payload is empty (the handler reads the in-flight rows itself); a
-- single job per tick is enough — the handler processes them in one batch.
-- Realtime publication so client + operator UIs refresh when a status moves.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping check_domain_verification schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_check_domain_verification')
   where exists (select 1 from cron.job where jobname = 'webnua_check_domain_verification');

  -- Every 5 minutes. One job per tick — the handler reads the in-flight rows
  -- in one batched scan rather than spawning N jobs.
  perform cron.schedule(
    'webnua_check_domain_verification',
    '*/5 * * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'check_domain_verification',
        '{}'::jsonb,
        'vercel',
        now(),
        2,
        null,
        gen_random_uuid()::text
      where exists (
        select 1 from public.client_custom_domains
        where status in ('pending_dns', 'verifying', 'ssl_pending')
      );
    $cron$
  );
end $$;

-- --- realtime publication ---------------------------------------------------
-- Add client_custom_domains to the realtime publication so the client +
-- operator UIs refresh when the polling job moves a row's status. Wrapped in
-- a duplicate-tolerant DO block (same pattern as 0046).

do $$
begin
  alter publication supabase_realtime add table public.client_custom_domains;
exception
  when duplicate_object then
    null;
end $$;
