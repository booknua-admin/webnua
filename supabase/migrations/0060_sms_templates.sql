-- =============================================================================
-- Webnua backend — Phase 7 Twilio SMS · 0060_sms_templates.sql
--
-- Per-client SMS message templates. Four template keys, one row each per
-- client. The body carries {{variable}} placeholders the template renderer
-- (src/lib/sms/template-renderer.ts) substitutes at send time.
--
-- Seeding: every client gets the four default templates. A new client is
-- seeded by an AFTER INSERT trigger on clients (SECURITY DEFINER, so it
-- bypasses the operator-only write RLS — a seed is a system event, same
-- pattern as the 0032 notification triggers). Existing clients are backfilled
-- at the bottom of this migration.
--
-- The default bodies here MUST stay in lockstep with DEFAULT_SMS_TEMPLATES in
-- src/lib/sms/default-templates.ts — that constant is the runtime fallback the
-- send_sms job uses when a template row is somehow absent. Editing a default
-- message: change both.
--
-- RLS: operators see their accessible clients' templates; client-role users
-- see their own (accessible_client_ids() covers both). Writes are service-role
-- only — the operator template editor saves through an operator-authed API
-- route that writes as service_role, so no operator INSERT/UPDATE policy is
-- needed. The 0018 default DML grant's INSERT/UPDATE/DELETE are revoked.
-- =============================================================================

create table public.sms_templates (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  -- The closed set of template keys — each maps to a transactional moment.
  -- A new key needs a migration (and a code change), by design.
  template_key   text not null
                   check (template_key in
                     ('lead_acknowledgment', 'job_confirmation',
                      'arrival_notification', 'review_request')),
  body           text not null,
  -- true while the body is still the seeded default; flipped false the first
  -- time an operator edits it.
  is_default     boolean not null default true,
  last_edited_at timestamptz not null default now(),
  -- The operator who last edited the body. NULL for an un-edited seed row.
  last_edited_by uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  -- One row per (client, key).
  unique (client_id, template_key)
);

create index sms_templates_client_idx on public.sms_templates (client_id);

-- --- RLS ---------------------------------------------------------------------
alter table public.sms_templates enable row level security;
revoke insert, update, delete on public.sms_templates from authenticated;

create policy sms_templates_select on public.sms_templates
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- --- seed helper -------------------------------------------------------------
-- Insert the four default templates for one client. ON CONFLICT DO NOTHING so
-- it is safe to call against a client that already has some rows.
create function private.seed_sms_templates(p_client_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sms_templates (client_id, template_key, body)
  values
    (p_client_id, 'lead_acknowledgment',
     'Hi {{lead.firstName}}, {{client.shortName}} here. Got your enquiry about {{lead.service}}. We''ll be in touch within {{client.responseTime}}.'),
    (p_client_id, 'job_confirmation',
     '{{client.shortName}}: Confirming your appointment for {{job.date}} at {{job.time}}. We''ll text when we''re on the way.'),
    (p_client_id, 'arrival_notification',
     '{{client.shortName}}: We''re on the way to {{job.address}}. ETA {{job.eta}}. Any questions, ring {{client.phone}}.'),
    (p_client_id, 'review_request',
     'Hi {{lead.firstName}}, hope the work went well today. If you have 30 seconds, would you mind leaving a quick Google review? {{review.link}} Thanks - {{client.shortName}}.')
  on conflict (client_id, template_key) do nothing;
$$;

-- --- new-client trigger ------------------------------------------------------
create function private.on_client_insert_seed_sms_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_sms_templates(new.id);
  return new;
end;
$$;

create trigger clients_seed_sms_templates
  after insert on public.clients
  for each row execute function private.on_client_insert_seed_sms_templates();

-- --- backfill existing clients -----------------------------------------------
do $$
declare
  c record;
begin
  for c in select id from public.clients loop
    perform private.seed_sms_templates(c.id);
  end loop;
end;
$$;
