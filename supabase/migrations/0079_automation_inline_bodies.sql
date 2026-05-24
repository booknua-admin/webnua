-- =============================================================================
-- Webnua backend — Phase 8 Session 2 · inline automation bodies.
--
-- Moves SMS + email message bodies (and email subjects) from the per-client
-- `sms_templates` / `email_templates` tables into `automation_actions.action_config`
-- so each comm action carries its own body. This is the architectural decision
-- captured in the Session 2 plan: "Templates live with the automation action
-- that uses them" — there is no longer a separate templates table the action
-- references by key.
--
-- Done in three passes:
--   1. Backfill — copy each existing comm action's body / subject from the
--      referenced `sms_templates` / `email_templates` row into
--      `action_config.body` / `action_config.subject`. After this step every
--      live automation produces identical message content to before — the
--      template lookup is just no longer consulted at send time.
--   2. Re-seed default function — the `seed_default_automations(client)`
--      function now writes the body / subject inline (matched 1:1 against the
--      seeded sms_templates / email_templates bodies from migrations 0060 +
--      0062). Future clients pick up the new automations with the same copy.
--   3. Drop — remove the `sms_templates` + `email_templates` tables, their
--      seed functions, and the per-client INSERT triggers that wrote them.
--      The `template_key` field stays on `action_config` as a free-text label
--      so existing diagnostic logs + the GBP-audit flag still resolve, but
--      nothing reads from the templates tables.
--
-- Plus one helper change: a (client_id, started_at desc) index on
-- `automation_runs` so the "recent runs (last N)" list rendered on every
-- automation detail surface stays cheap as the table grows.
--
-- The `automation_runs` SELECT policy added in migration 0076 already lets
-- operators see runs in their `accessible_client_ids()` set and lets clients
-- see runs for their own client — Session 2's UI just consumes the existing
-- policy. No RLS changes here.
-- =============================================================================

-- --- (1) backfill action bodies --------------------------------------------
-- For every send_sms_to_lead action: copy the body of the sms_templates row
-- referenced by action_config.template_key into action_config.body.
-- Idempotent: skips rows whose action_config.body is already set (so re-runs
-- of this migration during local dev never re-introduce drift).
update public.automation_actions a
   set action_config = a.action_config
     || jsonb_build_object('body', t.body)
  from public.sms_templates t
 where a.action_type = 'send_sms_to_lead'
   and (a.action_config ->> 'body') is null
   and t.template_key = a.action_config ->> 'template_key'
   and t.client_id = (
     select client_id from public.automations
       where id = a.automation_id
   );

-- For every send_email_to_lead action: copy subject + body_html + body_text.
-- We store HTML and plain-text variants since Resend sends both.
update public.automation_actions a
   set action_config = a.action_config
     || jsonb_build_object(
       'subject', t.subject,
       'body_html', t.body_html,
       'body_text', t.body_text
     )
  from public.email_templates t
 where a.action_type = 'send_email_to_lead'
   and (a.action_config ->> 'body_html') is null
   and t.template_key = a.action_config ->> 'template_key'
   and t.client_id = (
     select client_id from public.automations
       where id = a.automation_id
   );

-- --- (2) re-seed default automations function ------------------------------
-- Replaces the function from migration 0077 with one that writes the body /
-- subject inline. The bodies below are copied verbatim from migration 0060
-- (sms_templates seed) and 0062 (email_templates seed) so behaviour is
-- unchanged. **These bodies must stay in lockstep with
-- src/lib/automations/platform-defaults.ts** — the TS module is the platform
-- source of truth at runtime; this SQL version is only used by the
-- new-client INSERT trigger to populate Postgres rows. Edits to either side
-- must be mirrored to keep "fresh client" output matching the TS contract.

