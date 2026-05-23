-- =============================================================================
-- Webnua backend — Phase 7 Resend · 0064_email_attachments_bucket.sql
--
-- Supabase Storage bucket holding email attachments — both outbound (an
-- operator attaches a file on a reply) and inbound (the Resend inbound
-- webhook re-uploads the attachments from the inbound MIME so the
-- conversation view can display them).
--
-- Object path convention:
--   {client_slug}/{direction}/{email_message_id}/{filename}
--
-- Private bucket — operators / clients render attachments via short-lived
-- signed URLs minted at read time (same pattern as lead-attachments, 0031).
-- Writes are service-role only (the inbound webhook + the reply route both
-- run as service_role).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do nothing;

-- --- RLS on storage.objects --------------------------------------------------
-- The bucket is private; nothing about the policy names here conflicts with
-- the lead-attachments bucket's policies (those are scoped by bucket_id).
-- Reads gated by the email_messages RLS: an authenticated user must own a
-- row in email_messages for the corresponding object_id; the path's first
-- segment (the client slug) is verified against the user's accessible
-- clients so a guess on filename alone cannot read another tenant's file.

create policy "email_attachments_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'email-attachments'
    and split_part(name, '/', 1) in (
      select c.slug from public.clients c
      where c.id in (select private.accessible_client_ids())
    )
  );

-- No INSERT / UPDATE / DELETE policies — service-role writes bypass RLS.
