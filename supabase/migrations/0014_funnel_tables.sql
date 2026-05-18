-- =============================================================================
-- Webnua backend — Phase 1b · funnels + funnel_versions.
--
-- backend-builder-data-model.md §6 — a direct mirror of the website triple,
-- minus the live tables (Option B: there is NO funnel_steps table — steps live
-- in the funnel_versions snapshot { steps, stepOrder }).
--
-- funnels <-> funnel_versions is circular, resolved the same way as websites.
-- =============================================================================

-- --- funnels -----------------------------------------------------------------
create table public.funnels (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  name                 text not null,
  domain_primary       text not null,
  domain_aliases       text[] not null default '{}',
  domain_ssl_status    ssl_status not null default 'pending',
  draft_version_id     uuid, -- FK -> funnel_versions added below
  published_version_id uuid, -- FK -> funnel_versions added below
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --- funnel_versions ---------------------------------------------------------
-- `snapshot` = { steps, stepOrder }, each step carrying its sections[].
create table public.funnel_versions (
  id                uuid primary key default gen_random_uuid(),
  funnel_id         uuid not null references public.funnels (id) on delete cascade,
  status            version_status not null,
  snapshot          jsonb not null,
  created_by        uuid not null references public.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  published_at      timestamptz,
  published_by      uuid references public.users (id) on delete set null,
  notes             text,
  parent_version_id uuid references public.funnel_versions (id) on delete set null
);

-- Resolve the circular reference now that funnel_versions exists.
alter table public.funnels
  add constraint funnels_draft_version_id_fkey
  foreign key (draft_version_id) references public.funnel_versions (id) on delete set null;
alter table public.funnels
  add constraint funnels_published_version_id_fkey
  foreign key (published_version_id) references public.funnel_versions (id) on delete set null;

-- --- indexes -----------------------------------------------------------------
create index funnels_client_id_idx on public.funnels (client_id);
create index funnels_draft_version_id_idx on public.funnels (draft_version_id);
create index funnels_published_version_id_idx on public.funnels (published_version_id);
create index funnel_versions_funnel_id_idx on public.funnel_versions (funnel_id);
create index funnel_versions_created_by_idx on public.funnel_versions (created_by);
create index funnel_versions_published_by_idx on public.funnel_versions (published_by);
create index funnel_versions_parent_version_id_idx on public.funnel_versions (parent_version_id);

-- --- updated_at trigger ------------------------------------------------------
create trigger funnels_set_updated_at before update on public.funnels
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — funnel family is funnel-scoped -> client-scoped. private.has_capability
-- is website-keyed, so funnel-version mutations are gated on tenant access +
-- operator role (funnel publish lanes are deferred — CLAUDE.md parked decision;
-- the shape is pinned now, the capability wiring lands with funnel publish).
-- =============================================================================

-- ===== funnels ===============================================================
alter table public.funnels enable row level security;
-- Read: anyone who can access the owning client.
create policy funnels_select on public.funnels
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
-- Write: operators.
create policy funnels_insert on public.funnels
  for insert to authenticated with check (private.is_operator());
create policy funnels_update on public.funnels
  for update to authenticated
  using (private.is_operator()) with check (private.is_operator());
create policy funnels_delete on public.funnels
  for delete to authenticated using (private.is_operator());

-- ===== funnel_versions =======================================================
alter table public.funnel_versions enable row level security;
-- Read: anyone who can access the funnel's client.
create policy funnel_versions_select on public.funnel_versions
  for select to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = funnel_versions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ));
-- Insert/update/delete: tenant-scoped through the parent funnel. Capability
-- gating tightens when the funnel publish lanes are built.
create policy funnel_versions_insert on public.funnel_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.funnels f
    where f.id = funnel_versions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ));
create policy funnel_versions_update on public.funnel_versions
  for update to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = funnel_versions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ))
  with check (exists (
    select 1 from public.funnels f
    where f.id = funnel_versions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ));
create policy funnel_versions_delete on public.funnel_versions
  for delete to authenticated using (private.is_operator());
