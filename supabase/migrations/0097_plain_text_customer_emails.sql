-- =============================================================================
-- 0097 — Plain-text customer-facing emails + lead_digest summary fix.
--
-- Two concerns:
--   1. Customer-facing emails (operator → lead) ship plain-text only with the
--      "Powered by Webnua" footer appended at send time (in
--      `src/lib/integrations/resend/job-handlers.ts`). Stop writing/seeding
--      `body_html` for the two customer-facing email automations
--      (`lead_acknowledgment_email`, `review_request_email`) so the stored
--      shape matches the sending shape.
--   2. Migration 0079_platform_email_templates.sql seeded the `lead_digest`
--      platform row without the `{{digest.summary}}` line that
--      `DEFAULT_EMAIL_TEMPLATES.lead_digest` (TS constant) carries. The TS
--      body is the better copy. Align the platform row with it.
--
-- The send path (job-handlers.ts) already forces html='' for customer-facing
-- templates at runtime, so existing rows with stale body_html still send as
-- plain text. This migration normalises stored state to match the new
-- runtime contract.
-- =============================================================================

-- --- 1. Strip body_html from existing per-client customer-facing email actions
-- Reads the action's automation_key via the join to public.automations.
update public.automation_actions a
   set action_config = (a.action_config - 'body_html')
  from public.automations au
 where au.id = a.automation_id
   and au.automation_key in ('lead_acknowledgment_email', 'review_request_email')
   and a.action_config ? 'body_html';

-- --- 2. Re-seed the function — omit body_html for the two customer-facing
-- email actions going forward. Identical to 0079 except for these two
-- jsonb_build_object blocks (no `body_html` key).
create or replace function private.seed_default_automations(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aut_id uuid;
begin
  -- =========================================================================
  -- lead_acknowledgment_sms — fires on a new lead with a phone on file.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_sms',
    'Instant lead confirmation SMS',
    'Sends the moment a new lead lands. Only fires when a phone is on file.',
    true, true, 'lead_created'::public.automation_trigger_type,
    jsonb_build_object('requires_phone', true)
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
  -- lead_acknowledgment_email — customer-facing, plain-text only.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_email',
    'Lead follow-up email',
    'Sends a follow-up email when a new lead lands. Only fires when an email is on file.',
    true, true, 'lead_created'::public.automation_trigger_type,
    jsonb_build_object('requires_email', true)
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
      jsonb_build_object('variant', 'new_lead'),
      false
    );
  end if;

  -- =========================================================================
  -- job_scheduled_confirmation_sms — booking confirmation (default OFF).
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'job_scheduled_confirmation_sms',
    'Booking confirmation SMS',
    'Sends a booking confirmation SMS when a booking is created.',
    false, true, 'job_scheduled'::public.automation_trigger_type,
    jsonb_build_object('requires_phone', true)
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
  -- job_arrival_notification_sms — on the way (default OFF, filtered).
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters
  ) values (
    p_client_id, 'job_arrival_notification_sms',
    'On the way SMS',
    'Sends an arrival notification when a booking is marked on_the_way.',
    false, true, 'job_status_changed'::public.automation_trigger_type,
    jsonb_build_object('to_status', 'on_the_way'),
    jsonb_build_object('requires_phone', true)
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
    jsonb_build_object('delay_minutes', 120),
    jsonb_build_object(
      'requires_phone', true,
      'requires_gbp_location', true
    )
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
  -- review_request_email — customer-facing email fallback, plain-text only.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters
  ) values (
    p_client_id, 'review_request_email',
    'Review request email (no-phone fallback)',
    'Asks the customer for a Google review 2 hours after the job is marked complete, via email. Only fires when the customer has no phone but does have an email, and the client has a connected GBP location.',
    true, true, 'job_completed'::public.automation_trigger_type,
    jsonb_build_object('delay_minutes', 120),
    jsonb_build_object(
      'requires_no_phone', true,
      'requires_email', true,
      'requires_gbp_location', true
    )
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
      jsonb_build_object('variant', 'payment_failed'),
      false
    );
  end if;

  -- =========================================================================
  -- cold_lead_nudge — surfaces stale leads as a follow-up task.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config
  ) values (
    p_client_id, 'cold_lead_nudge',
    'Cold lead follow-up nudge',
    'Surfaces leads that have gone quiet (no inbound for 4+ days since the last outbound) as a follow-up task. Up to 3 nudges per lead. Never sends a message — the client writes the follow-up themselves.',
    true, true, 'lead_inactive'::public.automation_trigger_type,
    jsonb_build_object('days_after_last_outbound', 4, 'max_nudges', 3)
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'create_followup_task'::public.automation_action_type,
      jsonb_build_object('hint', 'Lead has gone quiet — needs a personal nudge.'),
      false
    );
  end if;
end;
$$;

-- --- 3. Fix the lead_digest platform row drift — include `{{digest.summary}}`.
-- The TS constant `DEFAULT_EMAIL_TEMPLATES.lead_digest` carries the summary
-- line; the 0079 seed dropped it. Align.
update public.platform_email_templates
   set body_html =
         '<p>{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.</p>' ||
         '<p>{{digest.summary}}</p>' ||
         '<p><a href="{{platform.inboxLink}}">Open the inbox →</a></p>',
       body_text =
         '{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.' || E'\n\n' ||
         '{{digest.summary}}' || E'\n\n' ||
         'Open the inbox: {{platform.inboxLink}}'
 where template_key = 'lead_digest';
