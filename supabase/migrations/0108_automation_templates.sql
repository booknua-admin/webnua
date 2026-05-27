-- =============================================================================
-- 0108 — Operator-authored automation templates + per-client assignment.
--
-- The current automation library has two halves:
--
--   1. DEFAULT library — the closed set seeded by `seed_default_automations()`
--      (lead_acknowledgment, review_request, cold_lead_nudge,
--      booking_confirmation, arrival_notification + the two platform-internal
--      automations). Every client receives all of these automatically.
--
--   2. CUSTOM library (NEW) — operator-authored templates. The operator
--      builds these from a /admin/automation-templates surface (V2 UI),
--      and EXPLICITLY assigns them to specific clients. NOT auto-seeded.
--
-- This migration creates the storage for the custom library:
--
--   • automation_templates           — the template definitions (operator
--                                       authors here; one row per template).
--   • automation_template_actions    — the action steps per template
--                                       (cascade-deleted with the template).
--   • automation_assignments         — which templates are assigned to which
--                                       clients. Inserting a row "deploys"
--                                       the template — a real automations
--                                       row is created via assign_template
--                                       and the assignment links back to it.
--
-- All three are operator-only RLS. Clients can't see or interact with these
-- tables — the templates become regular `automations` rows on assignment,
-- and clients only ever see those.
-- =============================================================================

