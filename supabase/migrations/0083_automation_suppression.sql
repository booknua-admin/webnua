-- =============================================================================
-- Webnua backend — Phase 8 Session 4 · automation suppression layer.
--
-- Closes the long-deferred "Automation overlap / anti-spam" parked decision.
-- Three suppression dimensions, all enforced inside the engine before a
-- comm action dispatches:
--
--   1) Frequency cap        — max N sends per channel per recipient per
--                             window. Hardcoded V1: 1 per hour, 3 per 24h
--                             per channel (sms/email separately). Read
--                             against the existing sms_messages /
--                             email_messages send logs.
--
--   2) Quiet hours          — if the client has quiet hours configured and
--                             the current time is inside the window (in the
--                             client's timezone), the action defers to the
--                             end of the window instead of skipping. Per-
--                             client column on `clients` (the resolved
--                             question 1 storage choice).
--
--   3) Priority cancellation — when a higher-priority run starts on a lead,
--                              lower-priority running runs on that lead are
--                              cancelled. Priority is hardcoded by trigger
--                              type (resolved question 2):
--                                priority 1 (transactional): payment_failed,
--                                  job_completed, job_scheduled,
--                                  job_status_changed
--                                priority 2 (nurture):  lead_created,
--                                  lead_inactive
--                                priority 3 (reputation): review_request_*
--                                  automations (detected by automation_key
--                                  prefix at engine time).
--
-- Every suppression decision logs to `automation_suppression_log` for audit
-- + observability. Cancelled runs flip to status='cancelled' (existing enum
-- value) and the suppression-log row carries the why.
-- =============================================================================

-- --- clients: quiet-hours columns ------------------------------------------
-- Operator (or client) configures their per-client quiet hours on the
-- sub-account settings surface. Both nullable — null = no quiet hours,
-- send any time. Timezone defaults to 'UTC' so a misconfigured row can't
-- crash the suppression check.
alter table public.clients
  add column if not exists quiet_hours_start    time,
  add column if not exists quiet_hours_end      time,
  add column if not exists quiet_hours_timezone text not null default 'UTC';

comment on column public.clients.quiet_hours_start is
  'Start of daily quiet-hours window (in quiet_hours_timezone). NULL = no quiet hours.';
comment on column public.clients.quiet_hours_end is
  'End of daily quiet-hours window (in quiet_hours_timezone). When end < start, window wraps midnight.';
comment on column public.clients.quiet_hours_timezone is
  'IANA timezone for the quiet-hours window evaluation. Defaults to UTC.';

-- --- automation_suppression_log --------------------------------------------
-- Audit row for every suppression decision: which run, which action, which
-- channel, why, when, and (for defers) the rescheduled-for timestamp. The
-- table is the why-was-this-not-sent log; the per-channel send log
-- (sms_messages / email_messages) is unaffected — a suppressed action
-- writes NO send row.

do $$ begin
  create type public.automation_suppression_reason as enum (
    'frequency_cap_hourly',
    'frequency_cap_daily',
    'quiet_hours',
    'priority_cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.automation_suppression_log (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  automation_id       uuid not null references public.automations(id) on delete cascade,
  automation_run_id   uuid not null references public.automation_runs(id) on delete cascade,
  -- Action that was suppressed. For priority_cancelled rows the affected
  -- action is whatever was next-due on the cancelled run.
  action_id           uuid not null references public.automation_actions(id) on delete cascade,
  lead_id             uuid references public.leads(id) on delete set null,
  channel             text,
  reason              public.automation_suppression_reason not null,
  -- For 'quiet_hours' rows only: the engine schedules a retry at this time.
  -- NULL for skip-style suppressions (frequency cap, priority cancel).
  deferred_until      timestamptz,
  -- Free-form context the engine can write for observability — e.g.
  -- "{higher_priority_run_id: ..., higher_priority_trigger: ...}".
  context             jsonb not null default '{}'::jsonb,
  suppressed_at       timestamptz not null default now()
);

create index automation_suppression_log_run_idx
  on public.automation_suppression_log (automation_run_id);
create index automation_suppression_log_client_at_idx
  on public.automation_suppression_log (client_id, suppressed_at desc);
create index automation_suppression_log_lead_idx
  on public.automation_suppression_log (lead_id)
  where lead_id is not null;

-- RLS: SELECT for accessible clients (operators + their own client users
-- see the audit for their own runs). Writes service-role only — the engine
-- writes every row.
alter table public.automation_suppression_log enable row level security;
revoke insert, update, delete on public.automation_suppression_log from authenticated;

create policy automation_suppression_log_select on public.automation_suppression_log
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
