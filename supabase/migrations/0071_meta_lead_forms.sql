-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · meta_lead_forms.
--
-- Lead-form catalogue for Meta lead-generation ads. One row per real Meta
-- lead form (created via the Meta API at campaign-launch time, or
-- pre-existing in the customer's account). Used by:
--
--   • campaign-launch.ts — pick / create a lead form before creating the
--     campaign's ad creative.
--   • meta_sync_leads job — when fetching new leads, the form id tells us
--     which Webnua client the lead belongs to.
--
-- RLS — operator-only tenant-scoped (operators manage forms; customers see
-- the leads, not the form definitions). Service-role writes.
-- =============================================================================

create table public.meta_lead_forms (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,

  meta_form_id    text not null unique,                  -- Meta's form id (string of digits)
  meta_page_id    text,                                  -- the FB Page the form is attached to

  form_name       text not null,
  /* The structured field set, as Meta sees it. Snapshot at create time;
   * the live source of truth is Meta, but we keep a local copy so the
   * lead-sync job can map field values back to display labels without an
   * extra API round-trip per lead. Shape: [{ key, label, type, required }] */
  fields          jsonb not null default '[]'::jsonb,

  /* When the form was archived (Meta soft-deletes forms; we keep them for
   * audit + late-arriving leads on inactive forms). */
  archived_at     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index meta_lead_forms_client_id_idx
  on public.meta_lead_forms (client_id);

create trigger meta_lead_forms_set_updated_at
  before update on public.meta_lead_forms
  for each row execute function private.set_updated_at();

-- --- RLS ---------------------------------------------------------------------

alter table public.meta_lead_forms enable row level security;

create policy meta_lead_forms_select on public.meta_lead_forms
  for select to authenticated
  using (client_id = any (private.accessible_client_ids()));

-- Writes are service-role only — every insert/update goes through the
-- campaign-launch route or the lead-form sync job.
