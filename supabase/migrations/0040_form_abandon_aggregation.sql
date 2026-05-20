-- =============================================================================
-- Webnua backend — aggregate `form_abandon` events.
--
-- Closes analytics-audit §5.2 gap #2. The tracker has been firing
-- `form_abandon` events on `pagehide` / `visibilitychange→hidden` for any
-- form a visitor started but never submitted; the ingest API has been
-- writing them; the raw rows have been landing in `analytics_events`. The
-- aggregation function's `case` block has had no branch for the event,
-- so every captured abandon has been dropped at rollup and pruned at 90d.
--
-- This migration adds the missing branch — abandons now roll up into a new
-- `form_abandoned` stage in `analytics_funnel_daily`. The 90-day raw event
-- retention window means the next aggregator tick back-fills any abandons
-- that landed in raw since 0035 deployed.
--
-- Re-running is safe (`create or replace`). The pg_cron job from 0035
-- picks up the new function body on its next tick.
-- =============================================================================

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
          when event_type = 'form_abandon' then 'form_abandoned'
          when event_type = 'form_submit' then 'form_submitted'
          when event_type = 'form_submit_error' then 'form_failed'
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
