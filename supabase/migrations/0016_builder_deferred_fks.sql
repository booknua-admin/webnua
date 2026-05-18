-- =============================================================================
-- Webnua backend — Phase 1b · resolve deferred builder references.
--
-- Earlier migrations carried builder references as bare uuid/text columns
-- because the builder tables did not exist yet. Now that websites exists
-- (0013), the real FKs are added. Per Option B (builder-data-model §1.5) the
-- page/section context columns stay TEXT soft-references — there is no pages
-- or sections table to FK into; only context_website_id becomes a real FK.
-- =============================================================================

-- capability_grants.website_id (0002) — a per-website grant. NULL stays the
-- workspace-wide ('*') grant; a real website id now FK-references websites.
alter table public.capability_grants
  add constraint capability_grants_website_id_fkey
  foreign key (website_id) references public.websites (id) on delete cascade;

create index capability_grants_website_id_idx on public.capability_grants (website_id);

-- tickets.context_website_id (0009) — the request-change website context.
-- context_page_id / context_section_id deliberately stay TEXT: under Option B
-- pages and sections are snapshot JSON, not tables, so they cannot be FK
-- targets (builder-data-model §6 "FK -> soft-reference changes").
alter table public.tickets
  add constraint tickets_context_website_id_fkey
  foreign key (context_website_id) references public.websites (id) on delete set null;

create index tickets_context_website_id_idx on public.tickets (context_website_id);

-- generation_log.section_type (0011) — created as TEXT because the section_type
-- enum is a builder enum that did not exist until 0012. Promote it now. The
-- table is empty, so the type change carries no data risk.
alter table public.generation_log
  alter column section_type type section_type using section_type::section_type;
