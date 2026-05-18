-- =============================================================================
-- Webnua backend — Phase 6 · section-library uplift · image upload.
--
-- A public Storage bucket for section media (hero images, gallery photos,
-- etc.). Public so the published site can serve the images directly by URL;
-- uploads are restricted to authenticated users by RLS on storage.objects.
--
-- Idempotent — safe to re-run (the bucket insert is on-conflict-skip; the
-- policies are dropped first).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'section-media',
  'section-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Public read — published websites serve these images to anonymous visitors.
drop policy if exists "section_media_public_read" on storage.objects;
create policy "section_media_public_read" on storage.objects
  for select to public
  using (bucket_id = 'section-media');

-- Authenticated users may upload / replace / remove section media.
drop policy if exists "section_media_auth_insert" on storage.objects;
create policy "section_media_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'section-media');

drop policy if exists "section_media_auth_update" on storage.objects;
create policy "section_media_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'section-media')
  with check (bucket_id = 'section-media');

drop policy if exists "section_media_auth_delete" on storage.objects;
create policy "section_media_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'section-media');