-- =============================================================================
-- 1. automation_templates
-- =============================================================================
create table if not exists public.automation_templates (
  id              uuid primary key default gen_random_uuid(),
  template_key    text not null unique,
  name            text not null,
  description     text,
  trigger_type    public.automation_trigger_type not null,
  trigger_config  jsonb,
  trigger_filters jsonb,
  is_active       boolean not null default true,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.automation_templates is
  'Operator-authored automation templates. The default library lives in the seed function (seed_default_automations); these are the EXTRA automations a specific operator builds and assigns to specific clients (Stream C, but operator-curated).';

alter table public.automation_templates enable row level security;
revoke insert, update, delete on public.automation_templates from authenticated;

drop policy if exists automation_templates_all on public.automation_templates;
create policy automation_templates_all on public.automation_templates
  for all to authenticated
  using (private.is_operator())
  with check (private.is_operator());

grant insert, update, delete on public.automation_templates to authenticated;

-- =============================================================================
-- 2. automation_template_actions
-- =============================================================================
create table if not exists public.automation_template_actions (
  id                          uuid primary key default gen_random_uuid(),
  template_id                 uuid not null references public.automation_templates(id) on delete cascade,
  position                    int not null,
  action_type                 public.automation_action_type not null,
  action_config               jsonb not null default '{}'::jsonb,
  pauses_on_human_activity    boolean not null default true,
  created_at                  timestamptz not null default now(),
  unique (template_id, position)
);

comment on table public.automation_template_actions is
  'The action steps belonging to an operator-authored template. Same shape as automation_actions; copied verbatim into automation_actions on assignment.';

create index if not exists automation_template_actions_template_idx
  on public.automation_template_actions (template_id, position);

alter table public.automation_template_actions enable row level security;
revoke insert, update, delete on public.automation_template_actions from authenticated;

drop policy if exists automation_template_actions_all on public.automation_template_actions;
create policy automation_template_actions_all on public.automation_template_actions
  for all to authenticated
  using (private.is_operator())
  with check (private.is_operator());

grant insert, update, delete on public.automation_template_actions to authenticated;

-- =============================================================================
-- 3. automation_assignments — per-client deployment of a custom template
-- =============================================================================
create table if not exists public.automation_assignments (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references public.automation_templates(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  -- The automations row created when the template is assigned. SET NULL on
  -- delete so the assignment-history row survives an automation deletion
  -- (the operator can re-deploy by inserting a fresh automations row).
  automation_id       uuid references public.automations(id) on delete set null,
  assigned_by         uuid references public.users(id) on delete set null,
  assigned_at         timestamptz not null default now(),
  is_active           boolean not null default true,
  -- The pricing-tier / plan hook — a template can be on a plan, free, etc.
  -- V1 ignores this; V2 might gate by sub-account plan.
  pricing_tier        text,
  unique (template_id, client_id)
);

comment on table public.automation_assignments is
  'Per-client assignment of an operator-authored automation_template. Inserting a row creates a real automations row from the template; deleting unassigns (the automations row may persist for audit unless cascade is configured).';

create index if not exists automation_assignments_client_idx
  on public.automation_assignments (client_id) where is_active = true;
create index if not exists automation_assignments_template_idx
  on public.automation_assignments (template_id) where is_active = true;

alter table public.automation_assignments enable row level security;
revoke insert, update, delete on public.automation_assignments from authenticated;

drop policy if exists automation_assignments_all on public.automation_assignments;
create policy automation_assignments_all on public.automation_assignments
  for all to authenticated
  using (private.is_operator())
  with check (private.is_operator());

grant insert, update, delete on public.automation_assignments to authenticated;

-- =============================================================================
-- 4. assign_template_to_client — atomic "deploy template to client" function.
--
-- Copies the template + its actions into the regular automations +
-- automation_actions tables (so the engine picks them up alongside default
-- automations), then writes the link row to automation_assignments.
--
-- Idempotent: re-running for the same (template_id, client_id) is a no-op
-- (returns the existing automations row id).
--
-- Operator-only via the RLS on automation_assignments — the SECURITY DEFINER
-- function checks before performing the copy.
-- =============================================================================
create or replace function public.assign_template_to_client(
  p_template_id uuid,
  p_client_id   uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_template public.automation_templates%rowtype;
  v_existing_automation_id uuid;
  v_new_automation_id uuid;
  v_action record;
  v_auto_key text;
begin
  -- Auth: operator only.
  if not private.is_operator() then
    raise exception 'forbidden: assign_template_to_client requires operator role'
      using errcode = '42501';
  end if;

  -- Resolve template.
  select * into v_template from public.automation_templates where id = p_template_id;
  if not found then
    raise exception 'template not found: %', p_template_id;
  end if;
  if v_template.is_active = false then
    raise exception 'template is inactive: %', p_template_id;
  end if;

  -- Resolve client.
  perform 1 from public.clients where id = p_client_id;
  if not found then
    raise exception 'client not found: %', p_client_id;
  end if;

  -- Idempotency — if an assignment already exists, return its automation_id.
  select automation_id into v_existing_automation_id
    from public.automation_assignments
   where template_id = p_template_id and client_id = p_client_id;
  if v_existing_automation_id is not null then
    return v_existing_automation_id;
  end if;

  -- Compose a client-scoped automation_key from the template_key so
  -- (client_id, automation_key) stays unique. Prefix with `custom_` to make
  -- it obvious in DB queries that this came from a template.
  v_auto_key := 'custom_' || v_template.template_key;

  -- Copy template → automations.
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters, visibility
  ) values (
    p_client_id, v_auto_key, v_template.name, v_template.description,
    true, false, v_template.trigger_type, v_template.trigger_config,
    v_template.trigger_filters, 'client'
  )
  on conflict (client_id, automation_key) do update set
    name = excluded.name,
    description = excluded.description,
    is_enabled = true,
    trigger_type = excluded.trigger_type,
    trigger_config = excluded.trigger_config,
    trigger_filters = excluded.trigger_filters
  returning id into v_new_automation_id;

  -- Copy template actions → automation_actions. Clear any pre-existing
  -- actions on the new automation first (idempotency on the upsert path).
  delete from public.automation_actions where automation_id = v_new_automation_id;
  for v_action in
    select position, action_type, action_config, pauses_on_human_activity
      from public.automation_template_actions
     where template_id = p_template_id
     order by position
  loop
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_new_automation_id, v_action.position, v_action.action_type,
      v_action.action_config, v_action.pauses_on_human_activity
    );
  end loop;

  -- Write the assignment row.
  insert into public.automation_assignments (
    template_id, client_id, automation_id, assigned_by, is_active
  ) values (
    p_template_id, p_client_id, v_new_automation_id, auth.uid(), true
  )
  on conflict (template_id, client_id) do update set
    automation_id = excluded.automation_id,
    is_active = true,
    assigned_at = now();

  return v_new_automation_id;
end;
$$;

revoke execute on function public.assign_template_to_client(uuid, uuid) from public;
grant execute on function public.assign_template_to_client(uuid, uuid) to authenticated;

-- =============================================================================
-- 5. revoke_template_from_client — disable the assigned automation.
--
-- Disables the automations row (is_enabled = false) and marks the
-- assignment row inactive. Deliberately does NOT delete the automations
-- row — preserves audit history + lets the operator re-enable with the
-- existing copy edits via re-assignment.
-- =============================================================================
create or replace function public.revoke_template_from_client(
  p_template_id uuid,
  p_client_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_automation_id uuid;
begin
  if not private.is_operator() then
    raise exception 'forbidden: revoke_template_from_client requires operator role'
      using errcode = '42501';
  end if;

  select automation_id into v_automation_id
    from public.automation_assignments
   where template_id = p_template_id and client_id = p_client_id;
  if v_automation_id is null then return; end if;

  update public.automations set is_enabled = false where id = v_automation_id;
  update public.automation_assignments
     set is_active = false
   where template_id = p_template_id and client_id = p_client_id;
end;
$$;

revoke execute on function public.revoke_template_from_client(uuid, uuid) from public;
grant execute on function public.revoke_template_from_client(uuid, uuid) to authenticated;