create or replace function private.seed_default_automations(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aut_id uuid;
begin
  -- SMS bodies + email payloads — same copy as the previous template seeds.
  --
  -- The body strings include the same `{{var}}` placeholders the template
  -- renderer recognises. Substitution happens at send time, unchanged.

  -- =========================================================================
  -- lead_acknowledgment_sms — instant confirm (only if phone).
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_sms',
    'Instant lead confirmation SMS',
    'Sends the moment a new lead lands. Only fires when a phone is on file.',
    true, true, 'lead_created'::public.automation_trigger_type,
    '{"requires_phone": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'lead_acknowledgment',
        'body',
        E'Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. ' ||
        E'I''ll be in touch within {{client.responseTime}} to sort out {{lead.service}}. ' ||
        E'Reply to this message if you need anything urgent.'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- lead_acknowledgment_email — instant follow-up email (only if email).
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_email',
    'Lead follow-up email',
    'Sends a follow-up email when a new lead lands. Only fires when an email is on file.',
    true, true, 'lead_created'::public.automation_trigger_type,
    '{"requires_email": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'lead_followup',
        'subject', 'Thanks for your enquiry — we''ll be in touch shortly',
        'body_html',
        E'<p>Hi {{lead.firstName}},</p>' ||
        E'<p>Thanks for getting in touch with {{client.businessName}}. ' ||
        E'I''ve seen your enquiry about {{lead.service}} and I''ll reach out within {{client.responseTime}}.</p>' ||
        E'<p>If it''s urgent, you can reach me directly on {{client.phone}}.</p>' ||
        E'<p>— {{client.businessName}}</p>',
        'body_text',
        E'Hi {{lead.firstName}},\n\n' ||
        E'Thanks for getting in touch with {{client.businessName}}. ' ||
        E'I''ve seen your enquiry about {{lead.service}} and I''ll reach out within {{client.responseTime}}.\n\n' ||
        E'If it''s urgent, you can reach me directly on {{client.phone}}.\n\n' ||
        E'— {{client.businessName}}'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- operator_lead_notification — fans the new-lead notification to operators.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type
  ) values (
    p_client_id, 'operator_lead_notification',
    'Operator new-lead notification',
    'Sends configured operators a new-lead notification. Honors per-operator throttle + digest frequency on notification_preferences.',
    true, true, 'lead_created'::public.automation_trigger_type
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_operator_notification'::public.automation_action_type,
      '{"variant": "new_lead"}'::jsonb, false
    );
  end if;

  -- =========================================================================
  -- job_scheduled_confirmation_sms — NEW, opt-in.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'job_scheduled_confirmation_sms',
    'Booking confirmation SMS',
    'Sends a booking confirmation SMS when a booking is created.',
    false, true, 'job_scheduled'::public.automation_trigger_type,
    '{"requires_phone": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'job_confirmation',
        'body',
        E'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' ||
        E'on {{job.date}} at {{job.time}}. We''ll be at {{job.address}}. Reply if anything changes.'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- job_arrival_notification_sms — NEW, opt-in.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters
  ) values (
    p_client_id, 'job_arrival_notification_sms',
    'On the way SMS',
    'Sends an arrival notification when a booking is marked on_the_way.',
    false, true, 'job_status_changed'::public.automation_trigger_type,
    '{"to_status": "on_the_way"}'::jsonb,
    '{"requires_phone": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'arrival_notification',
        'body',
        E'Hi {{lead.firstName}}, {{client.businessName}} here — we''re on the way. ' ||
        E'ETA {{job.eta}}. See you shortly!'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- review_request_sms — 2 h after job completed (GBP-gated).
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters
  ) values (
    p_client_id, 'review_request_sms',
    'Review request SMS (2h after job)',
    'Asks the customer for a Google review 2 hours after the job is marked complete. Only fires when the customer has a phone and the client has a connected GBP location.',
    true, true, 'job_completed'::public.automation_trigger_type,
    '{"delay_minutes": 120}'::jsonb,
    '{"requires_phone": true, "requires_gbp_location": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'review_request',
        'writes_gbp_review_request_audit', true,
        'body',
        E'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' ||
        E'If you''ve a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- review_request_email — email fallback for no-phone leads.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters
  ) values (
    p_client_id, 'review_request_email',
    'Review request email (no-phone fallback)',
    'Asks the customer for a Google review 2 hours after the job is marked complete, via email. Only fires when the customer has no phone but does have an email, and the client has a connected GBP location.',
    true, true, 'job_completed'::public.automation_trigger_type,
    '{"delay_minutes": 120}'::jsonb,
    '{"requires_no_phone": true, "requires_email": true, "requires_gbp_location": true}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'review_request',
        'writes_gbp_review_request_audit', true,
        'subject', 'Quick favour — a Google review for {{client.businessName}}',
        'body_html',
        E'<p>Hi {{lead.firstName}},</p>' ||
        E'<p>Thanks for choosing {{client.businessName}} — it''s been a pleasure working with you.</p>' ||
        E'<p>If you have a minute, a quick Google review would mean the world: ' ||
        E'<a href="{{review.link}}">leave a review</a>.</p>' ||
        E'<p>Cheers,<br/>{{client.businessName}}</p>',
        'body_text',
        E'Hi {{lead.firstName}},\n\n' ||
        E'Thanks for choosing {{client.businessName}} — it''s been a pleasure working with you.\n\n' ||
        E'If you have a minute, a quick Google review would mean the world:\n{{review.link}}\n\n' ||
        E'Cheers,\n{{client.businessName}}'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- payment_failed_notification — operator alert.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type
  ) values (
    p_client_id, 'payment_failed_notification',
    'Payment failed operator alert',
    'Emails the operator(s) when a Stripe subscription payment fails.',
    true, true, 'payment_failed'::public.automation_trigger_type
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_operator_notification'::public.automation_action_type,
      '{"variant": "payment_failed"}'::jsonb, false
    );
  end if;

  -- =========================================================================
  -- cold_lead_nudge — surfaces stalled leads. No body — surfaces a task.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config
  ) values (
    p_client_id, 'cold_lead_nudge',
    'Cold lead follow-up nudge',
    'Surfaces leads that have gone quiet (no inbound for 4+ days since the last outbound) as a follow-up task. Up to 3 nudges per lead. Never sends a message — the client writes the follow-up themselves.',
    true, true, 'lead_inactive'::public.automation_trigger_type,
    '{"days_after_last_outbound": 4, "max_nudges": 3}'::jsonb
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'create_followup_task'::public.automation_action_type,
      '{"hint": "Lead has gone quiet — needs a personal nudge."}'::jsonb, false
    );
  end if;
