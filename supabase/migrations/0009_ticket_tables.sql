-- =============================================================================
-- Webnua backend — Phase 1 Session B · tickets + ticket_messages.
--
-- backend-schema-design.md §1.5, §4.2, §5. §5 #3: statusLabel/statusHeadline
-- are the same data rendered twice — not columns; both derive from
-- status + awaiting.
--
-- Builder FK targets do not exist yet (Phase 1b): context_website_id is a
-- plain uuid (no FK); context_page_id / context_section_id are plain text.
-- The FK to websites/pages/sections lands in Phase 1b.
-- =============================================================================

-- --- tickets -----------------------------------------------------------------
-- A client support/request ticket. title is verbatim user input (does not
-- bend, §5). The context_* columns carry the structured request-change
-- context from a CapabilityGate request-mode affordance.
create table public.tickets (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,        -- display id, e.g. 'TKT-0247'
  client_id            uuid not null references public.clients (id) on delete cascade,
  title                text not null,
  category             ticket_category not null,
  status               ticket_status not null default 'open',
  urgency              ticket_urgency not null default 'none',
  awaiting             ticket_awaiting,             -- null = awaiting nobody
  created_by           uuid not null references public.users (id) on delete restrict,
  assigned_operator_id uuid references public.users (id) on delete set null,
  context_website_id   uuid,  -- FK -> websites(id) added in Phase 1b
  context_page_id      text,  -- builder ids are text until Phase 1b
  context_section_id   text,  -- builder ids are text until Phase 1b
  context_field_key    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --- ticket_messages ---------------------------------------------------------
-- A reply on a ticket thread. body is verbatim (does not bend, §5). is_draft
-- carries the operator's staged-but-unsent reply. created_at only (§1.5 spec).
create table public.ticket_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets (id) on delete cascade,
  author_user_id uuid not null references public.users (id) on delete restrict,
  body           text not null,
  is_draft       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- --- indexes -----------------------------------------------------------------
create index tickets_client_id_idx on public.tickets (client_id);
create index tickets_created_by_idx on public.tickets (created_by);
create index tickets_assigned_operator_id_idx on public.tickets (assigned_operator_id);
create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);
create index ticket_messages_author_user_id_idx on public.ticket_messages (author_user_id);

-- --- updated_at trigger ------------------------------------------------------
create trigger tickets_set_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — tenant isolation (§4.2). tickets is directly client-scoped;
-- ticket_messages resolves client_id through its parent ticket.
-- =============================================================================

-- ===== tickets ===============================================================
alter table public.tickets enable row level security;
-- Read/write: any user who can access the owning client (a client raises and
-- replies to their own tickets; operators triage across accessible clients).
create policy tickets_select on public.tickets
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));
create policy tickets_update on public.tickets
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));
create policy tickets_delete on public.tickets
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- ===== ticket_messages =======================================================
alter table public.ticket_messages enable row level security;
-- All operations resolve the client through the parent ticket. Update is
-- allowed so an operator can edit/send a staged draft reply.
create policy ticket_messages_select on public.ticket_messages
  for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_messages.ticket_id
      and t.client_id in (select private.accessible_client_ids())
  ));
create policy ticket_messages_insert on public.ticket_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_messages.ticket_id
      and t.client_id in (select private.accessible_client_ids())
  ));
create policy ticket_messages_update on public.ticket_messages
  for update to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_messages.ticket_id
      and t.client_id in (select private.accessible_client_ids())
  ))
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_messages.ticket_id
      and t.client_id in (select private.accessible_client_ids())
  ));
create policy ticket_messages_delete on public.ticket_messages
  for delete to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_messages.ticket_id
      and t.client_id in (select private.accessible_client_ids())
  ));
