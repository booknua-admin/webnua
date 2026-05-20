-- =============================================================================
-- Webnua backend — aggregate scroll-threshold + per-element click events.
--
-- Closes analytics-audit §3 / §4 website-side gaps:
--
--   • Scroll thresholds beyond 50% — captured at 25 / 50 / 75 / 90, only the
--     ≥50% threshold rolled up (as `engaged`). The 25 / 75 / 90 events have
--     been landing in raw `analytics_events`, dropped at the rollup boundary,
--     and pruned at 90d. This migration adds three new stages
--     (`scrolled_25` / `scrolled_75` / `scrolled_90`); the existing `engaged`
--     stage is left as the canonical 50% label so existing consumers stay
--     wired.
--
--   • Per-element click distinction — `element_click` events carry a `label`
--     payload but the rollup collapsed every element into a single
--     `cta_click` stage, so a "Top CTAs by click count" view was not
--     queryable. This migration adds a nullable-with-default-`''`
--     `element_label` column, includes it in the rollup PK, and populates it
--     from `payload->>'label'` for `element_click` events. All other stages
--     write `element_label = ''` — they roll up exactly as before.
--
-- The 90-day raw-event retention window means abandons, scroll-thresholds and
-- per-element clicks already in raw will back-fill on the next aggregator
-- tick. Funnel rollup step-granularity (per-page funnel stages) is NOT
-- addressed here — that's the Session B `page_ref` GROUP-BY rewrite the
-- audit calls out, deferred per CLAUDE.md.
-- =============================================================================

-- --- schema: add element_label to the funnel rollup --------------------------
-- NOT NULL with default '' so existing rows fit the new PK without back-fill
-- (every existing row gets ''; `element_click` rows will be re-aggregated by
-- the next tick into the correct per-label rows).

alter table public.analytics_funnel_daily
  add column if not exists element_label text not null default '';

-- Replace the PK so per-element click rows can coexist on the same
-- (surface, day, stage). All other stages keep element_label = '' so the
-- per-stage uniqueness is preserved.
alter table public.analytics_funnel_daily
  drop constraint if exists analytics_funnel_daily_pkey;
alter table public.analytics_funnel_daily
  add primary key (surface_id, day, stage, element_label);

-- --- aggregator update -------------------------------------------------------

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
    -- funnel rollup: one row per (surface, day, stage[, element_label]).
    delete from public.analytics_funnel_daily where day = d;
    insert into public.analytics_funnel_daily
      (client_id, surface_kind, surface_id, day, stage, element_label,
       event_count, unique_visitors)
    select client_id, surface_kind, surface_id, d, stage, element_label,
           count(*)::int, count(distinct visitor_id)::int
    from (
      select client_id, surface_kind, surface_id, visitor_id,
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
    group by client_id, surface_kind, surface_id, stage, element_label;

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
