-- =============================================================================
-- 0110 — Flip the default automation channel preference from SMS to email.
--
-- Twilio costs ~€0.05/segment per send; Resend is effectively free at the
-- volumes Webnua operates at. Defaults should favour email + use SMS only
-- as a fallback when no email is on file. Customers/operators can still
-- edit any action body OR add an SMS action explicitly when they want the
-- channel — this just changes what ships by default.
--
-- Three automations rewired:
--
--   lead_acknowledgment
--     before  position 1 = SMS (requires_phone)
--             position 2 = email (requires_email)
--     after   position 1 = email (requires_email)              ← primary
--             position 2 = SMS  (requires_phone + requires_no_email)
--             both fire if a lead has BOTH → previously two sends
--             now → email only (cheaper, less noisy)
--
--   review_request
--     before  position 1 = SMS (requires_phone)                ← primary
--             position 2 = email (requires_email + no_phone)
--     after   position 1 = email (requires_email)              ← primary
--             position 2 = SMS  (requires_phone + requires_no_email)
--
--   booking_confirmation
--     before  position 1 = SMS only (requires_phone), off by default
--     after   position 1 = email (requires_email), off by default
--             position 2 = SMS  (requires_phone + requires_no_email)
--             new email confirmation; SMS becomes the fallback
--
--   arrival_notification — UNCHANGED. The "your technician is N minutes
--                          away" moment is time-sensitive enough that
--                          SMS open rates (>90%) outweigh the cost
--                          concern. Off by default; operator opt-in if
--                          they want it.
--
-- Resolver impact (lib/integrations/gbp/job-handlers.ts):
--   resolveReviewRequestSmsBody now reads position 2 (was 1).
--   resolveReviewRequestEmailParts now reads position 1 (was 2).
--
-- Same SoT-mirror discipline as 0109 — bodies live both here AND in
-- src/lib/automations/platform-defaults.ts; edits to either must apply to
-- both.
-- =============================================================================

