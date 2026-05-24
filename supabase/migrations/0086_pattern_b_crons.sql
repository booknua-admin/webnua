-- =============================================================================
-- Webnua backend — Pattern B onboarding · scheduled cleanup + re-engagement.
--
-- Three pg_cron jobs:
--
--   (a) webnua_pending_verification_sweep
--       Daily 03:00 UTC. DELETE clients where lifecycle_status =
--       'pending_verification' AND created_at < (now() - 7 days). Cascades:
--       clients FK -> users (set null, but lifecycle_status='pending' has no
--       users tied to them yet — the magic-link click is what creates the
--       public.users row), brands/sites/funnels (cascade delete via their
--       client_id FKs). The matching auth.users row is orphaned and is
--       cleaned up by Supabase's own retention OR an operator runs a
--       separate cleanup via the admin console; we do not delete auth rows
--       from app code (RLS would refuse anyway, and Supabase manages
--       auth.users lifecycle independently).
--
--   (b) webnua_rate_limit_sweep
--       Daily 04:00 UTC. DELETE rate_limit_hits older than 7 days. The
--       runtime checks query 1-24-hour windows, so 7 days is enough audit
--       headroom for the operator dashboard's "recent blocks" view.
--
--   (c) webnua_re_engagement_scan
--       Daily 09:00 UTC. Enqueue ONE send_re_engagement_email integration_jobs
--       row per eligible client. "Eligible" = lifecycle_status='preview' AND
--       created_at < (now() - 7 days) AND re_engagement_sent_at IS NULL. The
--       job handler (lib/auth/re-engagement-email.ts) does the send + stamps
--       re_engagement_sent_at so the next scan skips them. Send-once-per-
--       client semantics — a client who lapses, publishes, then lapses again
--       does NOT get a second nudge (the cron's WHERE clause filters on
--       re_engagement_sent_at IS NULL; operator can NULL it manually if a
--       second nudge is wanted).
--
-- pg_cron not installed in dev → each `do` block early-returns with a
-- notice. Same shape as 0082.
-- =============================================================================

-- --- (a) pending verification sweep -----------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping pending_verification_sweep schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_pending_verification_sweep')
   where exists (select 1 from cron.job where jobname = 'webnua_pending_verification_sweep');

  perform cron.schedule(
    'webnua_pending_verification_sweep',
    '0 3 * * *',  -- daily at 03:00 UTC
    $cron$
      delete from public.clients
      where lifecycle_status = 'pending_verification'
        and created_at < (now() - interval '7 days');
    $cron$
  );
end $$;

-- --- (b) rate_limit_hits sweep ----------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping rate_limit_sweep schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_rate_limit_sweep')
   where exists (select 1 from cron.job where jobname = 'webnua_rate_limit_sweep');

  perform cron.schedule(
    'webnua_rate_limit_sweep',
    '0 4 * * *',  -- daily at 04:00 UTC
    $cron$
      delete from public.rate_limit_hits
      where occurred_at < (now() - interval '7 days');
    $cron$
  );
end $$;

-- --- (c) re-engagement scan -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping re_engagement_scan schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_re_engagement_scan')
   where exists (select 1 from cron.job where jobname = 'webnua_re_engagement_scan');

  perform cron.schedule(
    'webnua_re_engagement_scan',
    '0 9 * * *',  -- daily at 09:00 UTC
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'send_re_engagement_email',
        jsonb_build_object('client_id', c.id),
        'resend',
        now(),
        2,
        c.id,
        gen_random_uuid()::text
      from public.clients c
      where c.lifecycle_status = 'preview'
        and c.created_at < (now() - interval '7 days')
        and c.re_engagement_sent_at is null;
    $cron$
  );
end $$;
