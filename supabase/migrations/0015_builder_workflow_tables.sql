-- =============================================================================
-- Webnua backend — Phase 1b · content_drafts + approval + force-publish audit.
--
-- backend-builder-data-model.md §2 (autosave write-buffer), §6;
-- backend-schema-design.md §1.5 (website_approval_submissions),
-- §1.2 (force_publish_audit_log), §4.3 (RLS).
-- =============================================================================

-- --- content_drafts ----------------------------------------------------------
-- The autosave write-buffer (§2). A transient per-page/per-step buffer that
-- merges over the draft version's baseline snapshot. The polymorphic
-- nullable-website_id/funnel_id shape is acceptable here BECAUSE this is a
-- transient buffer, not the content model ([JC-B1]). page_key is the page/step
-- id for 'page'/'funnel_step' scopes; null for 'header'/'footer'.
create table public.content_drafts (
  id          uuid primary key default gen_random_uuid(),
  scope_kind  draft_scope_kind not null,
  website_id  uuid references public.websites (id) on delete cascade,
  funnel_id   uuid references public.funnels (id) on delete cascade,
  page_key    text,
  sections    jsonb not null,
  saved_at    timestamptz not null,
  updated_by  uuid not null references public.users (id) on delete restrict,
  -- One buffer row per editable scope. NULLS NOT DISTINCT so the null
  -- funnel_id (website draft) / null page_key (header/footer) collapse to one.
  constraint content_drafts_scope_key
    unique nulls not distinct (scope_kind, website_id, funnel_id, page_key)
);

-- --- website_approval_submissions --------------------------------------------
-- Lane B pending-review submissions. The submission references
-- pending_version_id (the version already holds the snapshot — §5 #10: no
-- duplicated blob). `diff` is the computed { pagesChanged, sectionsChanged,
-- fieldsChanged } summary.
create table public.website_approval_submissions (
  id                 uuid primary key default gen_random_uuid(),
  website_id         uuid not null references public.websites (id) on delete cascade,
  pending_version_id uuid not null references public.website_versions (id) on delete cascade,
  submitter_id       uuid not null references public.users (id) on delete restrict,
  submitted_at       timestamptz not null default now(),
  status             approval_status not null default 'pending',
  note               text,
  diff               jsonb not null,
  rejection_reason   text,
  resolved_at        timestamptz,
  resolved_by        uuid references public.users (id) on delete set null
);

-- --- funnel_approval_submissions ---------------------------------------------
-- Pre-aligned mirror of the website table (CLAUDE.md parked decision — funnel
-- publish lanes are deferred; the shape is pinned now so the future lift is
-- typing). Invented — no stub yet.
create table public.funnel_approval_submissions (
  id                        uuid primary key default gen_random_uuid(),
  funnel_id                 uuid not null references public.funnels (id) on delete cascade,
  pending_funnel_version_id uuid not null references public.funnel_versions (id) on delete cascade,
  submitter_id              uuid not null references public.users (id) on delete restrict,
  submitted_at              timestamptz not null default now(),
  status                    approval_status not null default 'pending',
  note                      text,
  diff                      jsonb not null,
  rejection_reason          text,
  resolved_at               timestamptz,
  resolved_by               uuid references public.users (id) on delete set null
);

-- --- force_publish_audit_log -------------------------------------------------
-- Break-glass force-publish audit trail. Force-publish is NOT a capability — it
-- is `publish` + audit discipline. `reason` is NOT NULL so a force-publish that
-- captures nothing is impossible at the DB level (vision §7). Append-only.
create table public.force_publish_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid not null references public.users (id) on delete restrict,
  website_id     uuid not null references public.websites (id) on delete cascade,
  new_version_id uuid not null references public.website_versions (id) on delete cascade,
  reason         text not null,
  created_at     timestamptz not null default now()
);

-- --- indexes -----------------------------------------------------------------
create index content_drafts_website_id_idx on public.content_drafts (website_id);
create index content_drafts_funnel_id_idx on public.content_drafts (funnel_id);
create index content_drafts_updated_by_idx on public.content_drafts (updated_by);
create index website_approval_submissions_website_id_idx on public.website_approval_submissions (website_id);
create index website_approval_submissions_pending_version_id_idx on public.website_approval_submissions (pending_version_id);
create index website_approval_submissions_submitter_id_idx on public.website_approval_submissions (submitter_id);
create index website_approval_submissions_resolved_by_idx on public.website_approval_submissions (resolved_by);
create index funnel_approval_submissions_funnel_id_idx on public.funnel_approval_submissions (funnel_id);
create index funnel_approval_submissions_pending_fv_id_idx on public.funnel_approval_submissions (pending_funnel_version_id);
create index funnel_approval_submissions_submitter_id_idx on public.funnel_approval_submissions (submitter_id);
create index funnel_approval_submissions_resolved_by_idx on public.funnel_approval_submissions (resolved_by);
create index force_publish_audit_log_actor_user_id_idx on public.force_publish_audit_log (actor_user_id);
create index force_publish_audit_log_website_id_idx on public.force_publish_audit_log (website_id);
create index force_publish_audit_log_new_version_id_idx on public.force_publish_audit_log (new_version_id);

