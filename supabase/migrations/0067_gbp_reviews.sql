-- =============================================================================
-- Webnua backend — Phase 7 GBP · gbp_reviews.
--
-- Caches reviews pulled from GBP. The daily gbp_sync_reviews job (migration
-- 0069) upserts rows here from the listReviews API call. Operator + client
-- dashboard widgets read these locally so we don't hit Google on every page
-- load.
--
-- Identity: `gbp_review_id` is the full Google resource name
-- ("accounts/.../locations/.../reviews/...") — globally unique at Google,
-- and we make it unique per client so a one-time per-client upsert is
-- trivial. (Theoretically a review id is globally unique, but two clients
-- can never share a location so per-client unique is safe and cleaner.)
--
-- `is_new_since_last_view` powers the operator dashboard "N new reviews"
-- badge. Set true on insert; an operator marking reviews seen flips it
-- false. NOT a "show in feed" axis — every persisted review stays in the
-- list; only the badge is gated on this.
--
-- Deletion: Google returns reviews that have been deleted at Google with
-- the same review id but no longer in the list response. The sync job
-- detects this and sets `deleted_at_google` so the row stays for audit but
-- drops out of the visible list.
--
-- RLS: operators see their accessible clients' reviews; clients see their
-- own. Writes are service-role only (the sync job + the operator reply
-- route both run against the service role).
-- =============================================================================

create table public.gbp_reviews (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients (id) on delete cascade,

  -- Identity at Google. The full resource name including any leading
  -- "accounts/.../locations/.../reviews/" prefix.
  gbp_review_id            text not null,

  -- Reviewer (may be anonymous — fields are nullable).
  reviewer_name            text,
  reviewer_profile_photo_url text,

  -- Content (1-5 stars; Google rates these as STAR_RATING enum strings, we
  -- convert to int in the client wrapper).
  rating                   integer not null check (rating >= 1 and rating <= 5),
  comment                  text,
  created_at_google        timestamptz not null,
  updated_at_google        timestamptz,

  -- Operator's published reply, when present.
  reply_text               text,
  reply_created_at         timestamptz,

  -- Sync state.
  synced_at                timestamptz not null default now(),
  is_new_since_last_view   boolean not null default true,
  deleted_at_google        timestamptz,

  unique (client_id, gbp_review_id)
);

create index gbp_reviews_client_created_idx
  on public.gbp_reviews (client_id, created_at_google desc)
  where deleted_at_google is null;

create index gbp_reviews_unseen_idx
  on public.gbp_reviews (client_id)
  where is_new_since_last_view = true and deleted_at_google is null;

-- --- RLS ---------------------------------------------------------------------
alter table public.gbp_reviews enable row level security;
revoke insert, update, delete on public.gbp_reviews from authenticated;

create policy gbp_reviews_select on public.gbp_reviews
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
