-- =============================================================================
-- Webnua backend — Phase 8 Session 1 · automation engine schema.
--
-- Replaces the Phase-3-era `automations` + `automation_steps` tables with the
-- richer engine model. The previous tables were definitions-only (no run
-- history, no action variety beyond SMS/email, no handoff awareness). This
-- migration drops them and rebuilds:
--
--   • automations            — the definition: trigger + filters + metadata.
--   • automation_actions     — the ordered steps in an automation. Broader
--                              vocabulary than the old automation_steps
--                              (6 action types vs sms/email-only).
--   • automation_runs        — one row per fired trigger; tracks position,
--                              status, pause reason, lead correlation.
--
-- Plus extensions to public.leads:
--   automation_state, taken_over_at/by, needs_followup_at,
--   followup_dismissed_at, followup_nudge_count,
--   last_outbound_at, last_inbound_at.
--
-- The existing Phase 5 automations UI hooks (`useClientAutomations`,
-- `useAdminAutomations`, `useAutomationEditor`, `useToggleAutomation`,
-- `useUpdateAutomationSteps`) are retargeted in queries.tsx to read from the
-- new tables. Until Session 2 lands the new editor UI, the editor sees only
-- the comm actions (send_sms_to_lead, send_email_to_lead) — the wider action
-- set is engine-internal.
-- =============================================================================

-- --- drop old (definitions + seeds) -----------------------------------------
-- The lead_events table holds an automation_id FK that was added by
-- migration 0010. Set the existing rows' FK to null before drop so we can
-- recreate the FK cleanly.
alter table public.lead_events drop constraint if exists lead_events_automation_id_fkey;

drop table if exists public.automation_steps cascade;
drop table if exists public.automations cascade;

