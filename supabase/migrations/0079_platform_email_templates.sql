-- =============================================================================
-- Webnua backend — Phase 8 · Session 3 · 0079_platform_email_templates.sql
--
-- Platform-level email templates for operator-facing notifications.
--
-- Two template keys live here, not per-client: lead_notification + lead_digest
-- are operator-facing — the same body should fire for every client (they are
-- branded for the Webnua operator, not for the customer's business). The
-- previous per-client rows in `email_templates` for these two keys are now
-- redundant; the `send_lead_notification` + `batch_notification_digest` job
-- handlers read this table FIRST, falling back to per-client rows (legacy),
-- falling back to DEFAULT_EMAIL_TEMPLATES.
--
-- Single row per template_key — no client_id, no per-client variation.
--
-- RLS:
--   • SELECT — operator only (role = 'admin').
--   • UPDATE — operator only.
--   • INSERT / DELETE — service-role only (templates are seeded once;
--     operators edit, they don't create or delete).
--
-- The default bodies below MUST stay in lockstep with
-- DEFAULT_EMAIL_TEMPLATES in src/lib/email/default-templates.ts — that
-- constant is the runtime fallback when both this table AND any per-client
-- row are absent.
-- =============================================================================

create table public.platform_email_templates (
  id              uuid primary key default gen_random_uuid(),
  template_key    text not null unique
                    check (template_key in ('lead_notification', 'lead_digest')),
  subject         text not null,
  body_html       text not null,
  body_text       text not null,
  last_edited_at  timestamptz not null default now(),
  last_edited_by  uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- --- RLS ---------------------------------------------------------------------
alter table public.platform_email_templates enable row level security;
revoke insert, update, delete on public.platform_email_templates from authenticated;

-- Operator-only SELECT — clients have no business reading the platform-level
-- notification templates (they're for Webnua operators, not customers).
create policy platform_email_templates_select on public.platform_email_templates
  for select to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

-- Operator-only UPDATE — re-grant after the blanket revoke.
grant update on public.platform_email_templates to authenticated;

create policy platform_email_templates_update on public.platform_email_templates
  for update to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

-- --- seed ------------------------------------------------------------------
-- Same default copy as the per-client seed in 0062. Editing the defaults
-- means BOTH this migration AND DEFAULT_EMAIL_TEMPLATES in
-- src/lib/email/default-templates.ts.

insert into public.platform_email_templates (template_key, subject, body_html, body_text)
values
  ('lead_notification',
   'New lead: {{lead.firstName}}{{lead.lastNameSuffix}} — {{lead.service}}',
   '<p>You have a new lead in {{client.businessName}}.</p>' ||
   '<p><strong>{{lead.fullName}}</strong><br/>' ||
   '{{lead.phone}}<br/>' ||
   '{{lead.email}}</p>' ||
   '<p><strong>About:</strong> {{lead.service}}</p>' ||
   '<p>{{lead.preview}}</p>' ||
   '<p><a href="{{platform.inboxLink}}">Open in the Webnua inbox →</a></p>',
   'You have a new lead in {{client.businessName}}.' || E'\n\n' ||
   '{{lead.fullName}}' || E'\n' ||
   '{{lead.phone}}' || E'\n' ||
   '{{lead.email}}' || E'\n\n' ||
   'About: {{lead.service}}' || E'\n\n' ||
   '{{lead.preview}}' || E'\n\n' ||
   'Open in the Webnua inbox: {{platform.inboxLink}}'),

  ('lead_digest',
   '{{digest.count}} new leads in {{client.businessName}}',
   '<p>{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.</p>' ||
   '<p><a href="{{platform.inboxLink}}">Open the inbox →</a></p>',
   '{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.' || E'\n\n' ||
   'Open the inbox: {{platform.inboxLink}}')
on conflict (template_key) do nothing;
