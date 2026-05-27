-- =============================================================================
-- 0107 — Stream A: agency notification stream.
--
-- The OPERATOR (Webnua, the agency owner — you) inbox. Distinct from
-- Stream B (sub-account owner notifications about THEIR business) and
-- Stream C (sub-account → lead automation messages).
--
-- The operator at 100+ clients does not want a flood of per-lead / per-
-- booking / per-review pings. The operator wants meta-level events:
--
--    new_ticket        — a sub-account opened a support ticket
--    new_signup        — a fresh sub-account completed signup
--    cancellation      — a sub-account moved to cancelled / deleted
--    integration_failure — a sub-account's integration broke
--                          (token refresh failed, sender registration
--                          permanently failed, etc.) — V2 wire (defer)
--
-- Storage: a tiny `agency_notification_recipients` table (one row per
-- operator who should receive these). Bootstrapped from existing
-- public.users WHERE role='admin' so the current operator is already
-- subscribed. Multi-operator future is shape-ready (when the agency
-- plan launches).
--
-- Send path: DB triggers enqueue a `send_agency_notification` job carrying
-- the event_type + structured payload. The handler (lib/integrations/_shared/
-- agency-notifications.ts) resolves the active recipients with the matching
-- opt-in, renders an inline branded HTML body (matching the chrome from
-- migration 0098), and enqueues a send_email per recipient.
-- =============================================================================

-- =============================================================================
-- 1. agency_notification_recipients table
-- =============================================================================
create table if not exists public.agency_notification_recipients (
  id                              uuid primary key default gen_random_uuid(),
  email                           text not null unique,
  display_name                    text,
  notify_on_new_ticket            boolean not null default true,
  notify_on_new_signup            boolean not null default true,
  notify_on_cancellation          boolean not null default true,
  notify_on_integration_failure   boolean not null default true,
  is_active                       boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

comment on table public.agency_notification_recipients is
  'Stream A — operator (agency) inbox subscribers. Distinct from notification_preferences which is per-client Stream B. Seeded from public.users WHERE role=admin so the existing operator is auto-subscribed.';

create index if not exists agency_notification_recipients_active_idx
  on public.agency_notification_recipients (is_active) where is_active = true;

-- Operator-only RLS — only admin-role users can read or manage.
alter table public.agency_notification_recipients enable row level security;
revoke insert, update, delete on public.agency_notification_recipients from authenticated;

create policy agency_notification_recipients_select
  on public.agency_notification_recipients
  for select to authenticated
  using (private.is_operator());

create policy agency_notification_recipients_insert
  on public.agency_notification_recipients
  for insert to authenticated
  with check (private.is_operator());

create policy agency_notification_recipients_update
  on public.agency_notification_recipients
  for update to authenticated
  using (private.is_operator())
  with check (private.is_operator());

create policy agency_notification_recipients_delete
  on public.agency_notification_recipients
  for delete to authenticated
  using (private.is_operator());

grant insert, update, delete on public.agency_notification_recipients to authenticated;

-- =============================================================================
-- 2. Seed: bootstrap from existing admin users
-- =============================================================================
insert into public.agency_notification_recipients (email, display_name)
select
  u.email,
  coalesce(u.display_name, split_part(u.email, '@', 1))
from public.users u
where u.role = 'admin'
  and u.email is not null
  and u.email <> ''
on conflict (email) do nothing;

-- =============================================================================
-- 3. DB triggers — fire the job on the events the operator cares about.
-- =============================================================================

-- Trigger: new ticket from a sub-account.
-- We enqueue on the opening `ticket_messages` row (the first message of a
-- new ticket) because tickets has no "is_first_message" column and the
-- ticket itself has no body. The first ticket_message of each ticket is
-- the inbound submission.
create or replace function private.notify_agency_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing_count int;
begin
  -- Skip operator-authored messages (an operator reply isn't a "new ticket"
  -- notification for the operator).
  if exists (
    select 1 from public.users
    where id = new.author_user_id and role = 'admin'
  ) then
    return new;
  end if;

  -- First message of this ticket? Count siblings — if this is the only
  -- ticket_messages row for the ticket, it's the opening submission.
  select count(*) into v_existing_count
  from public.ticket_messages
  where ticket_id = new.ticket_id and id <> new.id;
  if v_existing_count > 0 then
    return new;
  end if;

  -- Enqueue the agency notification job. Best-effort — wrap in exception
  -- handler so a queue-side issue never blocks the ticket reply itself.
  begin
    insert into public.integration_jobs (job_type, payload, provider)
    values (
      'send_agency_notification',
      jsonb_build_object(
        'event_type', 'new_ticket',
        'ticket_id', new.ticket_id,
        'message_id', new.id
      ),
      'webnua_agency'
    );
  exception when others then
    raise warning '[notify_agency_new_ticket] enqueue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists ticket_messages_notify_agency on public.ticket_messages;
create trigger ticket_messages_notify_agency
  after insert on public.ticket_messages
  for each row
  execute function private.notify_agency_new_ticket();

-- Trigger: a fresh sub-account completed signup (lifecycle moved from
-- pending_verification → preview, or any path into preview/active).
create or replace function private.notify_agency_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  -- Fire only on the FIRST time the lifecycle becomes verifiable
  -- (preview = email-verified, OR active = paying). pending_verification
  -- is signup-started but not confirmed; we wait for the actual move.
  if (old.lifecycle_status = new.lifecycle_status) then
    return new;
  end if;
  if new.lifecycle_status not in ('preview', 'active') then
    return new;
  end if;
  if old.lifecycle_status not in ('pending_verification', null) then
    -- Already past pending — this isn't a "new signup" event, more likely
    -- a reactivation or a different lifecycle hop.
    return new;
  end if;

  begin
    insert into public.integration_jobs (job_type, payload, provider)
    values (
      'send_agency_notification',
      jsonb_build_object(
        'event_type', 'new_signup',
        'client_id', new.id
      ),
      'webnua_agency'
    );
  exception when others then
    raise warning '[notify_agency_new_signup] enqueue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists clients_notify_agency_new_signup on public.clients;
create trigger clients_notify_agency_new_signup
  after update on public.clients
  for each row
  when (old.lifecycle_status is distinct from new.lifecycle_status)
  execute function private.notify_agency_new_signup();

-- Trigger: a sub-account moved to cancelled / deleted (churn signal).
create or replace function private.notify_agency_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (old.lifecycle_status = new.lifecycle_status) then
    return new;
  end if;
  if new.lifecycle_status not in ('cancelled', 'deleted') then
    return new;
  end if;

  begin
    insert into public.integration_jobs (job_type, payload, provider)
    values (
      'send_agency_notification',
      jsonb_build_object(
        'event_type', 'cancellation',
        'client_id', new.id,
        'lifecycle_status', new.lifecycle_status
      ),
      'webnua_agency'
    );
  exception when others then
    raise warning '[notify_agency_cancellation] enqueue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists clients_notify_agency_cancellation on public.clients;
create trigger clients_notify_agency_cancellation
  after update on public.clients
  for each row
  when (old.lifecycle_status is distinct from new.lifecycle_status)
  execute function private.notify_agency_cancellation();
