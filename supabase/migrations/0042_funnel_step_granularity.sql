-- =============================================================================
-- Webnua backend — funnel rollup step granularity.
--
-- Closes analytics-audit §2.2 / §2.6 + the CLAUDE.md parked decision "Funnel
-- analytics gaps that remain after lead threading":
--
--   • `analytics_funnel_daily` PK was `(surface_id, day, stage, element_label)`
--     after migration 0041. A funnel surface's step 1 (slug = '') and step 2
--     (slug = 'qualify') page_views both rolled up into one `landing` row, so
--     step-by-step drop-off was structurally lost in the rollup. This migration
--     extends the PK with `page_ref` and the aggregator's GROUP BY to match —
--     each event now contributes to a per-step row.
--
--   • Sentinel convention: empty string `''` for events that are not
--     step-scoped. In practice every event currently lands on a page (the
--     `analytics_events.page_ref` column is NOT NULL), so the empty-string
--     case applies only to legacy rows; same convention as `element_label`.
--
--   • For website surfaces (typically a single page_ref per surface),
--     summing across page_refs reproduces the pre-migration totals — so the
--     existing read paths in `fetchSurfaceFunnelTotals` continue to work
--     unchanged for websites without any per-step axis.
--
-- The 90-day raw-event retention window means existing raw events back-fill
-- on the next aggregator tick. The rollup table is empty at apply time (no
-- public traffic yet — confirmed before applying), so no data preservation
-- concern.
-- =============================================================================

-- --- schema: add page_ref to the funnel rollup PK ----------------------------
-- NOT NULL with default '' so existing rows fit the new PK without back-fill.
-- The next aggregator tick will re-write rows with the real per-step page_ref.

alter table public.analytics_funnel_daily
  add column if not exists page_ref text not null default '';

alter table public.analytics_funnel_daily
  drop constraint if exists analytics_funnel_daily_pkey;
alter table public.analytics_funnel_daily
  add primary key (surface_id, day, stage, element_label, page_ref);

-- --- aggregator update -------------------------------------------------------
-- One row per (client, surface_kind, surface, day, stage, element_label,
-- page_ref). Page_ref flows through verbatim from the raw event; the
-- element_label case is unchanged from migration 0041.

create or replace function private.aggregate_analytics()
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
    -- funnel rollup: one row per (surface, day, stage, element_label, page_ref).
    delete from public.analytics_funnel_daily where day = d;
    insert into public.analytics_funnel_daily
      (client_id, surface_kind, surface_id, day, stage, element_label, page_ref,
       event_count, unique_visitors)
    select client_id, surface_kind, surface_id, d, stage, element_label, page_ref,
           count(*)::int, count(distinct visitor_id)::int
    from (
      select client_id, surface_kind, surface_id, visitor_id,
        coalesce(page_ref, '') as page_ref,
        case
          when event_type = 'page_view' then 'landing'
          when event_type = 'scroll_depth'
            and coalesce((payload->>'depth')::int, 0) >= 90 then 'scrolled_90'
          when event_type = 'scroll_depth'
            and coalesce((payload->>'depth')::int, 0) >= 75 then 'scrolled_75'
          when event_type = 'scroll_depth'
            and coalesce((payload->>'depth')::int, 0) >= 50 then 'engaged'
          when event_type = 'scroll_depth'
            and coalesce((payload->>'depth')::int, 0) >= 25 then 'scrolled_25'
          when event_type = 'element_click' then 'cta_click'
          when event_type = 'form_start' then 'form_started'
          when event_type = 'form_abandon' then 'form_abandoned'
          when event_type = 'form_submit' then 'form_submitted'
          when event_type = 'form_submit_error' then 'form_failed'
        end as stage,
        case
          when event_type = 'element_click'
            then coalesce(substring(payload->>'label' from 1 for 120), '')
          else ''
        end as element_label
      from public.analytics_events
      where occurred_at >= d and occurred_at < d + interval '1 day'
    ) staged
    where stage is not null
    group by client_id, surface_kind, surface_id, stage, element_label, page_ref;

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
