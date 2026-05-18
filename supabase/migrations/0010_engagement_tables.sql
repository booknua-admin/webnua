-- =============================================================================
-- Webnua backend — Phase 1 Session B · reviews, campaigns, automations.
--
-- backend-schema-design.md §1.5, §4.2, §5. This migration also resolves the
-- deferred lead_events.automation_id FK (0007) now that automations exists.
--
-- §5 #5/#6: automation_steps.delay is a structured {amount,unit}, not a
-- string; body is a plain-text template with {variable} placeholders, not JSX.
-- §5 #7: campaign sparkline data is never stored — it is a computed series.
-- =============================================================================

-- --- reviews -----------------------------------------------------------------
-- A Google Business review. author_name is GBP-verbatim and deliberately kept
-- (not renamed to customer_name_snapshot — GBP names are externally authored,
-- a different source class, §2.3). customer_id is a best-effort link, often
-- null. reviewed_at replaces the stub's relative `age`. created_at only.
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  author_name text not null,
  job         text,
  body        text not null,
  stars       smallint not null check (stars between 1 and 5),
  reviewed_at timestamptz not null,
  source      text not null default 'gbp',
  external_id text,                                  -- GBP review id
  created_at  timestamptz not null default now()
);

-- --- campaigns ---------------------------------------------------------------
-- An ad campaign. Metrics (CPL, ROAS, sparkline) are computed aggregates over
-- ad-platform data — not stored (§5 #7).
create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  name         text not null,
  status       campaign_status not null default 'pending',
  budget       numeric(10, 2),
  starts_at    timestamptz,
  ends_at      timestamptz,
  external_ref text,                                 -- Meta Ads campaign id
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --- campaign_activity_events ------------------------------------------------
-- "What Webnua's done lately" — a typed-event log (vision §7). Append-only;
-- prose is composed at render from the structured payload.
create table public.campaign_activity_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  category      campaign_activity_category not null,
  actor_user_id uuid references public.users (id) on delete set null,
  payload       jsonb not null default '{}',
  occurred_at   timestamptz not null,
  created_at    timestamptz not null default now()
);

-- --- automations -------------------------------------------------------------
-- A client automation flow (trigger + ordered steps).
create table public.automations (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  name           text not null,
  trigger_type   text not null,
  trigger_config jsonb not null default '{}',
  enabled        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- --- automation_steps --------------------------------------------------------
-- One step in an automation flow. delay is structured {amount,unit} (§5 #5);
-- body is a plain-text template with {variable} placeholders (§5 #6) — the
-- editor parses placeholders for highlighting, the DB stores plain text.
create table public.automation_steps (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  position      integer not null,
  channel       automation_channel not null,
  delay_amount  integer not null default 0,
  delay_unit    delay_unit not null default 'hours',
  name          text not null,
  subject       text,                                -- email only
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --- deferred FK: lead_events.automation_id ----------------------------------
-- lead_events (0007) carried automation_id as a bare uuid because automations
-- did not exist yet. Resolve the reference now (mirrors the 0002 clients<->users
-- circular-reference pattern).
alter table public.lead_events
  add constraint lead_events_automation_id_fkey
  foreign key (automation_id) references public.automations (id) on delete set null;

-- --- indexes -----------------------------------------------------------------
create index reviews_client_id_idx on public.reviews (client_id);
create index reviews_customer_id_idx on public.reviews (customer_id);
create index campaigns_client_id_idx on public.campaigns (client_id);
create index campaign_activity_events_campaign_id_idx on public.campaign_activity_events (campaign_id);
create index campaign_activity_events_actor_user_id_idx on public.campaign_activity_events (actor_user_id);
create index automations_client_id_idx on public.automations (client_id);
create index automation_steps_automation_id_idx on public.automation_steps (automation_id);

-- --- updated_at triggers -----------------------------------------------------
-- reviews + campaign_activity_events are append-only (created_at / occurred_at
-- only); campaigns, automations, automation_steps are mutable.
create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
create trigger automations_set_updated_at before update on public.automations
  for each row execute function public.set_updated_at();
create trigger automation_steps_set_updated_at before update on public.automation_steps
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — tenant isolation (§4.2). reviews / campaigns / automations are
-- directly client-scoped; campaign_activity_events + automation_steps resolve
-- client_id through their parent FK.
-- =============================================================================

-- ===== reviews ===============================================================
alter table public.reviews enable row level security;
-- Read/write: any user who can access the owning client.
create policy reviews_select on public.reviews
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy reviews_update on public.reviews
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy reviews_delete on public.reviews
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== campaigns =============================================================
alter table public.campaigns enable row level security;
-- Read/write: any user who can access the owning client.
create policy campaigns_select on public.campaigns
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy campaigns_update on public.campaigns
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy campaigns_delete on public.campaigns
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== campaign_activity_events ==============================================
alter table public.campaign_activity_events enable row level security;
-- Read/insert resolve the client through the parent campaign. Append-only:
-- no update/delete policy.
create policy campaign_activity_events_select on public.campaign_activity_events
  for select to authenticated
  using (exists (
    select 1 from public.campaigns c
    where c.id = campaign_activity_events.campaign_id
      and c.client_id in (select private.accessible_client_ids())
  ));
create policy campaign_activity_events_insert on public.campaign_activity_events
  for insert to authenticated
  with check (exists (
    select 1 from public.campaigns c
    where c.id = campaign_activity_events.campaign_id
      and c.client_id in (select private.accessible_client_ids())
  ));

-- ===== automations ===========================================================
alter table public.automations enable row level security;
-- Read/write: any user who can access the owning client.
create policy automations_select on public.automations
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy automations_insert on public.automations
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy automations_update on public.automations
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy automations_delete on public.automations
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== automation_steps ======================================================
alter table public.automation_steps enable row level security;
-- All operations resolve the client through the parent automation.
create policy automation_steps_select on public.automation_steps
  for select to authenticated
  using (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.client_id in (select private.accessible_client_ids())
  ));
create policy automation_steps_insert on public.automation_steps
  for insert to authenticated
  with check (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.client_id in (select private.accessible_client_ids())
  ));
create policy automation_steps_update on public.automation_steps
  for update to authenticated
  using (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.client_id in (select private.accessible_client_ids())
  ))
  with check (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.client_id in (select private.accessible_client_ids())
  ));
create policy automation_steps_delete on public.automation_steps
  for delete to authenticated
  using (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.client_id in (select private.accessible_client_ids())
  ));