-- =============================================================================
-- RLS.
-- =============================================================================

-- ===== content_drafts ========================================================
alter table public.content_drafts enable row level security;
-- Resolve the client through whichever parent (website OR funnel) is set.
-- Read: anyone who can access the owning client. Write: the editing user only
-- (the buffer is the user's own unsaved work), within an accessible client.
create policy content_drafts_select on public.content_drafts
  for select to authenticated
  using (
    (website_id is not null and exists (
      select 1 from public.websites w
      where w.id = content_drafts.website_id
        and w.client_id in (select private.accessible_client_ids())))
    or (funnel_id is not null and exists (
      select 1 from public.funnels f
      where f.id = content_drafts.funnel_id
        and f.client_id in (select private.accessible_client_ids())))
  );
create policy content_drafts_insert on public.content_drafts
  for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and (
      (website_id is not null and exists (
        select 1 from public.websites w
        where w.id = content_drafts.website_id
          and w.client_id in (select private.accessible_client_ids())))
      or (funnel_id is not null and exists (
        select 1 from public.funnels f
        where f.id = content_drafts.funnel_id
          and f.client_id in (select private.accessible_client_ids())))
    )
  );
create policy content_drafts_update on public.content_drafts
  for update to authenticated
  using (updated_by = (select auth.uid()))
  with check (updated_by = (select auth.uid()));
create policy content_drafts_delete on public.content_drafts
  for delete to authenticated
  using (updated_by = (select auth.uid()) or private.is_operator());

-- ===== website_approval_submissions ==========================================
alter table public.website_approval_submissions enable row level security;
-- Read: anyone who can access the website's client.
create policy website_approval_submissions_select on public.website_approval_submissions
  for select to authenticated
  using (exists (
    select 1 from public.websites w
    where w.id = website_approval_submissions.website_id
      and w.client_id in (select private.accessible_client_ids())
  ));
-- Insert: the submitter, holding any edit cap on the website (Lane B submit).
create policy website_approval_submissions_insert on public.website_approval_submissions
  for insert to authenticated
  with check (
    submitter_id = (select auth.uid())
    and private.has_capability(website_id, 'editSections'::public.capability)
  );
-- Update: an approver resolves (approve/reject); the submitter may recall.
create policy website_approval_submissions_update on public.website_approval_submissions
  for update to authenticated
  using (exists (
    select 1 from public.websites w
    where w.id = website_approval_submissions.website_id
      and w.client_id in (select private.accessible_client_ids())
  ))
  with check (
    private.has_capability(website_id, 'approve'::public.capability)
    or submitter_id = (select auth.uid())
  );
-- Delete: operators only.
create policy website_approval_submissions_delete on public.website_approval_submissions
  for delete to authenticated using (private.is_operator());

-- ===== funnel_approval_submissions ===========================================
alter table public.funnel_approval_submissions enable row level security;
-- Read: anyone who can access the funnel's client.
create policy funnel_approval_submissions_select on public.funnel_approval_submissions
  for select to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = funnel_approval_submissions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ));
-- Insert: the submitter, within an accessible client. Update: an operator
-- resolves, or the submitter recalls. Capability gating tightens with the
-- funnel publish lanes.
create policy funnel_approval_submissions_insert on public.funnel_approval_submissions
  for insert to authenticated
  with check (
    submitter_id = (select auth.uid())
    and exists (
      select 1 from public.funnels f
      where f.id = funnel_approval_submissions.funnel_id
        and f.client_id in (select private.accessible_client_ids()))
  );
create policy funnel_approval_submissions_update on public.funnel_approval_submissions
  for update to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = funnel_approval_submissions.funnel_id
      and f.client_id in (select private.accessible_client_ids())
  ))
  with check (private.is_operator() or submitter_id = (select auth.uid()));
create policy funnel_approval_submissions_delete on public.funnel_approval_submissions
  for delete to authenticated using (private.is_operator());

-- ===== force_publish_audit_log ===============================================
alter table public.force_publish_audit_log enable row level security;
-- Read: operators, for a website whose client they can access. Append-only:
-- no update/delete policy. Insert: an operator, alongside a force-publish.
create policy force_publish_audit_log_select on public.force_publish_audit_log
  for select to authenticated
  using (
    private.is_operator()
    and exists (
      select 1 from public.websites w
      where w.id = force_publish_audit_log.website_id
        and w.client_id in (select private.accessible_client_ids()))
  );
create policy force_publish_audit_log_insert on public.force_publish_audit_log
  for insert to authenticated
  with check (
    private.is_operator()
    and actor_user_id = (select auth.uid())
  );
