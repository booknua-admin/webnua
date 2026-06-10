-- =============================================================================
-- Webnua backend — Ads autopilot · anomaly flags + daily detection cron.
--
-- Phase 7.5 Sessions 2-3 (previously parked). A daily scan over
-- meta_ads_insights compares each active campaign's recent performance to
-- its own baseline and writes a flag per anomaly:
--
--   cpl_spike        — yesterday+2d CPL ≥ 1.5× the prior-7-day baseline
--   lead_drought     — 3+ days of spend with zero leads
--   spend_not_pacing — delivering well under the daily budget (limited
--                      delivery / creative fatigue signal)
--   meta_issue       — Meta-side effective status is with_issues
--   performing_well  — CPL well under baseline while fully pacing — the
--                      "budget increase drafted" positive case
--
-- Flags persist day-to-day (the queue is exception-based, not a recomputed
-- dashboard); the handler keeps ONE open flag per (campaign, type) and
-- resolves flags whose condition cleared. Each open flag fans a
-- suggested_actions card (migration 0119) with a plain-English
-- recommendation the operator/owner approves — pause, budget change, or
-- acknowledge.
-- =============================================================================

do $$ begin
  create type public.meta_campaign_flag_type as enum (
    'cpl_spike',
    'lead_drought',
    'spend_not_pacing',
    'meta_issue',
    'performing_well'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.meta_campaign_flags (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  meta_campaign_db_id uuid not null references public.meta_campaigns(id) on delete cascade,
  flag_type           public.meta_campaign_flag_type not null,
  status              text not null default 'open' check (status in ('open', 'resolved')),
  -- The numbers behind the flag — baseline CPL, observed CPL, spend, leads —
  -- so the card's plain-English body is auditable.
  metrics             jsonb not null default '{}'::jsonb,
  detected_at         timestamptz not null default now(),
  resolved_at         timestamptz
);

create unique index if not exists meta_campaign_flags_one_open
  on public.meta_campaign_flags (meta_campaign_db_id, flag_type)
  where status = 'open';

create index if not exists meta_campaign_flags_client_idx
  on public.meta_campaign_flags (client_id, status, detected_at desc);

alter table public.meta_campaign_flags enable row level security;
revoke insert, update, delete on public.meta_campaign_flags from authenticated;

create policy meta_campaign_flags_select on public.meta_campaign_flags
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- --- daily detection cron ----------------------------------------------------
-- 06:30 UTC — after the 04:00 insights sync, so yesterday's numbers are in.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping meta_detect_anomalies schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_meta_detect_anomalies_daily')
   where exists (
     select 1 from cron.job where jobname = 'webnua_meta_detect_anomalies_daily'
   );

  perform cron.schedule(
    'webnua_meta_detect_anomalies_daily',
    '30 6 * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'meta_detect_anomalies',
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
       and ic.status   = 'active'
      where exists (
        select 1 from public.meta_campaigns mc
        where mc.client_id = acc.client_id
      );
    $cron$
  );
end;
$$;
