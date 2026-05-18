-- =============================================================================
-- Webnua backend — Phase 1 Session A · identity + policy tables.
--
-- backend-schema-design.md §1.1 (identity & org), §1.2 (capability layer),
-- §1.3 (policy layer), §2.1 (clients), §2.3 (customers — NB: customers is an
-- operational table and lands in Session B, not here).
--
-- RLS is enabled + policied in migration 0004. This migration is DDL only.
-- =============================================================================

-- updated_at trigger function. Mutable entities carry created_at + updated_at;
-- this keeps updated_at honest. Append-only / event tables do not use it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --- clients -----------------------------------------------------------------
-- The client business / sub-account. onboarded_by FK is added after `users`
-- exists (clients <-> users is a circular reference).
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  industry              text not null,
  lifecycle_status      client_lifecycle not null default 'onboarding',
  service_area          text,
  primary_contact_name  text,
  primary_contact_email text,
  primary_contact_phone text,
  onboarded_by          uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- --- users -------------------------------------------------------------------
-- The signed-in person. 1:1 with auth.users (shared id). `capabilities` is
-- never stored — it is derived from role defaults + capability_grants.
-- The CHECK encodes the hard rule: an operator has no home client.
create table public.users (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null,
  email          text not null unique,
  role           user_role not null,
  team_role      team_role,
  client_id      uuid references public.clients (id) on delete restrict,
  avatar_initial text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint users_role_shape check (
    (role = 'client' and client_id is not null and team_role is null)
    or
    (role = 'admin'  and client_id is null     and team_role is not null)
  )
);

-- Resolve the circular reference now that users exists.
alter table public.clients
  add constraint clients_onboarded_by_fkey
  foreign key (onboarded_by) references public.users (id) on delete set null;

-- --- brands ------------------------------------------------------------------
-- One brand per client. Voice tone stored as the slider triple (1..5 each).
create table public.brands (
  client_id             uuid primary key references public.clients (id) on delete cascade,
  accent_color          text not null,
  logo_url              text,
  favicon_url           text,
  voice_formality       smallint not null check (voice_formality between 1 and 5),
  voice_urgency         smallint not null check (voice_urgency between 1 and 5),
  voice_technicality    smallint not null check (voice_technicality between 1 and 5),
  audience_line         text not null,
  industry_category     text not null,
  top_jobs_to_be_booked text[] not null default '{}',
  updated_at            timestamptz not null default now()
);

-- --- capability_grants -------------------------------------------------------
-- Per-user, per-website (or workspace-wide) capability grants. website_id NULL
-- = workspace-wide (the stub's '*'). The FK to websites(id) is added in
-- Phase 1b once the websites table exists. NULLS NOT DISTINCT so a user can
-- hold at most one workspace-wide grant row.
create table public.capability_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  website_id   uuid,
  capabilities capability[] not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint capability_grants_user_website_key
    unique nulls not distinct (user_id, website_id)
);

-- --- user_client_access ------------------------------------------------------
-- Which clients a junior operator may see. Owner/operator see all (no rows).
create table public.user_client_access (
  user_id    uuid not null references public.users (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  granted_by uuid not null references public.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

-- --- team_invites ------------------------------------------------------------
-- Operator-side org invite. assignedClientIds -> the team_invite_clients join.
create table public.team_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  full_name     text not null,
  role          team_role not null,
  invited_by    uuid not null references public.users (id),
  invited_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  magic_link    text not null,
  status        invite_status not null default 'pending',
  personal_note text not null default ''
);

create table public.team_invite_clients (
  invite_id uuid not null references public.team_invites (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  primary key (invite_id, client_id)
);

-- --- client_user_invites -----------------------------------------------------
-- A client owner inviting a teammate into their own client account.
create table public.client_user_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  full_name     text not null default '',
  client_id     uuid not null references public.clients (id) on delete cascade,
  invited_by    uuid not null references public.users (id),
  invited_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  magic_link    text not null,
  status        invite_status not null default 'pending',
  personal_note text
);

-- --- seat_limit_changes ------------------------------------------------------
-- Append-only audit log of per-client seat-limit changes. NULL limit =
-- uncapped. No updated_at — an event is never updated.
create table public.seat_limit_changes (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  changed_by     uuid not null references public.users (id),
  changed_at     timestamptz not null default now(),
  previous_limit integer,
  new_limit      integer
);

-- --- agency_policy -----------------------------------------------------------
-- Layer 2 of the policy stack — a global singleton, one row per policy key.
create table public.agency_policy (
  policy_key policy_key primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- --- plan_catalog ------------------------------------------------------------
-- Layer 2.5 — the billing plan catalog. `policy` is a Partial<PolicyValueMap>.
create table public.plan_catalog (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text not null default '',
  price         numeric(10, 2) not null,
  currency      text not null,
  billing_cycle billing_cycle not null,
  policy        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --- plan_assignments --------------------------------------------------------
-- Layer 2.5 assignment. A client with no row is on the no-plan path.
create table public.plan_assignments (
  client_id   uuid primary key references public.clients (id) on delete cascade,
  plan_id     uuid not null references public.plan_catalog (id) on delete restrict,
  assigned_by uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default now()
);

-- --- policy_overrides --------------------------------------------------------
-- Layer 3 — per-sub-account overrides. A (client, key) row absent = inherit.
create table public.policy_overrides (
  client_id  uuid not null references public.clients (id) on delete cascade,
  policy_key policy_key not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, policy_key)
);

-- --- indexes (FK / RLS-hot columns) ------------------------------------------
create index idx_users_client_id on public.users (client_id);
create index idx_user_client_access_client_id on public.user_client_access (client_id);
create index idx_team_invite_clients_client_id on public.team_invite_clients (client_id);
create index idx_client_user_invites_client_id on public.client_user_invites (client_id);
create index idx_seat_limit_changes_client_id on public.seat_limit_changes (client_id);
create index idx_plan_assignments_plan_id on public.plan_assignments (plan_id);

-- --- updated_at triggers (mutable entities only) -----------------------------
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger capability_grants_set_updated_at before update on public.capability_grants
  for each row execute function public.set_updated_at();
create trigger agency_policy_set_updated_at before update on public.agency_policy
  for each row execute function public.set_updated_at();
create trigger plan_catalog_set_updated_at before update on public.plan_catalog
  for each row execute function public.set_updated_at();
create trigger policy_overrides_set_updated_at before update on public.policy_overrides
  for each row execute function public.set_updated_at();
