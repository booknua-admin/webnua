-- =============================================================================
-- Webnua backend — Phase 1b · websites + website_versions.
--
-- backend-builder-data-model.md §1.4 (Option B) + §6. The live editable tree
-- is a website_versions row with status='draft' whose `snapshot` JSONB holds
-- the whole content tree { pages, header, footer, nav, pageOrder } — there is
-- NO pages table and NO sections table. websites drops header_section_id /
-- footer_section_id (header + footer live in the snapshot).
--
-- websites <-> website_versions is a circular reference: websites is created
-- without the version-pointer FKs, which are added after website_versions
-- exists (mirrors the 0002 clients <-> users pattern).
-- =============================================================================

-- --- websites ----------------------------------------------------------------
-- domain_* columns are shaped for V2 domain management (§9) — DNS/SSL work is
-- deferred; the columns store what the operator entered.
create table public.websites (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  name                 text not null,
  domain_primary       text not null,
  domain_aliases       text[] not null default '{}',
  domain_ssl_status    ssl_status not null default 'pending',
  draft_version_id     uuid, -- FK -> website_versions added below
  published_version_id uuid, -- FK -> website_versions added below
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --- website_versions --------------------------------------------------------
-- `snapshot` is the frozen denormalised content tree. A draft version is the
-- editable baseline; published versions are immutable; archived versions are
-- kept for the rollback window. Each section object inside the snapshot
-- carries its own schema_version (builder-data-model §3).
create table public.website_versions (
  id                uuid primary key default gen_random_uuid(),
  website_id        uuid not null references public.websites (id) on delete cascade,
  status            version_status not null,
  snapshot          jsonb not null,
  created_by        uuid not null references public.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  published_at      timestamptz,
  published_by      uuid references public.users (id) on delete set null,
  notes             text,
  parent_version_id uuid references public.website_versions (id) on delete set null
);

-- Resolve the circular reference now that website_versions exists.
alter table public.websites
  add constraint websites_draft_version_id_fkey
  foreign key (draft_version_id) references public.website_versions (id) on delete set null;
alter table public.websites
  add constraint websites_published_version_id_fkey
  foreign key (published_version_id) references public.website_versions (id) on delete set null;

-- --- indexes -----------------------------------------------------------------
create index websites_client_id_idx on public.websites (client_id);
create index websites_draft_version_id_idx on public.websites (draft_version_id);
create index websites_published_version_id_idx on public.websites (published_version_id);
create index website_versions_website_id_idx on public.website_versions (website_id);
create index website_versions_created_by_idx on public.website_versions (created_by);
create index website_versions_published_by_idx on public.website_versions (published_by);
create index website_versions_parent_version_id_idx on public.website_versions (parent_version_id);

-- --- updated_at trigger ------------------------------------------------------
-- websites is mutable; website_versions is append-only-ish (a version's
-- snapshot is frozen — only status/published_* transition, no updated_at).
create trigger websites_set_updated_at before update on public.websites
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — builder family is website-scoped -> client-scoped (§4.3). With Option B
-- there are no per-section row policies to write. Version mutations are
-- capability-gated via private.has_capability().
-- =============================================================================

-- ===== websites ==============================================================
alter table public.websites enable row level security;
-- Read: anyone who can access the owning client.
create policy websites_select on public.websites
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
-- Write: operators — creating/renaming a website + domain config is operator
-- work (content edits go through website_versions, capability-gated below).
create policy websites_insert on public.websites
  for insert to authenticated with check (private.is_operator());
create policy websites_update on public.websites
  for update to authenticated
  using (private.is_operator()) with check (private.is_operator());
create policy websites_delete on public.websites
  for delete to authenticated using (private.is_operator());

-- ===== website_versions ======================================================
alter table public.website_versions enable row level security;
-- Read: anyone who can access the website's client.
create policy website_versions_select on public.website_versions
  for select to authenticated
  using (exists (
    select 1 from public.websites w
    where w.id = website_versions.website_id
      and w.client_id in (select private.accessible_client_ids())
  ));
-- Insert: a published version requires the `publish` cap; a draft /
-- pending_approval version requires only an edit cap (Lane B submit, §4.3).
create policy website_versions_insert on public.website_versions
  for insert to authenticated
  with check (private.has_capability(
    website_id,
    case when status = 'published'
      then 'publish'::public.capability
      else 'editSections'::public.capability
    end
  ));
-- Update: promoting/archiving a version is a publish-level act.
create policy website_versions_update on public.website_versions
  for update to authenticated
  using (exists (
    select 1 from public.websites w
    where w.id = website_versions.website_id
      and w.client_id in (select private.accessible_client_ids())
  ))
  with check (private.has_capability(website_id, 'publish'::public.capability));
-- Delete: operators only.
create policy website_versions_delete on public.website_versions
  for delete to authenticated using (private.is_operator());