-- --- enums ------------------------------------------------------------------
-- One closed set per axis (trigger / action / run-status / pause-reason /
-- lead-state). Postgres enums for cheap GROUP BY and free integrity.
do $$ begin
  create type public.automation_trigger_type as enum (
    'lead_created',
    'job_completed',
    'payment_failed',
    'job_scheduled',
    'job_status_changed',
    'lead_inactive'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.automation_action_type as enum (
    'send_sms_to_lead',
    'send_email_to_lead',
    'send_operator_notification',
    'wait_for_duration',
    'update_lead_field',
    'create_followup_task'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.automation_run_status as enum (
    'running',
    'completed',
    'failed',
    'cancelled',
    'paused'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.automation_pause_reason as enum (
    'lead_replied',
    'client_took_over',
    'manually_cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_automation_state as enum (
    'automated',
    'taken_over',
    'completed',
    'archived'
  );
exception when duplicate_object then null;
end $$;

-- --- automations ------------------------------------------------------------
create table public.automations (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,

  -- Stable per-client key (e.g. 'lead_acknowledgment_sms'). Lets the
  -- new-client INSERT trigger seed a known set, and lets diagnostics
  -- reference an automation across runs without exposing UUIDs.
  automation_key  text not null,

  name            text not null,
  description     text,

  is_enabled      boolean not null default false,
  -- True for the platform-seeded defaults; false for any operator-authored
  -- additions. Distinguishes "this is a Webnua default" from "this is a
  -- custom automation the operator built" for the future editor UI.
  is_default      boolean not null default false,

  trigger_type    public.automation_trigger_type not null,
  -- Per-trigger config. Examples:
  --   lead_inactive: {"days_after_last_outbound": 4, "max_nudges": 3}
  --   job_completed: {"delay_minutes": 120}
  --   job_status_changed: {"to_status": "on_the_way"}
  trigger_config  jsonb not null default '{}'::jsonb,
  -- Optional row-level filters applied to the triggering entity.
  -- Examples:
  --   {"requires_phone": true}
  --   {"requires_gbp_location": true}
  --   {"requires_no_phone": true}  (only if lead has no phone)
  trigger_filters jsonb not null default '{}'::jsonb,

  last_edited_by  uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (client_id, automation_key)
);

create index automations_client_id_idx on public.automations (client_id);
create index automations_trigger_type_enabled_idx
  on public.automations (trigger_type, is_enabled)
  where is_enabled = true;

-- --- automation_actions -----------------------------------------------------
-- The ordered steps that fire when an automation runs. `position` is the
-- sort key (1-indexed). `pauses_on_human_activity` is stored explicitly
-- (rather than derived) so the engine doesn't have to map action_type ->
-- boolean on every pre-flight check.
create table public.automation_actions (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  position      integer not null,
  action_type   public.automation_action_type not null,

  -- Per-action config. Examples:
  --   send_sms_to_lead:           {"template_key": "lead_acknowledgment"}
  --   send_email_to_lead:         {"template_key": "lead_followup"}
  --   send_operator_notification: {"variant": "new_lead"}
  --   wait_for_duration:          {"minutes": 30}
  --   update_lead_field:          {"field": "status", "value": "contacted"}
  --   create_followup_task:       {"hint": "Cold lead — needs a personal nudge"}
  action_config jsonb not null default '{}'::jsonb,

  -- Auto-set from action_type by the application code on insert; stored so
  -- the engine's handoff pre-flight is a single column read, not a CASE.
  pauses_on_human_activity boolean not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (automation_id, position)
);

create index automation_actions_automation_id_idx
  on public.automation_actions (automation_id);

-- --- automation_runs --------------------------------------------------------
-- One row per fired trigger. The engine inserts on trigger, updates as it
-- advances through actions, and writes a terminal status.
create table public.automation_runs (
  id                       uuid primary key default gen_random_uuid(),
  automation_id            uuid not null references public.automations (id) on delete cascade,
  client_id                uuid not null references public.clients (id) on delete cascade,
  lead_id                  uuid references public.leads (id) on delete set null,

  -- The triggering event snapshot — bookingId, leadId, customer phone/email,
  -- etc. Shape varies by trigger_type.
  trigger_event            jsonb not null default '{}'::jsonb,

  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  paused_at                timestamptz,
  resumed_at               timestamptz,

  status                   public.automation_run_status not null default 'running',
  paused_reason            public.automation_pause_reason,

  -- 1-indexed; matches automation_actions.position. The "next action to
  -- execute" is current_action_position; on success it advances.
  current_action_position  integer not null default 1,

  -- Timestamp of the most recent send_sms_to_lead / send_email_to_lead
  -- action on THIS run. The handoff pre-flight compares
  -- leads.last_inbound_at against this — an inbound newer than the last
  -- automated outbound on this run pauses the run.
  last_automation_message_at timestamptz,

  error_message            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index automation_runs_automation_id_idx on public.automation_runs (automation_id);
create index automation_runs_client_id_idx on public.automation_runs (client_id);
create index automation_runs_lead_id_idx on public.automation_runs (lead_id) where lead_id is not null;
create index automation_runs_status_idx
  on public.automation_runs (status)
  where status in ('running', 'paused');

-- Restore the lead_events.automation_id FK (lost when we dropped automations).
alter table public.lead_events
  add constraint lead_events_automation_id_fkey
  foreign key (automation_id) references public.automations (id) on delete set null;

-- --- leads — handoff + cold-lead columns -----------------------------------
alter table public.leads
  add column if not exists automation_state public.lead_automation_state
    not null default 'automated';

alter table public.leads
  add column if not exists taken_over_at timestamptz;

alter table public.leads
  add column if not exists taken_over_by uuid references public.users (id) on delete set null;

alter table public.leads
  add column if not exists needs_followup_at timestamptz;

alter table public.leads
  add column if not exists followup_dismissed_at timestamptz;

alter table public.leads
  add column if not exists followup_nudge_count integer not null default 0;

alter table public.leads
  add column if not exists last_outbound_at timestamptz;

alter table public.leads
  add column if not exists last_inbound_at timestamptz;

-- Active-lead lookups (handoff API, inbox filters).
create index if not exists leads_automation_state_idx
  on public.leads (client_id, automation_state);

-- Cold-lead surface (the GET /api/leads/needs-followup endpoint).
create index if not exists leads_needs_followup_idx
  on public.leads (client_id, needs_followup_at)
  where needs_followup_at is not null and followup_dismissed_at is null;

-- The lead_inactive trigger scanner — find leads whose last_outbound is
-- older than threshold and have no newer inbound.
create index if not exists leads_inactive_scan_idx
  on public.leads (last_outbound_at, last_inbound_at)
  where last_outbound_at is not null;

-- --- updated_at triggers ---------------------------------------------------
create or replace function private.automations_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger automations_updated_at
  before update on public.automations
  for each row execute function private.automations_set_updated_at();

create trigger automation_actions_updated_at
  before update on public.automation_actions
  for each row execute function private.automations_set_updated_at();

create trigger automation_runs_updated_at
  before update on public.automation_runs
  for each row execute function private.automations_set_updated_at();

-- --- RLS -------------------------------------------------------------------
-- Mirror of the previous automations RLS: clients SELECT their own (so the
-- read-only client `/automations` view works); operators see/manage all.
-- automation_runs is operator-or-own-client SELECT; writes service-role only.
-- automation_actions is parent-bound (RLS via the automation it belongs to).
alter table public.automations enable row level security;
alter table public.automation_actions enable row level security;
alter table public.automation_runs enable row level security;

revoke insert, update, delete on public.automations from authenticated;
revoke insert, update, delete on public.automation_actions from authenticated;
revoke insert, update, delete on public.automation_runs from authenticated;

create policy automations_select on public.automations
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

create policy automations_insert on public.automations
  for insert to authenticated
  with check (private.is_operator() and client_id in (select private.accessible_client_ids()));

create policy automations_update on public.automations
  for update to authenticated
  using (private.is_operator() and client_id in (select private.accessible_client_ids()))
  with check (private.is_operator() and client_id in (select private.accessible_client_ids()));

create policy automations_delete on public.automations
  for delete to authenticated
  using (private.is_operator() and client_id in (select private.accessible_client_ids()));

create policy automation_actions_select on public.automation_actions
  for select to authenticated
  using (
    automation_id in (
      select id from public.automations
        where client_id in (select private.accessible_client_ids())
    )
  );

create policy automation_actions_insert on public.automation_actions
  for insert to authenticated
  with check (
    private.is_operator()
    and automation_id in (
      select id from public.automations
        where client_id in (select private.accessible_client_ids())
    )
  );

create policy automation_actions_update on public.automation_actions
  for update to authenticated
  using (
    private.is_operator()
    and automation_id in (
      select id from public.automations
        where client_id in (select private.accessible_client_ids())
    )
  )
  with check (
    private.is_operator()
    and automation_id in (
      select id from public.automations
        where client_id in (select private.accessible_client_ids())
    )
  );

create policy automation_actions_delete on public.automation_actions
  for delete to authenticated
  using (
    private.is_operator()
    and automation_id in (
      select id from public.automations
        where client_id in (select private.accessible_client_ids())
    )
  );

create policy automation_runs_select on public.automation_runs
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- automation_runs.INSERT / UPDATE / DELETE are service-role only — the engine
-- writes them. No `authenticated` policy on those operations.

-- --- privileges -------------------------------------------------------------
grant select on public.automations to authenticated;
grant select on public.automation_actions to authenticated;
grant select on public.automation_runs to authenticated;
grant insert, update, delete on public.automations to authenticated;
grant insert, update, delete on public.automation_actions to authenticated;

-- automation_runs writes are service-role only — already implicit via the
-- absent INSERT/UPDATE/DELETE policy; no grant to authenticated.

-- Service-role has all privileges by default (BYPASSRLS).
