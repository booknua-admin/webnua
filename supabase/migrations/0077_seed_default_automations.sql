-- =============================================================================
-- Webnua backend — Phase 8 Session 1 · seed default automations.
--
-- Seeds the platform default automations for every existing client AND
-- installs an INSERT trigger on `clients` so new clients pick up the same
-- defaults automatically.
--
-- Defaults faithfully reproduce the previous hardcoded trigger behavior:
--
--   • lead_acknowledgment_sms   — replaces /api/forms/submit's direct SMS
--                                  enqueue. Same template (lead_acknowledgment),
--                                  same gating (only if phone present).
--   • lead_acknowledgment_email — replaces /api/forms/submit's direct email
--                                  enqueue. Same template (lead_followup),
--                                  same gating (only if email present).
--   • operator_lead_notification — replaces the migration 0063 leads INSERT
--                                  trigger. Same job, same throttle path.
--   • job_scheduled_confirmation_sms — NEW. Opt-in (is_enabled = false). The
--                                  prototype had no job-scheduled trigger;
--                                  default-off to avoid surprising customers
--                                  with messages an operator didn't approve.
--   • job_arrival_notification_sms — NEW. Opt-in (is_enabled = false). Same
--                                  caution as above.
--   • review_request_sms        — replaces the migration 0069 booking-
--                                  completion review-request trigger.
--                                  Fires 2h after status='completed'. Only
--                                  for leads with a phone AND a connected
--                                  GBP location (preserves the existing
--                                  skip-when-no-GBP behavior).
--   • review_request_email      — Email fallback for leads without phone.
--                                  Same 2h delay, same GBP gating.
--   • payment_failed_notification — replaces the Stripe webhook's direct
--                                  STRIPE_PAYMENT_FAILED_JOB enqueue.
--   • cold_lead_nudge           — GENUINELY NEW. Fires daily; surfaces a
--                                  follow-up task on the lead when there has
--                                  been no inbound for 4+ days since the
--                                  last outbound. Default-on; safe because
--                                  it never sends a message — it surfaces
--                                  the lead to the client to write their own
--                                  follow-up.
--
-- The `cold_lead_nudge` is the one default with `is_enabled = true` AND new
-- behaviour. The brief specified: enabled by default, safe (creates a task,
-- never sends).
-- =============================================================================

-- --- per-client seeding function -------------------------------------------
-- Inserts the platform defaults for one client. SECURITY DEFINER so the
-- INSERT trigger on `clients` (which fires as the inserting user) can write
-- automation rows the client doesn't own write access to.
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
  -- lead_acknowledgment_sms — instant confirm (only if phone)
  -- Replaces /api/forms/submit's direct enqueue.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_sms',
    'Instant lead confirmation SMS',
    'Sends the lead_acknowledgment template the moment a new lead lands. Only fires when a phone is on file.',
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
      '{"template_key": "lead_acknowledgment"}'::jsonb, true
    );
  end if;

  -- =========================================================================
  -- lead_acknowledgment_email — instant follow-up email (only if email)
  -- Replaces /api/forms/submit's direct email enqueue.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type, trigger_filters
  ) values (
    p_client_id, 'lead_acknowledgment_email',
    'Lead follow-up email',
    'Sends the lead_followup template when a new lead lands. Only fires when an email is on file.',
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
      '{"template_key": "lead_followup"}'::jsonb, true
    );
  end if;

  -- =========================================================================
  -- operator_lead_notification — fans the new-lead notification to operators
  -- Replaces the leads-INSERT trigger from migration 0063. The underlying
  -- send_lead_notification job still does the throttle + digest work; this
  -- automation just orchestrates the enqueue.
  -- =========================================================================
  insert into public.automations (
    client_id, automation_key, name, description,
    is_enabled, is_default, trigger_type
  ) values (
    p_client_id, 'operator_lead_notification',
    'Operator new-lead notification',
    'Sends the configured operators a new-lead notification. Honors per-operator throttle and digest frequency on notification_preferences.',
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
      '{"template_key": "job_confirmation"}'::jsonb, true
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
      '{"template_key": "arrival_notification"}'::jsonb, true
    );
  end if;

  -- =========================================================================
  -- review_request_sms — replaces the migration 0069 booking-completion path.
  -- 2-hour delay after the booking is marked completed.
  -- Only for leads with a phone AND a connected GBP location (preserves
  -- the existing skip-when-no-GBP behavior — see send_sms action handler).
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
        'writes_gbp_review_request_audit', true
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
        'writes_gbp_review_request_audit', true
      ),
      true
    );
  end if;

  -- =========================================================================
  -- payment_failed_notification — replaces the Stripe webhook's direct
  -- STRIPE_PAYMENT_FAILED_JOB enqueue. The underlying job handler is the
  -- same; the engine just orchestrates the call.
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
  -- cold_lead_nudge — NEW. Surfaces stalled leads to the client.
  -- Never sends a message; only writes leads.needs_followup_at + increments
  -- followup_nudge_count. Default-on (safe).
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

-- --- backfill existing clients ---------------------------------------------
do $$
declare
  c record;
begin
  for c in select id from public.clients loop
    perform private.seed_default_automations(c.id);
  end loop;
end $$;

-- --- new-client INSERT trigger ----------------------------------------------
-- Guardrail #3 from the session brief: every NEW client gets the defaults
-- automatically. Same pattern as the SMS/email template seeding triggers
-- from migrations 0060 / 0062.
create or replace function private.on_client_insert_seed_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.seed_default_automations(new.id);
  exception when others then
    -- Seeding failure must not fail the client insert; a half-seeded
    -- automation library is recoverable, a failed client create is not.
    raise notice 'seed_default_automations failed for client %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists clients_seed_automations on public.clients;
create trigger clients_seed_automations
  after insert on public.clients
  for each row execute function private.on_client_insert_seed_automations();
