-- =============================================================================
-- 0109 — Pre-populate automation action bodies so every default ships
--        working out of the box.
--
-- Migration 0105 consolidated the per-channel automations but only set
-- `template_key` on each action_config — no inline body. Result: a freshly-
-- seeded client got the right structure but every SMS/email body was empty
-- (`render(body, context)` returned ''), and the send_sms / send_email job
-- handlers skipped the send with reason='empty-body'. Automations LOOKED
-- enabled in the UI but never fired anything.
--
-- This migration:
--
--   1. Replaces `private.seed_default_automations()` AGAIN — same shape as
--      0105 but with the body / subject inlined on every comm action so a
--      new client gets working sends immediately.
--   2. Backfills `automation_actions.action_config` for every existing row
--      where `body` or `subject` is missing, using `automations.automation_key`
--      + `position` to pick the right default.
--
-- Bodies come from the SoT in `src/lib/automations/platform-defaults.ts` —
-- they must stay in lockstep with PLATFORM_DEFAULT_AUTOMATIONS there.
-- =============================================================================

-- =============================================================================
-- 1. Replace the seed function (consolidated shape + pre-populated bodies)
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
  -- LEAD CAPTURE — Instant lead reply (SMS + email, conditional)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'lead_acknowledgment',
    'Instant lead reply',
    'Fires the moment a new lead lands. Sends an SMS to leads with a phone on file and a follow-up email to leads with an email on file.',
    true, true, 'lead_created'::public.automation_trigger_type, 'client'
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
        'requires_phone', true,
        'body',
          'Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. ' ||
          'I''ll be in touch within {{client.responseTime}} to sort out {{lead.service}}. ' ||
          'Reply to this message if you need anything urgent.'
      ),
      true
    );
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_email_to_lead'::public.automation_action_type,
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
  end if;

  -- =========================================================================
  -- LEAD CAPTURE — Cold lead nudge (follow-up task only, no message)
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
  -- POST-JOB — Review request (SMS preferred, email fallback)
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, visibility
  ) values (
    p_client_id, 'review_request',
    'Review request',
    'Asks the lead to leave a Google review 2 hours after the job is marked complete. Sends SMS when a phone is on file, with email fallback otherwise. Only fires when a connected GBP location exists.',
    true, true, 'job_completed'::public.automation_trigger_type, 'client'
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
        'requires_phone', true,
        'requires_gbp_location', true,
        'writes_gbp_review_request_audit', true,
        'delay_minutes', 120,
        'body',
          'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' ||
          'If you''ve a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!'
      ),
      true
    );
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_email_to_lead'::public.automation_action_type,
      jsonb_build_object(
        'template_key', 'review_request',
        'requires_email', true,
        'requires_no_phone', true,
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
  end if;

  -- =========================================================================
  -- JOB LIFECYCLE — off by default
  -- =========================================================================

  -- Booking confirmation
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters, visibility
  ) values (
    p_client_id, 'booking_confirmation',
    'Booking confirmation SMS',
    'Sends a booking confirmation SMS when a booking is created. Default off — opt in when you trust the cadence.',
    false, true, 'job_scheduled'::public.automation_trigger_type,
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
        'template_key', 'job_confirmation',
        'requires_phone', true,
        'body',
          'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' ||
          'on {{job.date}} at {{job.time}}. We''ll be at {{job.address}}. Reply if anything changes.'
      ),
      true
    );
  end if;

  -- Arrival / on-the-way
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, trigger_filters, visibility
  ) values (
    p_client_id, 'arrival_notification',
    'On the way SMS',
    'Sends an arrival or status-change notification when a booking flips to in-progress. Default off — opt in when you trust the cadence.',
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
  -- PLATFORM-INTERNAL — operator-facing, hidden from client UI
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
-- 2. Backfill existing rows — patch action_config.body / subject where missing.
--
-- Iterates every automations row + matching automation_actions row, looks up
-- the right body / subject by (automation_key, position), and merges it into
-- action_config without disturbing any operator-edited keys.
-- =============================================================================
do $$
declare
  v_aut record;
  v_act record;
  v_patch jsonb;
begin
  for v_aut in
    select id, automation_key
      from public.automations
     where visibility = 'client'
  loop
    for v_act in
      select id, position, action_type, action_config
        from public.automation_actions
       where automation_id = v_aut.id
       order by position
    loop
      v_patch := null;

      -- Build the patch for this (automation_key, position) pair.
      if v_aut.automation_key = 'lead_acknowledgment' and v_act.position = 1 then
        v_patch := jsonb_build_object(
          'template_key', 'lead_acknowledgment',
          'requires_phone', true,
          'body',
            'Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. ' ||
            'I''ll be in touch within {{client.responseTime}} to sort out {{lead.service}}. ' ||
            'Reply to this message if you need anything urgent.'
        );
      elsif v_aut.automation_key = 'lead_acknowledgment' and v_act.position = 2 then
        v_patch := jsonb_build_object(
          'template_key', 'lead_followup',
          'requires_email', true,
          'subject', 'Thanks for your enquiry — we''ll be in touch shortly',
          'body',
            E'Hi {{lead.firstName}},\n\n' ||
            'Thanks for getting in touch with {{client.businessName}}. ' ||
            E'I''ve seen your enquiry about {{lead.service}} and I''ll reach out within {{client.responseTime}}.\n\n' ||
            E'If it''s urgent, you can reach me directly on {{client.phone}}.\n\n' ||
            '— {{client.businessName}}'
        );
      elsif v_aut.automation_key = 'review_request' and v_act.position = 1 then
        v_patch := jsonb_build_object(
          'template_key', 'review_request',
          'requires_phone', true,
          'requires_gbp_location', true,
          'writes_gbp_review_request_audit', true,
          'delay_minutes', 120,
          'body',
            'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' ||
            'If you''ve a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!'
        );
      elsif v_aut.automation_key = 'review_request' and v_act.position = 2 then
        v_patch := jsonb_build_object(
          'template_key', 'review_request',
          'requires_email', true,
          'requires_no_phone', true,
          'requires_gbp_location', true,
          'writes_gbp_review_request_audit', true,
          'delay_minutes', 120,
          'subject', 'Quick favour — a Google review for {{client.businessName}}',
          'body',
            E'Hi {{lead.firstName}},\n\n' ||
            E'Thanks for choosing {{client.businessName}} — it''s been a pleasure working with you.\n\n' ||
            E'If you have a minute, a quick Google review would mean the world:\n{{review.link}}\n\n' ||
            'Cheers,' || E'\n' || '{{client.businessName}}'
        );
      elsif v_aut.automation_key = 'booking_confirmation' and v_act.position = 1 then
        v_patch := jsonb_build_object(
          'template_key', 'job_confirmation',
          'requires_phone', true,
          'body',
            'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' ||
            'on {{job.date}} at {{job.time}}. We''ll be at {{job.address}}. Reply if anything changes.'
        );
      elsif v_aut.automation_key = 'arrival_notification' and v_act.position = 1 then
        v_patch := jsonb_build_object(
          'template_key', 'arrival_notification',
          'requires_phone', true,
          'body',
            'Hi {{lead.firstName}}, {{client.businessName}} here — we''re on the way. ' ||
            'ETA {{job.eta}}. See you shortly!'
        );
      elsif v_aut.automation_key = 'cold_lead_nudge' and v_act.position = 1 then
        v_patch := jsonb_build_object(
          'hint', 'Lead has gone quiet — needs a personal nudge.'
        );
      end if;

      if v_patch is null then
        continue; -- Unknown key/position, leave alone.
      end if;

      -- Merge patch INTO existing config — operator-edited body/subject WIN.
      -- For first-time backfill (current is empty), the patch fills in cleanly.
      -- For a row where operator already edited body, keep their edit; only
      -- fill in any keys they HAVEN'T set.
      update public.automation_actions
         set action_config = v_patch || coalesce(action_config, '{}'::jsonb)
       where id = v_act.id;
    end loop;
  end loop;
end $$;
