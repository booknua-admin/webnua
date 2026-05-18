-- =============================================================================
-- Webnua backend — Phase 1 Session B · customers + lead family.
--
-- backend-schema-design.md §1.5 (leads, lead_events, lead_reads), §2.3
-- (customers), §4.2 (tenant isolation), §5 (stub disagreements).
--
-- [JC-2c]: customers is a real per-client entity; leads carry a nullable
-- customer_id FK + frozen name/phone display snapshots.
-- [JC-4]: there is NO messages table — lead_events is the single activity
-- log; message-kind events carry {body, senderName, delivered} in payload.
-- lead_events.automation_id FK is added in 0010 (automations created later).
-- =============================================================================

-- --- customers ---------------------------------------------------------------
-- The person a client deals with — the shared identity behind leads, bookings,
-- recurring schedules, and review authors. Per-client scoped (§2.3): a customer
-- belongs to exactly one client; cross-client identity is explicitly V2.
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  suburb      text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- leads -------------------------------------------------------------------
-- An enquiry. customer_id links to the resolved identity (null = unmatchable
-- raw lead). name/phone snapshots freeze the enquiry's display values; email/
-- suburb live on customers and resolve via the FK (§2.3 snapshot convention).
create table public.leads (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.clients (id) on delete cascade,
  customer_id             uuid references public.customers (id) on delete set null,
  customer_name_snapshot  text not null,
  customer_phone_snapshot text,
  status                  lead_status not null default 'new',
  urgency                 lead_urgency not null default 'none',
  source                  text,
  assigned_operator_id    uuid references public.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- --- lead_events -------------------------------------------------------------
-- The lead activity timeline — the canonical typed-event log (vision §7).
-- Append-only: only its event timestamp, no updated_at. actor_user_id (human)
-- and automation_id (automation) are the two non-exclusive actor FKs; the
-- stub's is_automated boolean is dropped (derivable: automation_id IS NOT NULL).
-- payload is typed by kind (§5 #2): message kinds carry {body,senderName,
-- delivered}; form_submitted carries {fields}; status_changed {from,to}; etc.
create table public.lead_events (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  kind          lead_event_kind not null,
  occurred_at   timestamptz not null,
  scheduled_for timestamptz,
  actor_user_id uuid references public.users (id) on delete set null,
  automation_id uuid, -- FK -> automations(id) added in 0010 (automations land later)
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- --- lead_reads --------------------------------------------------------------
-- Per-viewer lead read state — a join, not a column (§5 #12, [JC-7]):
-- "unread" is per-user, so it cannot live on the lead row.
create table public.lead_reads (
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (lead_id, user_id)
);

-- --- indexes -----------------------------------------------------------------
-- FK-backing indexes (the perf advisor flags unindexed FKs; tenant-scoped
-- SELECT policies filter on client_id, the timeline reads filter on lead_id).
create index customers_client_id_idx on public.customers (client_id);
create index leads_client_id_idx on public.leads (client_id);
create index leads_customer_id_idx on public.leads (customer_id);
create index leads_assigned_operator_id_idx on public.leads (assigned_operator_id);
create index lead_events_lead_id_idx on public.lead_events (lead_id);
create index lead_events_actor_user_id_idx on public.lead_events (actor_user_id);
create index lead_events_automation_id_idx on public.lead_events (automation_id);
create index lead_reads_user_id_idx on public.lead_reads (user_id);

-- --- updated_at triggers -----------------------------------------------------
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — tenant isolation (§4.2). Operational tables are client-scoped: a
-- client sees only their own rows, an operator sees their accessible clients.
-- Child tables resolve client_id through their parent FK. Policies target
-- `authenticated`; `anon` matches nothing, `service_role` bypasses RLS.
-- =============================================================================

-- ===== customers =============================================================
alter table public.customers enable row level security;
-- Read/write: any user who can access the owning client.
create policy customers_select on public.customers
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy customers_insert on public.customers
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy customers_update on public.customers
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy customers_delete on public.customers
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== leads =================================================================
alter table public.leads enable row level security;
-- Read/write: any user who can access the owning client.
create policy leads_select on public.leads
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy leads_insert on public.leads
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy leads_update on public.leads
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy leads_delete on public.leads
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== lead_events ===========================================================
alter table public.lead_events enable row level security;
-- Read/insert resolve the client through the parent lead. Append-only: no
-- update/delete policy, so those operations are denied for everyone.
create policy lead_events_select on public.lead_events
  for select to authenticated
  using (exists (
    select 1 from public.leads l
    where l.id = lead_events.lead_id
      and l.client_id in (select private.accessible_client_ids())
  ));
create policy lead_events_insert on public.lead_events
  for insert to authenticated
  with check (exists (
    select 1 from public.leads l
    where l.id = lead_events.lead_id
      and l.client_id in (select private.accessible_client_ids())
  ));

-- ===== lead_reads ============================================================
alter table public.lead_reads enable row level security;
-- Strictly per-viewer: you may only ever see or write your own read state.
create policy lead_reads_select on public.lead_reads
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy lead_reads_insert on public.lead_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lead_reads_update on public.lead_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy lead_reads_delete on public.lead_reads
  for delete to authenticated
  using (user_id = (select auth.uid()));
