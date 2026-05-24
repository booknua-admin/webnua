-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · cron + realtime.
--
-- Two pg_cron schedules:
--
-- 1. webnua_meta_sync_insights_daily — once a day at 04:00 UTC, enqueue one
--    `meta_sync_insights` job per active meta_campaigns row. The job
--    handler fetches yesterday's insights via the Meta API + upserts into
--    meta_ads_insights. Polling (not webhooks) because Meta insights are
--    aggregated by Meta — there is no per-impression push to subscribe to.
--
-- 2. webnua_meta_sync_leads_quarter_hour — every 15 minutes, enqueue one
--    `meta_sync_leads` job per active meta_campaigns row that has a
--    meta_lead_form_id. The job handler fetches leads created since the
--    last sync via the form's /leads endpoint + inserts into public.leads
--    with source_kind='meta'.
--
-- Both crons enqueue ONE job per active campaign — the per-job rate limit
-- helps stay under Meta's per-app token bucket. Jobs are idempotent (the
-- insights upsert is keyed on (meta_campaign_id, date_recorded); the lead
-- insert dedupes against meta_lead_id).
--
-- Realtime publication — meta_campaigns + meta_ads_insights so the
-- /campaigns surface refreshes when a sync completes (consistent with the
-- GBP pattern in 0069).
-- =============================================================================

-- --- 1. daily insights cron --------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping meta_sync_insights schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_meta_sync_insights_daily')
   where exists (select 1 from cron.job where jobname = 'webnua_meta_sync_insights_daily');

  -- 04:00 UTC daily. One job per active campaign on a client whose Meta
  -- token is still active (an expired connection means the sync would
  -- 401-then-fail-refresh anyway, so don't bother enqueueing).
  perform cron.schedule(
    'webnua_meta_sync_insights_daily',
    '0 4 * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'meta_sync_insights',
        jsonb_build_object(
          'clientId',       mc.client_id::text,
          'metaCampaignId', mc.id::text
        ),
        'meta_ads',
        now(),
        3,
        mc.client_id,
        mc.id::text
      from public.meta_campaigns mc
      join public.integration_connections ic
        on ic.client_id = mc.client_id
       and ic.provider  = 'meta_ads'
       and ic.status    = 'active'
      where mc.status in ('active', 'in_review', 'with_issues');
    $cron$
  );
end;
$$;

-- --- 2. quarter-hour leads sync cron ----------------------------------------

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping meta_sync_leads schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_meta_sync_leads_quarter_hour')
   where exists (select 1 from cron.job where jobname = 'webnua_meta_sync_leads_quarter_hour');

  -- Every 15 minutes. Lead-form polling has to be timely — a lead landing
  -- via the Meta form should reach the operator within ~quarter-hour so
  -- the lead-acknowledgment SMS feels prompt to the customer. Only
  -- campaigns with a wired-up lead form qualify.
  perform cron.schedule(
    'webnua_meta_sync_leads_quarter_hour',
    '*/15 * * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'meta_sync_leads',
        jsonb_build_object(
          'clientId',       mc.client_id::text,
          'metaCampaignId', mc.id::text,
          'metaLeadFormId', lf.id::text,
          'metaFormId',     lf.meta_form_id
        ),
        'meta_ads',
        now(),
        3,
        mc.client_id,
        mc.id::text
      from public.meta_campaigns mc
      join public.meta_lead_forms lf on lf.id = mc.meta_lead_form_id
      join public.integration_connections ic
        on ic.client_id = mc.client_id
       and ic.provider  = 'meta_ads'
       and ic.status    = 'active'
      where mc.status in ('active', 'with_issues')
        and lf.archived_at is null;
    $cron$
  );
end;
$$;

-- --- 3. realtime publication --------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.meta_campaigns;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.meta_ads_insights;
  exception when duplicate_object then null; end;
end;
$$;
