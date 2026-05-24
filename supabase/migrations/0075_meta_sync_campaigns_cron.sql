-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · meta_sync_campaigns cron.
--
-- V1 model: Webnua doesn't build Meta campaigns in-app. Campaigns are
-- created by the operator directly in Meta Ads Manager. This cron is what
-- pulls them BACK into Webnua so /campaigns shows them: hourly, per
-- client with a wired ad account, enqueue a `meta_sync_campaigns` job
-- onto the shared integration_jobs queue. The handler (in app code at
-- `src/lib/integrations/meta-ads/job-handlers.ts`) calls
-- /act_{id}/campaigns and upserts public.campaigns + meta_campaigns.
--
-- Sibling of the two schedules in migration 0074 (insights daily, leads
-- every 15min). Inserted under its own jobname so adding a new schedule
-- here doesn't clobber the existing ones.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping meta_sync_campaigns schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_meta_sync_campaigns_hourly')
   where exists (
     select 1 from cron.job where jobname = 'webnua_meta_sync_campaigns_hourly'
   );

  -- Hourly is a balance: campaigns built in Ads Manager appear within
  -- the hour, the per-call cost is one /campaigns API call per
  -- ad account per hour, and the daily insights cron picks up the new
  -- rows on its next tick. A manual "Sync campaigns" affordance fires
  -- the same job immediately when the operator wants visible motion.
  perform cron.schedule(
    'webnua_meta_sync_campaigns_hourly',
    '7 * * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'meta_sync_campaigns',
        jsonb_build_object('clientId', acc.client_id::text),
        'meta_ads',
        now(),
        3,
        acc.client_id,
        acc.client_id::text
      from public.client_meta_ad_accounts acc
      join public.integration_connections ic
        on ic.client_id = acc.client_id
       and ic.provider = 'meta_ads'
       and ic.status   = 'active';
    $cron$
  );
end;
$$;
