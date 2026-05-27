-- =============================================================================
-- 0106 — Client self-manage RLS widening for automations.
--
-- Closes the long-standing gap where the `/automations` UI lets a client
-- click the toggle (and PR #106 shipped the editor with editable textareas
-- for client-role users in `readOnly={!isOperator}`), but the underlying
-- RLS on `automations_update` + `automation_actions_update` rejects every
-- client-role UPDATE. Result: clients see editable UI that silently fails
-- at the DB.
--
-- Two-step pattern, mirroring migration 0045's `guard_user_identity_columns`
-- precedent (RLS WITH CHECK can't compare OLD vs NEW; a trigger can):
--
--   1. Widen RLS — allow a client-role user on their OWN client's
--      `visibility='client'` automation OR its actions.
--   2. BEFORE UPDATE trigger — restricts WHICH columns a client may change:
--        • automations           — `is_enabled` only
--        • automation_actions    — `action_config.body` and
--                                  `action_config.subject` only (the rest of
--                                  action_config is operator-governed)
--
-- Operators are unaffected — every operator update still goes through the
-- existing operator-only branch of the RLS WITH CHECK; the trigger short-
-- circuits when the caller is an operator.
--
-- platform_internal automations stay operator-only — the new RLS branch
-- explicitly excludes `visibility != 'client'` rows so a client can't
-- enable / disable the operator-facing notifications even by guessing the
-- automation id.
-- =============================================================================

-- =============================================================================
-- 1. Widen automations_update RLS.
-- =============================================================================
drop policy if exists automations_update on public.automations;

create policy automations_update on public.automations
  for update
  to authenticated
  using (
    -- Operator path — unchanged from 0076.
    (private.is_operator() and client_id in (select private.accessible_client_ids()))
    OR
    -- Client path — owns the row's client AND the row is client-visible.
    (
      visibility = 'client'
      and client_id in (select private.accessible_client_ids())
      and exists (
        select 1 from public.users
        where users.id = auth.uid()
          and users.role = 'client'
          and users.client_id = automations.client_id
      )
    )
  )
  with check (
    (private.is_operator() and client_id in (select private.accessible_client_ids()))
    OR
    (
      visibility = 'client'
      and client_id in (select private.accessible_client_ids())
      and exists (
        select 1 from public.users
        where users.id = auth.uid()
          and users.role = 'client'
          and users.client_id = automations.client_id
      )
    )
  );

-- =============================================================================
-- 2. Trigger restricting WHICH columns a client may change.
-- =============================================================================
create or replace function private.guard_client_automation_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_role text;
begin
  -- Operators may change any column; short-circuit.
  if private.is_operator() then
    return new;
  end if;

  -- For a client-role caller, the only column they may modify is is_enabled.
  -- Every other column must equal its OLD value.
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role <> 'client' then
    -- Defence in depth — the RLS WITH CHECK should already have blocked.
    raise exception 'forbidden: only operators or owning client may update automations'
      using errcode = '42501';
  end if;

  if new.client_id          is distinct from old.client_id
     or new.automation_key  is distinct from old.automation_key
     or new.name            is distinct from old.name
     or new.description     is distinct from old.description
     or new.is_default      is distinct from old.is_default
     or new.trigger_type    is distinct from old.trigger_type
     or new.trigger_config  is distinct from old.trigger_config
     or new.trigger_filters is distinct from old.trigger_filters
     or new.visibility      is distinct from old.visibility
  then
    raise exception 'clients may only toggle is_enabled on their own automations'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists automations_guard_client_update on public.automations;
create trigger automations_guard_client_update
  before update on public.automations
  for each row
  execute function private.guard_client_automation_update();

-- =============================================================================
-- 3. Widen automation_actions_update RLS.
-- =============================================================================
drop policy if exists automation_actions_update on public.automation_actions;

create policy automation_actions_update on public.automation_actions
  for update
  to authenticated
  using (
    -- Operator path — unchanged.
    (
      private.is_operator()
      and automation_id in (
        select id from public.automations
        where client_id in (select private.accessible_client_ids())
      )
    )
    OR
    -- Client path — automation belongs to their client AND is visibility='client'.
    (
      automation_id in (
        select id from public.automations
        where visibility = 'client'
          and client_id in (select private.accessible_client_ids())
          and exists (
            select 1 from public.users
            where users.id = auth.uid()
              and users.role = 'client'
              and users.client_id = automations.client_id
          )
      )
    )
  )
  with check (
    (
      private.is_operator()
      and automation_id in (
        select id from public.automations
        where client_id in (select private.accessible_client_ids())
      )
    )
    OR
    (
      automation_id in (
        select id from public.automations
        where visibility = 'client'
          and client_id in (select private.accessible_client_ids())
          and exists (
            select 1 from public.users
            where users.id = auth.uid()
              and users.role = 'client'
              and users.client_id = automations.client_id
          )
      )
    )
  );

-- =============================================================================
-- 4. Trigger restricting WHICH action fields a client may change.
--
-- Clients may edit message COPY (body text, optional email subject) — that
-- is the operator-decided client-managed surface (PR #106). They may NOT
-- change action_type, position, pauses_on_human_activity, or the rest of
-- action_config (template_key, requires_*, delay_minutes, etc.).
--
-- The implementation compares OLD vs NEW action_config at the key level —
-- the `body` and `subject` keys may differ, every other key must match.
-- =============================================================================
create or replace function private.guard_client_action_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_role text;
  v_key text;
begin
  -- Operators may change any field.
  if private.is_operator() then
    return new;
  end if;

  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role <> 'client' then
    raise exception 'forbidden: only operators or owning client may update automation actions'
      using errcode = '42501';
  end if;

  -- Structural fields are operator-only.
  if new.automation_id            is distinct from old.automation_id
     or new.position              is distinct from old.position
     or new.action_type           is distinct from old.action_type
     or new.pauses_on_human_activity is distinct from old.pauses_on_human_activity
  then
    raise exception 'clients may only edit body and subject on their own automation actions'
      using errcode = '42501';
  end if;

  -- For action_config: every key OTHER than `body` and `subject` must be unchanged.
  -- Iterate the union of OLD + NEW keys; check `=` (which is the jsonb equality
  -- via the `->` operator at each key).
  for v_key in
    select distinct k from (
      select jsonb_object_keys(coalesce(old.action_config, '{}'::jsonb)) as k
      union
      select jsonb_object_keys(coalesce(new.action_config, '{}'::jsonb)) as k
    ) keys
  loop
    if v_key in ('body', 'subject') then
      continue;
    end if;
    if (old.action_config -> v_key) is distinct from (new.action_config -> v_key) then
      raise exception 'clients may only edit body and subject on their own automation actions (attempted change to action_config.%)', v_key
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists automation_actions_guard_client_update on public.automation_actions;
create trigger automation_actions_guard_client_update
  before update on public.automation_actions
  for each row
  execute function private.guard_client_action_update();
