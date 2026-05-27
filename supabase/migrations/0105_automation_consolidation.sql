-- =============================================================================
-- 0105 — Automation consolidation: replace per-channel automation pairs with
--        multi-action automations + mark platform-internal automations.
--
-- The original seed (migration 0077) treated each channel as a separate
-- automation, producing visually-noisy cards in the client `/automations` UI:
--
--   lead_acknowledgment_sms      \
--   lead_acknowledgment_email     >  all three fire from `lead_created`
--   operator_lead_notification   /   (the description even confesses
--                                     "all fan from one trigger")
--
--   review_request_sms           \  both fire from `job_completed`
--   review_request_email         /
--
-- Industry-standard SMB-services platforms (GoHighLevel, Jobber, Housecall
-- Pro) group these as ONE automation per business EVENT with the channel
-- handled inside via conditional actions. This migration does the same:
--
--   `lead_acknowledgment` — one automation, two conditional actions:
--      action 1: send SMS (requires_phone)
--      action 2: send email (requires_email)
--
--   `review_request` — one automation, two conditional actions:
--      action 1: send SMS (requires_phone + requires_gbp_location)
--      action 2: send email (requires_email + requires_gbp_location)
--
-- The two operator-facing automations (`operator_lead_notification`,
-- `payment_failed_notification`) keep firing on their existing triggers BUT
-- are marked `visibility='platform_internal'` so they vanish from the client
-- UI. They are still queryable + editable from the operator's birds-eye
-- view if needed.
--
-- Re-seed strategy:
--   1. Replace the `private.seed_default_automations(p_client_id)` function
--      with the new shape.
--   2. Hard-reset existing automations + actions for every client (the live
--      DB has one client; pre-launch acceptable; the seed produces the new
--      shape directly).
--
-- Downstream impacts:
--   - `lib/automations/queries.tsx` reads `visibility` and filters out
--     'platform_internal' rows on every client-facing surface. Operator
--     birds-eye + sub-account-mode views show both (the operator
--     should know what's running).
--   - Engine config (lib/automations/engine.ts) is UNCHANGED — the runtime
--     filters (`requires_phone` / `requires_email`) already exist on
--     action_config and the engine skips actions whose filter says skip.
--     The consolidation moves filters from the automation level to the
--     action level, which the engine already supported.
-- =============================================================================

-- =============================================================================
-- 1. Replace the seed function with the new shape.
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
  -- LEAD CAPTURE STAGE
  -- =========================================================================

  -- Lead acknowledgment — one automation, two conditional actions (SMS + email)
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
    -- Action 1: SMS to lead (only fires when phone is on file)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      '{"template_key": "lead_acknowledgment", "requires_phone": true}'::jsonb, true
    );
    -- Action 2: email to lead (only fires when email is on file)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_email_to_lead'::public.automation_action_type,
      '{"template_key": "lead_followup", "requires_email": true}'::jsonb, true
    );
  end if;

  -- Cold lead follow-up — unchanged from 0077, included here so the new
  -- function is the SoT (the consolidation supersedes 0077 entirely).
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_config, visibility
  ) values (
    p_client_id, 'cold_lead_nudge',
    'Cold lead follow-up nudge',
    'Surfaces a lead with no inbound activity in 4 days as a follow-up task. You write the follow-up yourself.',
    true, true, 'lead_inactive'::public.automation_trigger_type,
    '{"days_after_last_outbound": 4}'::jsonb, 'client'
  )
  on conflict (client_id, automation_key) do nothing
  returning id into v_aut_id;

  if v_aut_id is not null then
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'create_followup_task'::public.automation_action_type,
      '{"hint": "Lead has gone quiet — call them back or send a follow-up note."}'::jsonb, true
    );
  end if;

  -- =========================================================================
  -- POST-JOB STAGE
  -- =========================================================================

  -- Review request — one automation, two conditional actions
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
    -- Action 1: SMS (preferred channel)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 1, 'send_sms_to_lead'::public.automation_action_type,
      '{"template_key": "review_request", "requires_phone": true, "requires_gbp_location": true, "writes_gbp_review_request_audit": true, "delay_minutes": 120}'::jsonb,
      true
    );
    -- Action 2: email fallback (only when no phone is on file)
    insert into public.automation_actions (
      automation_id, position, action_type, action_config, pauses_on_human_activity
    ) values (
      v_aut_id, 2, 'send_email_to_lead'::public.automation_action_type,
      '{"template_key": "review_request", "requires_email": true, "requires_no_phone": true, "requires_gbp_location": true, "writes_gbp_review_request_audit": true, "delay_minutes": 120}'::jsonb,
      true
    );
  end if;

  -- =========================================================================
  -- JOB LIFECYCLE — off by default, client opts in
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
      '{"template_key": "job_confirmation", "requires_phone": true}'::jsonb, true
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
      '{"template_key": "arrival_notification", "requires_phone": true}'::jsonb, true
    );
  end if;

  -- =========================================================================
  -- PLATFORM-INTERNAL — operator-facing notifications, hidden from client UI
  -- =========================================================================

  -- Operator new-lead notification — fans the notification_preferences fan-out
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
      '{"variant": "new_lead"}'::jsonb, false
    );
  end if;

  -- Payment-failed operator alert — fires on Stripe payment failure
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
      '{"variant": "payment_failed"}'::jsonb, false
    );
  end if;
end;
$$;

-- =============================================================================
-- 2. Hard-reset + re-seed existing clients with the new shape.
-- =============================================================================
-- The live DB has a small pre-launch population (one client as of 2026-05-27);
-- the trade-off of losing any operator-edited bodies is acceptable. Deleting
-- the parent rows cascades into automation_actions + automation_runs via FKs.
do $$
declare
  v_client_id uuid;
begin
  delete from public.automations;

  for v_client_id in select id from public.clients loop
    perform private.seed_default_automations(v_client_id);
  end loop;
end $$;
