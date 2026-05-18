-- =============================================================================
-- Webnua backend — Phase 1 Session B · notifications + generation_log.
--
-- backend-schema-design.md §1.5 (notifications, notification_reads), §1.6
-- (generation_log), §4.2 / §4.6 (RLS), §5.
--
-- §5 #12 / [JC-7]: notification read-state is a per-viewer join
-- (notification_reads), not a `read` column. §5 #1: the stub's ReactNode
-- title bends to a templated plain-text title column.
-- =============================================================================

-- --- notifications -----------------------------------------------------------
-- A fired notification event, addressed to one recipient. source_entity_*
-- carries the deep-link target for the row's action chip. Append-only:
-- created_at only — read-state lives in notification_reads.
create table public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_user_id  uuid not null references public.users (id) on delete cascade,
  kind               notification_kind not null,
  title              text not null,
  source_entity_type text,                           -- e.g. 'lead', 'booking'
  source_entity_id   uuid,
  created_at         timestamptz not null default now()
);

-- --- notification_reads ------------------------------------------------------
-- Per-viewer read state — a join, not a column (a notification may fan out to
-- multiple recipients in future; even today read-state is per-user).
create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- --- generation_log ----------------------------------------------------------
-- The fallback/validation log from builder-generation-design.md §4.4a — a
-- prompt-tuning artefact, not user-facing. generation_id groups every row
-- from one generation run.
--
-- section_type is plain text here, NOT the section_type enum: that enum is a
-- builder enum (§1.7) created in Phase 1b. page_id is likewise a bare uuid —
-- the FK -> pages(id) is added in Phase 1b when pages exists. Same builder-
-- deferral rule the tickets.context_* columns follow.
create table public.generation_log (
  id            uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  client_id     uuid not null references public.clients (id) on delete cascade,
  page_id       uuid,                                -- FK -> pages(id) added in Phase 1b
  section_type  text not null,                       -- becomes section_type enum in Phase 1b
  field_name    text not null,
  reason        generation_fallback_reason not null,
  model_value   text,
  created_at    timestamptz not null default now()
);

-- --- indexes -----------------------------------------------------------------
create index notifications_recipient_user_id_idx on public.notifications (recipient_user_id);
create index notification_reads_user_id_idx on public.notification_reads (user_id);
create index generation_log_client_id_idx on public.generation_log (client_id);
create index generation_log_generation_id_idx on public.generation_log (generation_id);
create index generation_log_page_id_idx on public.generation_log (page_id);

-- =============================================================================
-- RLS. notifications is strictly per-recipient (§4.2); generation_log is
-- operator-only for the client in scope (§4.6).
-- =============================================================================

-- ===== notifications =========================================================
alter table public.notifications enable row level security;
-- Read: strictly the recipient — even an operator only sees their own.
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));
-- Insert: operators (the stub fires client notifications from operator
-- actions); the real platform fires them as service_role, which bypasses RLS.
-- Append-only: no update/delete policy.
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (private.is_operator());

-- ===== notification_reads ====================================================
alter table public.notification_reads enable row level security;
-- Strictly per-viewer: you may only ever see or write your own read state.
create policy notification_reads_select on public.notification_reads
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_reads_insert on public.notification_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy notification_reads_update on public.notification_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notification_reads_delete on public.notification_reads
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===== generation_log ========================================================
alter table public.generation_log enable row level security;
-- Read: operators only, for a client they can access — it is a prompt-tuning
-- artefact, never surfaced to client users (§4.6).
create policy generation_log_select on public.generation_log
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
-- Insert: operators (real generation runs as service_role, bypassing RLS).
-- Append-only: no update/delete policy.
create policy generation_log_insert on public.generation_log
  for insert to authenticated
  with check (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
