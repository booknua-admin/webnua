-- =============================================================================
-- Webnua backend — Phase 1 Session B · booking family.
--
-- backend-schema-design.md §1.5, §2.2 (booking family — invented essentially
-- from scratch), §4.2, §5. The calendar stub is pixel layout (top/height);
-- §5 #11: pixel offsets are never persisted — the calendar computes them from
-- starts_at/ends_at.
--
-- recurring_booking_schedules is created before bookings (bookings FK -> it).
-- customer_id is NOT NULL here (the repeat-business spine, §2.3); name/phone
-- snapshots freeze display values at row-creation time.
-- =============================================================================

-- --- recurring_booking_schedules ---------------------------------------------
-- A recurring-visit series. Individual bookings are generated from a schedule
-- and carry recurring_schedule_id back to it, so one visit can be rescheduled
-- or cancelled without touching the series. created_at only (§2.2 spec).
create table public.recurring_booking_schedules (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.clients (id) on delete cascade,
  lead_id                 uuid references public.leads (id) on delete set null,
  frequency               recurrence_frequency not null,
  day_of_week             smallint check (day_of_week between 0 and 6), -- null for 'custom'
  start_time              time not null,
  duration_minutes        integer not null,
  service_type            text not null,
  price                   numeric(10, 2),
  customer_id             uuid not null references public.customers (id) on delete restrict,
  customer_name_snapshot  text not null,
  customer_phone_snapshot text,
  active                  boolean not null default true,
  created_by              uuid not null references public.users (id) on delete restrict,
  created_at              timestamptz not null default now()
);

-- --- bookings ----------------------------------------------------------------
-- A scheduled job. starts_at/ends_at replace the stub's pixel top/height +
-- display time string (§5 #11). status adds 'cancelled' to the calendar's
-- 3-value tone set. lead_id is nullable — the "+ New booking" modal creates
-- bookings directly; when a booking does come from a lead, that link is what a
-- lead_event of kind booking_created references. address is the job-site
-- address (booking-specific, not customer data — stays off customers).
create table public.bookings (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.clients (id) on delete cascade,
  lead_id                 uuid references public.leads (id) on delete set null,
  recurring_schedule_id   uuid references public.recurring_booking_schedules (id) on delete set null,
  title                   text not null,
  service_type            text not null,
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null,
  customer_id             uuid not null references public.customers (id) on delete restrict,
  customer_name_snapshot  text not null,
  customer_phone_snapshot text,
  address                 text,
  price                   numeric(10, 2),
  status                  booking_status not null default 'scheduled',
  notes                   text,
  assigned_operator_id    uuid references public.users (id) on delete set null,
  created_by              uuid not null references public.users (id) on delete restrict,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- --- job_completions ---------------------------------------------------------
-- The record of HOW a booking was completed — one per booking (unique FK).
-- Written once at completion time with its final values; append-only (only
-- completed_at). Real payment processing is out of scope (§9): payment_method
-- / amount_charged record what the operator marked, not a Stripe transaction.
create table public.job_completions (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null unique references public.bookings (id) on delete cascade,
  completed_by     uuid not null references public.users (id) on delete restrict,
  completed_at     timestamptz not null default now(),
  payment_method   payment_method not null,
  amount_charged   numeric(10, 2) not null,
  materials_cost   numeric(10, 2),
  review_requested boolean not null default false,
  notes            text
);

-- --- indexes -----------------------------------------------------------------
create index recurring_schedules_client_id_idx on public.recurring_booking_schedules (client_id);
create index recurring_schedules_lead_id_idx on public.recurring_booking_schedules (lead_id);
create index recurring_schedules_customer_id_idx on public.recurring_booking_schedules (customer_id);
create index recurring_schedules_created_by_idx on public.recurring_booking_schedules (created_by);
create index bookings_client_id_idx on public.bookings (client_id);
create index bookings_lead_id_idx on public.bookings (lead_id);
create index bookings_recurring_schedule_id_idx on public.bookings (recurring_schedule_id);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_assigned_operator_id_idx on public.bookings (assigned_operator_id);
create index bookings_created_by_idx on public.bookings (created_by);
create index job_completions_completed_by_idx on public.job_completions (completed_by);

-- --- updated_at trigger ------------------------------------------------------
-- Only bookings is mutable with an updated_at; recurring_booking_schedules and
-- job_completions carry created_at / completed_at only (§2.2 spec).
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — tenant isolation (§4.2). recurring_booking_schedules + bookings are
-- directly client-scoped; job_completions resolves client_id through its
-- parent booking.
-- =============================================================================

-- ===== recurring_booking_schedules ===========================================
alter table public.recurring_booking_schedules enable row level security;
-- Read/write: any user who can access the owning client.
create policy recurring_schedules_select on public.recurring_booking_schedules
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy recurring_schedules_insert on public.recurring_booking_schedules
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy recurring_schedules_update on public.recurring_booking_schedules
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy recurring_schedules_delete on public.recurring_booking_schedules
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== bookings ==============================================================
alter table public.bookings enable row level security;
-- Read/write: any user who can access the owning client.
create policy bookings_select on public.bookings
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy bookings_update on public.bookings
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy bookings_delete on public.bookings
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== job_completions =======================================================
alter table public.job_completions enable row level security;
-- Read/insert resolve the client through the parent booking. Append-only: no
-- update/delete policy — a completion is written once with its final values.
create policy job_completions_select on public.job_completions
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = job_completions.booking_id
      and b.client_id in (select private.accessible_client_ids())
  ));
create policy job_completions_insert on public.job_completions
  for insert to authenticated
  with check (exists (
    select 1 from public.bookings b
    where b.id = job_completions.booking_id
      and b.client_id in (select private.accessible_client_ids())
  ));
