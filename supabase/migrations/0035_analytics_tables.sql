-- =============================================================================
-- Webnua backend — visitor-engagement analytics.
--
-- Implements reference/visitor-tracking-design.md §3 (data model), §6
-- (aggregation), §8 (lead correlation). Builds the *top* of the conversion
-- funnel — the visitor-behaviour signals (view → scroll → click → form-start
-- → abandon → submit) that today render `—` placeholders on the dashboard.
-- The bottom (lead → booked → reviewed) is already real (`leads` / `bookings`
-- / `reviews`); the read layer merges the two.
--
-- Trust model:
--   • Raw events are written ONLY by the public /api/track endpoint with the
--     service-role key — `anon` gets NO access to any analytics table (not
--     even insert; granting it would defeat tenant isolation).
--   • `authenticated` gets SELECT only, scoped by accessible_client_ids().
--   • The rollups are written by a SECURITY DEFINER aggregation function on
--     an hourly pg_cron schedule.
-- =============================================================================

-- --- event-type enum ---------------------------------------------------------

create type analytics_event_type as enum (
  'page_view',
  'scroll_depth',
  'element_click',
  'form_start',
  'form_field',
  'form_abandon',
  'form_submit',
  'web_vital'
);

-- --- analytics_events — raw append-only stream -------------------------------
-- One row per tracked visitor interaction. `client_id` is denormalised so RLS
-- can scope without a join. `occurred_at` is the client clock (validated for
-- skew at the ingest endpoint); `ingested_at` is the server clock.
create table public.analytics_events (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  surface_kind text not null check (surface_kind in ('website', 'funnel')),
  surface_id   uuid not null,
  page_ref     text not null,
  event_type   analytics_event_type not null,
  visitor_id   text not null,
  session_id   text not null,
  occurred_at  timestamptz not null,
  payload      jsonb not null default '{}',
  ingested_at  timestamptz not null default now()
);

create index analytics_events_client_surface_idx
  on public.analytics_events (client_id, surface_id, occurred_at);
create index analytics_events_session_idx
  on public.analytics_events (surface_id, session_id);
create index analytics_events_day_idx
  on public.analytics_events (occurred_at);

-- --- rollup tables -----------------------------------------------------------
-- Reads go against pre-aggregated daily rollups (raw events grow fast and cost
-- per row). The raw table is prunable on a retention window; the rollups are
-- tiny and kept forever.

create table public.analytics_funnel_daily (
  client_id       uuid not null references public.clients (id) on delete cascade,
  surface_kind    text not null,
  surface_id      uuid not null,
  day             date not null,
  stage           text not null,
  event_count     integer not null default 0,
  unique_visitors integer not null default 0,
  primary key (surface_id, day, stage)
);
create index analytics_funnel_daily_client_idx
  on public.analytics_funnel_daily (client_id, day);

create table public.analytics_page_daily (
  client_id       uuid not null references public.clients (id) on delete cascade,
  surface_id      uuid not null,
  page_ref        text not null,
  day             date not null,
  visits          integer not null default 0,
  unique_visitors integer not null default 0,
  avg_seconds     numeric,
  lcp_p75         numeric,
  cls_p75         numeric,
  inp_p75         numeric,
  primary key (surface_id, page_ref, day)
);
create index analytics_page_daily_client_idx
  on public.analytics_page_daily (client_id, day);

-- --- RLS ---------------------------------------------------------------------
-- SELECT-only for `authenticated`, tenant-scoped. The 0018 default-privilege
-- grant hands `authenticated` full DML on every new public table; analytics
-- tables are read-only to the app, so the write privileges are revoked. RLS
-- still gates SELECT; `service_role` keeps full access (it does the writes).

alter table public.analytics_events enable row level security;
alter table public.analytics_funnel_daily enable row level security;
alter table public.analytics_page_daily enable row level security;

revoke insert, update, delete on public.analytics_events from authenticated;
revoke insert, update, delete on public.analytics_funnel_daily from authenticated;
revoke insert, update, delete on public.analytics_page_daily from authenticated;

create policy analytics_events_select on public.analytics_events
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

create policy analytics_funnel_daily_select on public.analytics_funnel_daily
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

create policy analytics_page_daily_select on public.analytics_page_daily
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- --- tracking_key columns ----------------------------------------------------
-- A public, non-secret per-surface token the tracking script embeds; the
-- ingest endpoint resolves it to (client_id, surface_id, surface_kind) and
-- rejects events for unknown surfaces. Not an auth secret.

alter table public.websites
  add column tracking_key text not null
    default replace(gen_random_uuid()::text, '-', '');
alter table public.funnels
  add column tracking_key text not null
    default replace(gen_random_uuid()::text, '-', '');

create unique index websites_tracking_key_idx on public.websites (tracking_key);
create unique index funnels_tracking_key_idx on public.funnels (tracking_key);

