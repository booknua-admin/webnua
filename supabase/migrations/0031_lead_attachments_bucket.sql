-- =============================================================================
-- Webnua backend — private Storage bucket for lead form attachments.
--
-- When a website / funnel form has an image-upload field, the uploaded image
-- is tenant-private customer data (a photo of a job, a document) — it must
-- NOT live in the public `section-media` bucket. `lead-attachments` is a
-- PRIVATE bucket; the lead inbox reads images via short-lived signed URLs.
--
-- Objects are path-prefixed by client id (`{clientId}/{file}`). The RLS
-- policies check that first path segment against the caller's accessible
-- client set, so a reader only ever sees attachments for clients in scope.
--
-- Insert is `authenticated` only — the editor test-submit works today; an
-- anonymous public visitor cannot upload directly (the future public
-- renderer routes uploads through a service-role edge function).
--
-- Idempotent — safe to re-run.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-attachments',
  'lead-attachments',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Read: only attachments whose `{clientId}/…` prefix is an accessible client.
drop policy if exists "lead_attachments_read" on storage.objects;
create policy "lead_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lead-attachments'
    and (storage.foldername(name))[1] in (
      select private.accessible_client_ids()::text
    )
  );

-- Insert: an authenticated user uploading into an accessible client's prefix.
drop policy if exists "lead_attachments_insert" on storage.objects;
create policy "lead_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lead-attachments'
    and (storage.foldername(name))[1] in (
      select private.accessible_client_ids()::text
    )
  );