-- =============================================================================
-- 1. Replace the seed function — emails primary, SMS fallback.
-- =============================================================================
create or replace function private.seed_default_automations(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_aut_id uuid;
begin
  -- =========================================================================
  -- LEAD CAPTURE — Instant lead reply (EMAIL primary, SMS fallback)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'lead_acknowledgment',
    'Instant lead reply',
    'Fires the moment a new lead lands. Sends an email when an email is on file; falls back to SMS only when the lead has no email but does have a phone. Email is preferred to keep send costs down.',
    true, true, 'lead_created'::public.automation_trigger_type, 'client'
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    -- Position 1: email (primary) — fires whenever an email is on file.
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'lead_followup',
        'requires_email', true,
        'subject', 'Thanks for your enquiry — we''ll be in touch shortly',
        'body',
          E'Hi {{lead.firstName}},\n\n' ||
          'Thanks for getting in touch with {{client.businessName}}. ' ||
          E'I''ve seen your enquiry about {{lead.service}} and I''ll reach out within {{client.responseTime}}.\n\n' ||
          E'If it''s urgent, you can reach me directly on {{client.phone}}.\n\n' ||
          '— {{client.businessName}}'
      ),
      true
    );
    -- Position 2: SMS (fallback) — only fires when the lead has no email.
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'lead_acknowledgment',
        'requires_phone', true,
        'requires_no_email', true,
        'body',
          'Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. ' ||
          'I''ll be in touch within {{client.responseTime}} to sort out {{lead.service}}. ' ||
          'Reply to this message if you need anything urgent.'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- LEAD CAPTURE — Cold lead nudge (unchanged — no message channel)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, visibility
  ) values (
    p_client_id, 'cold_lead_nudge',
    'Cold lead follow-up nudge',
    'Surfaces a lead with no inbound activity in 4 days as a follow-up task. You write the follow-up yourself.',
    true, true, 'lead_inactive'::public.automation_trigger_type,
    '{"days_after_last_outbound": 4, "max_nudges": 3}'::jsonb, 'client'
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'create_followup_task'::public.automation_action_type,
      jsonb_build_object(
        'hint', 'Lead has gone quiet — needs a personal nudge.'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- POST-JOB — Review request (EMAIL primary, SMS fallback)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'review_request',
    'Review request',
    'Asks the lead to leave a Google review 2 hours after the job is marked complete. Sends email when an email is on file; falls back to SMS only when the lead has no email but does have a phone. Only fires when a connected GBP location exists.',
    true, true, 'job_completed'::public.automation_trigger_type, 'client'
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    -- Position 1: email (primary)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'review_request',
        'requires_email', true,
        'requires_gbp_location', true,
        'writes_gbp_review_request_audit', true,
        'delay_minutes', 120,
        'subject', 'Quick favour — a Google review for {{client.businessName}}',
        'body',
          E'Hi {{lead.firstName}},\n\n' ||
          E'Thanks for choosing {{client.businessName}} — it''s been a pleasure working with you.\n\n' ||
          E'If you have a minute, a quick Google review would mean the world:\n{{review.link}}\n\n' ||
          'Cheers,' || E'\n' || '{{client.businessName}}'
      ),
      true
    );
    -- Position 2: SMS (fallback) — only when no email is on file
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'review_request',
        'requires_phone', true,
        'requires_no_email', true,
        'requires_gbp_location', true,
        'writes_gbp_review_request_audit', true,
        'delay_minutes', 120,
        'body',
          'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' ||
          'If you''ve a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- JOB LIFECYCLE — Booking confirmation (EMAIL primary, SMS fallback)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'booking_confirmation',
    'Booking confirmation',
    'Confirms a new booking. Sends email when an email is on file; falls back to SMS only when no email. Default off — opt in when you trust the cadence.',
    false, true, 'job_scheduled'::public.automation_trigger_type, 'client'
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    -- Position 1: email (primary)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'job_confirmation',
        'requires_email', true,
        'subject', 'Your booking with {{client.businessName}} is confirmed',
        'body',
          E'Hi {{lead.firstName}},\n\n' ||
          E'This is {{client.businessName}} confirming your booking on {{job.date}} at {{job.time}}.\n\n' ||
          E'We''ll be at {{job.address}}.\n\n' ||
          E'If anything changes you can reach us on {{client.phone}}.\n\n' ||
          '— {{client.businessName}}'
      ),
      true
    );
    -- Position 2: SMS (fallback)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_sms_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'job_confirmation',
        'requires_phone', true,
        'requires_no_email', true,
        'body',
          'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' ||
          'on {{job.date}} at {{job.time}}. We''ll be at {{job.address}}. Reply if anything changes.'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- JOB LIFECYCLE — Arrival notification (SMS-only, time-sensitive)
  --
  -- The "on the way" moment is urgent enough that SMS open rates (>90%
  -- within minutes) outweigh the cost concern. Email open rates lag too
  -- much for this use case. Off by default; operator can disable entirely
  -- if they don't want to send anything.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters, visibility
  ) values (
    p_client_id, 'arrival_notification',
    'On the way SMS',
    'Sends an arrival or status-change SMS when a booking flips to in-progress. SMS-only because of the time-sensitive nature of the message — email open rates are too slow for this moment. Default off — opt in when you trust the cadence.',
    false, true, 'job_status_changed'::public.automation_trigger_type,
    '{"to_status": "in_progress"}'::jsonb,
    '{"requires_phone": true}'::jsonb, 'client'
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
        'requires_phone', true,
        'body',
          'Hi {{lead.firstName}}, {{client.businessName}} here — we''re on the way. ' ||
          'ETA {{job.eta}}. See you shortly!'
      ),
      true
    );
  end if;

  -- =========================================================================
  -- PLATFORM-INTERNAL — operator-facing, hidden from client UI (unchanged)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'operator_lead_notification',
    'Operator new-lead notification',
    'Webnua-managed: notifies the recipients configured on /settings/notifications when a new lead arrives. Hidden from the client UI.',
    true, true, 'lead_created'::public.automation_trigger_type, 'platform_internal'
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

  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'payment_failed_notification',
    'Payment failed operator alert',
    'Webnua-managed: emails the operator when a Stripe subscription payment fails. Hidden from the client UI.',
    true, true, 'payment_failed'::public.automation_trigger_type, 'platform_internal'
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
end;
$$;

-- =============================================================================
-- 2. Hard-reset existing rows for the three rewired automations only.
--
-- Reseeding the affected automations is cleaner than a position-swap +
-- conditional insert. Operator-edited bodies on these three keys are lost
-- (acceptable trade-off pre-launch with one live client; same precedent as
-- 0105's reset). The other 4 automations (cold_lead_nudge,
-- arrival_notification, operator_lead_notification, payment_failed_notification)
-- are unchanged so they survive the reset.
-- =============================================================================
do $$
declare
  v_client_id uuid;
begin
  delete from public.automations
   where automation_key in ('lead_acknowledgment', 'review_request', 'booking_confirmation');

  for v_client_id in select id from public.clients loop
    perform private.seed_default_automations(v_client_id);
  end loop;
end $$;
