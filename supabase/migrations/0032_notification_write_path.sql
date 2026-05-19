-- =============================================================================
-- Webnua backend — Phase 9 · notification write path + Realtime.
--
-- Two halves:
--   1. Notification write path. Nothing ever inserted `notifications` rows —
--      the feed was read-only. AFTER INSERT triggers on leads / bookings /
--      reviews / ticket_messages now fan a notification out to the client's
--      users. The trigger functions run SECURITY DEFINER so they bypass the
--      operator-only insert RLS (notifications_insert) — a fired notification
--      is a system event, not a user action. This is surface-agnostic: it
--      fires whatever inserts the row (form submission, operator reply, the
--      GBP review pull once Phase 7 lands).
--   2. Realtime. notifications / tickets / ticket_messages join the
--      supabase_realtime publication so the browser can subscribe to
--      postgres_changes. RLS still scopes which change events each user sees.
--
-- Triggers only fire forward — existing seed rows get no notifications, by
-- design (no backfill spam).
-- =============================================================================

-- --- helper: fan a notification out to a client's users ----------------------
-- One notification row per client-role user of the client. Operators have no
-- notification surface (CLAUDE.md), so only `role = 'client'` users receive.
create function private.notify_client_users(
  p_client_id   uuid,
  p_kind        notification_kind,
  p_title       text,
  p_entity_type text,
  p_entity_id   uuid
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications
    (recipient_user_id, kind, title, source_entity_type, source_entity_id)
  select u.id, p_kind, p_title, p_entity_type, p_entity_id
  from public.users u
  where u.role = 'client'
    and u.client_id = p_client_id;
$$;

-- --- leads: a new enquiry -----------------------------------------------------
create function private.on_lead_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_client_users(
    new.client_id,
    'lead',
    'New lead — ' || new.customer_name_snapshot,
    'lead',
    new.id);
  return new;
end;
$$;

create trigger leads_notify after insert on public.leads
  for each row execute function private.on_lead_insert();

-- --- bookings: a new one-off booking -----------------------------------------
-- Recurring-schedule bookings are inserted in a ~10-row window; notifying per
-- occurrence would spam the feed, so only one-off bookings fire.
create function private.on_booking_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recurring_schedule_id is null then
    perform private.notify_client_users(
      new.client_id,
      'booking',
      'New booking — ' || new.title,
      'booking',
      new.id);
  end if;
  return new;
end;
$$;

create trigger bookings_notify after insert on public.bookings
  for each row execute function private.on_booking_insert();

-- --- reviews: a new review ---------------------------------------------------
-- Every review fires as kind 'review' (the feed's Reviews tab filters on it);
-- the star count rides in the title. The negative-review intercept is a
-- separate designed surface, not a notification-kind concern.
create function private.on_review_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_client_users(
    new.client_id,
    'review',
    'New ' || new.stars || '★ review from ' || new.author_name,
    'review',
    new.id);
  return new;
end;
$$;

create trigger reviews_notify after insert on public.reviews
  for each row execute function private.on_review_insert();

-- --- ticket_messages: an operator reply --------------------------------------
-- Fires only for non-draft operator replies — a client's own reply must not
-- notify the client. source_entity_id stays null: the ticket detail route
-- keys on the display reference (TKT-NNNN), not the uuid, so the feed links to
-- /tickets and the reference rides in the title.
create function private.on_ticket_message_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_author_role public.user_role;
  v_client_id   uuid;
  v_reference   text;
  v_title       text;
begin
  if new.is_draft then
    return new;
  end if;

  select role into v_author_role
    from public.users where id = new.author_user_id;
  if v_author_role is distinct from 'admin'::public.user_role then
    return new;
  end if;

  select client_id, reference, title
    into v_client_id, v_reference, v_title
    from public.tickets where id = new.ticket_id;

  perform private.notify_client_users(
    v_client_id,
    'alert',
    'Reply on ' || v_reference || ' — ' || v_title,
    'ticket',
    null);
  return new;
end;
$$;

create trigger ticket_messages_notify after insert on public.ticket_messages
  for each row execute function private.on_ticket_message_insert();

-- =============================================================================
-- Realtime. Add the genuinely-live tables to the supabase_realtime publication
-- so the browser can subscribe via postgres_changes. RLS is still applied to
-- broadcast rows for the authenticated role — a client only receives changes
-- to its own rows.
-- =============================================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_messages;