-- --- per-client consent mode -------------------------------------------------
-- `banner` shows a consent banner and gates non-essential tracking on accept;
-- `implied` tracks on load. Per-account (a client has one consent posture).
alter table public.clients
  add column tracking_consent_mode text not null default 'banner'
    check (tracking_consent_mode in ('banner', 'implied'));

-- --- lead correlation (design §8) --------------------------------------------
-- A public form submission carries a generated submission_id; it is stored on
-- the lead AND on the `form_submit` analytics event, so the read layer can
-- reconcile the tracked count against the source-of-truth `leads` count.
alter table public.leads add column submission_id uuid;
create index leads_submission_id_idx on public.leads (submission_id)
  where submission_id is not null;

-- --- aggregation -------------------------------------------------------------
-- Rolls raw events into the two daily tables. Re-aggregates today + yesterday
-- each run (beaconed / late events arrive after the hour boundary; the upsert
-- on the rollup pk makes re-runs idempotent). SECURITY DEFINER — a rollup is a
-- system job, it bypasses the SELECT-only RLS. Also prunes raw events past the
-- 90-day retention window.

create function private.aggregate_analytics()
  returns void
  language plpgsql
  security definer
  set search_path = public, private
as $$
declare
  d date;
begin
  for d in select generate_series(
    (current_date - interval '1 day')::date, current_date, interval '1 day'
  )::date
  loop
    -- funnel rollup: one row per (surface, day, stage).
    delete from public.analytics_funnel_daily where day = d;
    insert into public.analytics_funnel_daily
      (client_id, surface_kind, surface_id, day, stage, event_count, unique_visitors)
    select client_id, surface_kind, surface_id, d, stage,
           count(*)::int, count(distinct visitor_id)::int
    from (
      select client_id, surface_kind, surface_id, visitor_id,
        case
          when event_type = 'page_view' then 'landing'
          when event_type = 'scroll_depth'
            and coalesce((payload->>'depth')::int, 0) >= 50 then 'engaged'
          when event_type = 'element_click' then 'cta_click'
          when event_type = 'form_start' then 'form_started'
          when event_type = 'form_submit' then 'form_submitted'
        end as stage
      from public.analytics_events
      where occurred_at >= d and occurred_at < d + interval '1 day'
    ) staged
    where stage is not null
    group by client_id, surface_kind, surface_id, stage;

    -- page rollup: per (surface, page, day) — visits, dwell, Web Vitals p75.
    delete from public.analytics_page_daily where day = d;
    insert into public.analytics_page_daily
      (client_id, surface_id, page_ref, day, visits, unique_visitors,
       avg_seconds, lcp_p75, cls_p75, inp_p75)
    select v.client_id, v.surface_id, v.page_ref, d,
           v.visits, v.unique_visitors, dw.avg_seconds,
           wv.lcp_p75, wv.cls_p75, wv.inp_p75
    from (
      select client_id, surface_id, page_ref,
             count(*) filter (where event_type = 'page_view')::int as visits,
             count(distinct visitor_id)
               filter (where event_type = 'page_view')::int as unique_visitors
      from public.analytics_events
      where occurred_at >= d and occurred_at < d + interval '1 day'
      group by client_id, surface_id, page_ref
    ) v
    left join (
      -- per-session dwell on a page = last event − first event, averaged.
      select surface_id, page_ref,
             avg(extract(epoch from (max_t - min_t))) as avg_seconds
      from (
        select surface_id, page_ref, session_id,
               min(occurred_at) as min_t, max(occurred_at) as max_t
        from public.analytics_events
        where occurred_at >= d and occurred_at < d + interval '1 day'
        group by surface_id, page_ref, session_id
      ) s
      group by surface_id, page_ref
    ) dw on dw.surface_id = v.surface_id and dw.page_ref = v.page_ref
    left join (
      select surface_id, page_ref,
        percentile_cont(0.75) within group (
          order by (payload->>'value')::numeric)
          filter (where payload->>'name' = 'LCP') as lcp_p75,
        percentile_cont(0.75) within group (
          order by (payload->>'value')::numeric)
          filter (where payload->>'name' = 'CLS') as cls_p75,
        percentile_cont(0.75) within group (
          order by (payload->>'value')::numeric)
          filter (where payload->>'name' = 'INP') as inp_p75
      from public.analytics_events
      where occurred_at >= d and occurred_at < d + interval '1 day'
        and event_type = 'web_vital'
      group by surface_id, page_ref
    ) wv on wv.surface_id = v.surface_id and wv.page_ref = v.page_ref;
  end loop;

  -- retention: prune raw events past 90 days. Rollups are kept forever.
  delete from public.analytics_events
  where occurred_at < now() - interval '90 days';
end;
$$;

revoke all on function private.aggregate_analytics() from public;

-- --- schedule ----------------------------------------------------------------
-- Hourly rollup via pg_cron. Guarded so re-applying the migration re-creates
-- the job cleanly rather than erroring on a duplicate jobname.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('webnua-analytics-rollup');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'webnua-analytics-rollup',
  '7 * * * *',
  $$select private.aggregate_analytics()$$
);
