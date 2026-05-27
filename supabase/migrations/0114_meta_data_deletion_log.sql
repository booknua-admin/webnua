-- =============================================================================
-- 0114_meta_data_deletion_log.sql
--
-- Meta App Review — User Data Deletion compliance.
--
-- Meta requires every app that uses Facebook Login + sensitive permissions
-- to (a) provide a deletion mechanism + (b) return a confirmation URL the
-- user can visit to verify the deletion happened. This table stores one
-- row per deletion event so /data-deletion/[code] has something to show.
--
-- The `code` is the opaque public identifier (UUID). The `meta_user_id` is
-- intentionally NOT exposed by the public read policy — it is PII. The
-- public status page selects only safe columns.
--
-- Initiated paths:
--   • 'meta_webhook' — Meta calls /api/integrations/meta_ads/data-deletion
--                      when the user removes our app from their FB settings
--   • 'in_app'       — operator/customer clicks "Disconnect & delete data"
--                      on /settings/integrations
-- =============================================================================

create table if not exists public.meta_data_deletion_log (
  code              uuid primary key default gen_random_uuid(),
  meta_user_id      text,             -- the Facebook user id; nullable for in-app deletions where we may not know it
  client_ids_count  int not null,     -- how many tenants the deletion touched
  deleted_resources jsonb not null,   -- string[] of resource names removed
  initiated_by      text not null check (initiated_by in ('meta_webhook', 'in_app')),
  initiated_by_user uuid references public.users(id) on delete set null,  -- the operator/customer who clicked the in-app affordance
  deleted_at        timestamptz not null default now()
);

comment on table public.meta_data_deletion_log is
  'Audit log of Meta data deletion events. Backs the public status page Meta requires (/data-deletion/[code]) and gives the operator a paper trail.';

comment on column public.meta_data_deletion_log.code is
  'Opaque public identifier surfaced as the confirmation_code in Meta''s deletion webhook response.';

comment on column public.meta_data_deletion_log.meta_user_id is
  'Facebook user id whose data was deleted (PII — never expose via public read).';

create index if not exists meta_data_deletion_log_meta_user_id_idx
  on public.meta_data_deletion_log (meta_user_id);

create index if not exists meta_data_deletion_log_deleted_at_idx
  on public.meta_data_deletion_log (deleted_at desc);

-- RLS: the code is the auth token. Anyone with the code can see the safe
-- columns (resources + when). The public read policy CANNOT expose
-- meta_user_id — the status page selects an explicit column subset to enforce.
alter table public.meta_data_deletion_log enable row level security;

drop policy if exists "meta_data_deletion_log_select" on public.meta_data_deletion_log;
create policy "meta_data_deletion_log_select"
  on public.meta_data_deletion_log
  for select
  to anon, authenticated
  using (true);

-- Writes are service-role only — the deletion routes use the integration db
-- helper (service role) so no insert/update/delete policies for app users.