end;
$$;

-- --- (3) drop the templates tables -----------------------------------------
-- The per-client INSERT triggers that seeded sms_templates / email_templates
-- live on `public.clients` from migrations 0060 + 0062. Drop them first so
-- their function bodies don't reference dropped tables.

drop trigger if exists clients_seed_sms_templates on public.clients;
drop trigger if exists clients_seed_email_templates on public.clients;
drop function if exists private.on_client_insert_seed_sms_templates() cascade;
drop function if exists private.on_client_insert_seed_email_templates() cascade;
drop function if exists private.seed_sms_templates(uuid) cascade;
drop function if exists private.seed_email_templates(uuid) cascade;

drop table if exists public.sms_templates cascade;
drop table if exists public.email_templates cascade;

-- --- (4) automation_runs — recent-list index --------------------------------
-- Most queries against this table are "give me the last N runs for an
-- automation" or "the last N runs for a client" — a (client_id, started_at)
-- index keeps the recent-runs panel cheap regardless of total volume.
create index if not exists automation_runs_client_recent_idx
  on public.automation_runs (client_id, started_at desc);

-- Plus the per-automation variant for the editor's "last 20 runs" rail.
create index if not exists automation_runs_automation_recent_idx
  on public.automation_runs (automation_id, started_at desc);
