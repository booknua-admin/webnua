-- =============================================================================
-- Webnua backend — Phase 7 Resend · 0062_email_templates.sql
--
-- Per-client email templates. Same shape as sms_templates (0060): one row per
-- (client, template_key), bodies carry {{variable}} placeholders the template
-- renderer (src/lib/email/templates.ts) substitutes at send time, seeded for
-- every client by an AFTER INSERT trigger.
--
-- Three template keys in V1, each tied to a transactional moment:
--   • lead_followup  — a longer-form follow-up email after the lead
--     acknowledgment SMS (or the only message, when no phone was captured).
--   • review_request — email version of the review request (used when no
--     phone is available, or as a follow-up after the SMS request).
--   • quote_followup — nudges a lead who got a quote and went quiet.
--
-- Each carries an HTML body AND a plain-text body — Resend sends both, and
-- mail clients pick the version they want to render. The defaults below stay
-- in lockstep with DEFAULT_EMAIL_TEMPLATES in
-- src/lib/email/default-templates.ts — that constant is the runtime fallback
-- the send_email job uses if a template row is somehow absent.
--
-- RLS: operators see their accessible clients' templates; client-role users
-- see their own (accessible_client_ids() covers both). Writes are service-role
-- only — the editor saves through an operator-authed API route that writes as
-- service_role. The 0018 default DML grant's INSERT/UPDATE/DELETE are revoked.
-- =============================================================================

create table public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  template_key    text not null
                    check (template_key in
                      ('lead_followup', 'review_request', 'quote_followup',
                       'lead_notification', 'lead_digest')),
  subject         text not null,
  body_html       text not null,
  body_text       text not null,
  is_default      boolean not null default true,
  last_edited_at  timestamptz not null default now(),
  last_edited_by  uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (client_id, template_key)
);

create index email_templates_client_idx on public.email_templates (client_id);

-- --- RLS ---------------------------------------------------------------------
alter table public.email_templates enable row level security;
revoke insert, update, delete on public.email_templates from authenticated;

create policy email_templates_select on public.email_templates
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- --- seed helper -------------------------------------------------------------
-- Insert the default templates for one client. ON CONFLICT DO NOTHING so it
-- is safe against a client that already has some rows.
create function private.seed_email_templates(p_client_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.email_templates (client_id, template_key, subject, body_html, body_text)
  values
    -- lead_followup: customer-facing — a friendly first follow-up.
    (p_client_id, 'lead_followup',
     'Following up on your enquiry — {{client.businessName}}',
     '<p>Hi {{lead.firstName}},</p>' ||
     '<p>{{client.shortName}} here, following up on your enquiry about <strong>{{lead.service}}</strong>.</p>' ||
     '<p>We typically respond within {{client.responseTime}} — if you have any extra detail (timing, photos, what you''ve already tried) please reply to this email and it''ll come straight to my inbox.</p>' ||
     '<p>Thanks,<br/>{{client.shortName}}</p>',
     'Hi {{lead.firstName}},' || E'\n\n' ||
     '{{client.shortName}} here, following up on your enquiry about {{lead.service}}.' || E'\n\n' ||
     'We typically respond within {{client.responseTime}} — if you have any extra detail (timing, photos, what you''ve already tried) please reply to this email and it''ll come straight to my inbox.' || E'\n\n' ||
     'Thanks,' || E'\n' || '{{client.shortName}}'),

    -- review_request: customer-facing — asks for a Google review post-job.
    (p_client_id, 'review_request',
     'Quick favour — would you mind leaving a review?',
     '<p>Hi {{lead.firstName}},</p>' ||
     '<p>Hope the work went well. If you have 30 seconds, would you mind leaving a Google review? It genuinely helps a small business like {{client.businessName}}.</p>' ||
     '<p><a href="{{review.link}}">Leave a review →</a></p>' ||
     '<p>Thanks again,<br/>{{client.shortName}}</p>',
     'Hi {{lead.firstName}},' || E'\n\n' ||
     'Hope the work went well. If you have 30 seconds, would you mind leaving a Google review? It genuinely helps a small business like {{client.businessName}}.' || E'\n\n' ||
     'Leave a review: {{review.link}}' || E'\n\n' ||
     'Thanks again,' || E'\n' || '{{client.shortName}}'),

    -- quote_followup: customer-facing — nudges a quoted lead gone quiet.
    (p_client_id, 'quote_followup',
     'Still keen? — your quote from {{client.businessName}}',
     '<p>Hi {{lead.firstName}},</p>' ||
     '<p>Just checking in on the quote we sent for {{lead.service}}. No pressure either way — if the timing has shifted, or you have any questions, hit reply and I''ll get back to you.</p>' ||
     '<p>Cheers,<br/>{{client.shortName}}</p>',
     'Hi {{lead.firstName}},' || E'\n\n' ||
     'Just checking in on the quote we sent for {{lead.service}}. No pressure either way — if the timing has shifted, or you have any questions, hit reply and I''ll get back to you.' || E'\n\n' ||
     'Cheers,' || E'\n' || '{{client.shortName}}'),

    -- lead_notification: operator-facing — fires when a new lead lands.
    (p_client_id, 'lead_notification',
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

    -- lead_digest: operator-facing — fires when the throttle absorbed a burst
    -- and the digest worker batched the suppressed leads into one summary.
    (p_client_id, 'lead_digest',
     '{{digest.count}} new leads in {{client.businessName}}',
     '<p>{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.</p>' ||
     '<p>{{digest.summary}}</p>' ||
     '<p><a href="{{platform.inboxLink}}">Open the inbox →</a></p>',
     '{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.' || E'\n\n' ||
     '{{digest.summary}}' || E'\n\n' ||
     'Open the inbox: {{platform.inboxLink}}')
  on conflict (client_id, template_key) do nothing;
$$;

-- --- new-client trigger ------------------------------------------------------
create function private.on_client_insert_seed_email_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_email_templates(new.id);
  return new;
end;
$$;

create trigger clients_seed_email_templates
  after insert on public.clients
  for each row execute function private.on_client_insert_seed_email_templates();

-- --- backfill existing clients -----------------------------------------------
do $$
declare
  c record;
begin
  for c in select id from public.clients loop
    perform private.seed_email_templates(c.id);
  end loop;
end;
$$;
