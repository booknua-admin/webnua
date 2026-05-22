-- =============================================================================
-- Webnua backend — Phase 7 Session 2 · token-refresh-check daily cron.
--
-- Once a day this enqueues a single `token_refresh_check` job onto the
-- Session 1 jobs spine (`integration_jobs`). The minute-poller (migration
-- 0049) then dispatches it to the Node executor, where the registered handler
-- (src/lib/integrations/_shared/job-handlers.ts) does the work:
--
--   • long_lived connections (Meta) — proactively refreshed if their token
--     expires within 14 days, so a customer's connection never silently
--     lapses between API calls.
--   • refresh_access connections (Google) — NO proactive action. Their
--     access token is short-lived (~1h) and re-minted on demand from the
--     refresh token; the refresh token itself does not expire. Refreshing on
--     a schedule would be pointless churn.
--
-- This is an ENQUEUE, not the work itself — the cron stays a one-line insert
-- (Postgres cannot run the TypeScript handler). Mirrors the 0049 split: the
-- poller dispatches, Node executes.
-- =============================================================================

-- Idempotent re-apply: drop any prior schedule before re-creating it.
do $$
begin
  perform cron.unschedule('webnua-token-refresh-check');
exception when others then
  null;
end;
$$;

-- 03:17 UTC daily — off-peak, and offset from the top of the hour so it does
-- not contend with other round-number schedules.
select cron.schedule(
  'webnua-token-refresh-check',
  '17 3 * * *',
  $$insert into public.integration_jobs (job_type, payload, max_attempts)
    values ('token_refresh_check', '{}'::jsonb, 3)$$
);
