-- =============================================================================
-- Webnua backend — Phase 8 Session 1 · refactor DB triggers + cold-lead cron.
--
-- The old hardcoded triggers are removed; replaced by a single `automation_trigger`
-- job fan. Every triggering event (lead created, booking created/completed/
-- status-changed) writes one job row whose handler calls the engine's
-- onTrigger(). The engine picks matching automations and creates runs.
--
-- Specifically:
--
--   • Migration 0063's leads INSERT trigger (enqueued send_lead_notification
--     directly) is REPLACED by a trigger that enqueues `automation_trigger`.
--     The operator_lead_notification automation seeded in 0077 produces the
--     same downstream send_lead_notification job.
--
--   • Migration 0069's booking-completion trigger (enqueued
--     gbp_send_review_request directly with a 2h delay) is REPLACED by a
--     trigger that enqueues `automation_trigger` on the transition to
--     'completed'. The review_request_sms / review_request_email automations
--     seeded in 0077 produce the same downstream send_sms / send_email jobs
--     (with the 2h delay carried by the engine's delay logic).
--
--   • New trigger: bookings INSERT -> automation_trigger('job_scheduled').
--     The job_scheduled_confirmation_sms default automation will consume it
--     (default-off, opt-in).
--
--   • New trigger: bookings UPDATE status -> automation_trigger('job_status_changed')
--     when status changes to anything other than 'completed' (which has its
--     own dedicated trigger above). The job_arrival_notification_sms default
--     automation will consume it when to_status = 'on_the_way' (also
--     default-off).
--
-- Plus a pg_cron schedule: daily 09:00 UTC enqueues a `cold_lead_scan` job
-- that fans `lead_inactive` triggers for matching leads.
-- =============================================================================

-- --- drop the old direct-enqueue triggers ----------------------------------
drop trigger if exists leads_enqueue_notification on public.leads;
drop function if exists private.on_lead_insert_enqueue_notification();

drop trigger if exists bookings_enqueue_review_request on public.bookings;
drop function if exists private.on_booking_completed_enqueue_review_request();

-- --- generic automation-trigger enqueue helper -----------------------------
-- All four triggers below fan into this same function — they just supply the
-- payload. Reading flat: enqueue an `automation_trigger` job with the trigger
-- type + the event data; the engine's job handler picks it up and does the
-- rest.
create or replace function private.enqueue_automation_trigger(
  p_client_id uuid,
  p_trigger_type public.automation_trigger_type,
  p_trigger_event jsonb,
  p_correlation_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.integration_jobs (
      job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
    ) values (
      'automation_trigger',
      jsonb_build_object(
        'clientId',     p_client_id::text,
        'triggerType',  p_trigger_type::text,
        'triggerEvent', p_trigger_event
      ),
      'automations',
      now(),
      3,
      p_client_id,
      p_correlation_id
    );
  exception when others then
    -- An enqueue failure must not fail the upstream insert/update —
    -- functional parity with the previous triggers.
    raise notice 'automation_trigger enqueue failed (%): %', p_trigger_type, sqlerrm;
  end;
end;
$$;

-- --- leads INSERT trigger --------------------------------------------------
create or replace function private.on_lead_insert_fire_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_automation_trigger(
    new.client_id,
    'lead_created'::public.automation_trigger_type,
    jsonb_build_object(
      'leadId',         new.id::text,
      'customerId',     new.customer_id::text,
      'recipientName',  new.customer_name_snapshot,
      'recipientPhone', new.customer_phone_snapshot
    ),
    new.id::text
  );
  return new;
end;
$$;

create trigger leads_fire_lead_created_automation
  after insert on public.leads
  for each row execute function private.on_lead_insert_fire_automation();

-- --- bookings INSERT trigger -----------------------------------------------
create or replace function private.on_booking_insert_fire_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_phone text;
  v_recipient_email text;
begin
  -- Resolve the customer's contact info so the action handler can target.
  select c.phone, c.email
    into v_recipient_phone, v_recipient_email
    from public.customers c
   where c.id = new.customer_id;

  perform private.enqueue_automation_trigger(
    new.client_id,
    'job_scheduled'::public.automation_trigger_type,
    jsonb_build_object(
      'bookingId',      new.id::text,
      'leadId',         new.lead_id::text,
      'customerId',     new.customer_id::text,
      'recipientName',  new.customer_name_snapshot,
      'recipientPhone', v_recipient_phone,
      'recipientEmail', v_recipient_email,
      'startsAt',       new.starts_at::text
    ),
    new.id::text
  );
  return new;
end;
$$;

create trigger bookings_fire_job_scheduled_automation
  after insert on public.bookings
  for each row execute function private.on_booking_insert_fire_automation();

-- --- bookings UPDATE → completed trigger -----------------------------------
create or replace function private.on_booking_completed_fire_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_phone text;
  v_recipient_email text;
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    select c.phone, c.email
      into v_recipient_phone, v_recipient_email
      from public.customers c
     where c.id = new.customer_id;

    perform private.enqueue_automation_trigger(
      new.client_id,
      'job_completed'::public.automation_trigger_type,
      jsonb_build_object(
        'bookingId',      new.id::text,
        'leadId',         new.lead_id::text,
        'customerId',     new.customer_id::text,
        'recipientName',  new.customer_name_snapshot,
        'recipientPhone', v_recipient_phone,
        'recipientEmail', v_recipient_email
      ),
      new.id::text
    );
  end if;
  return new;
end;
$$;

create trigger bookings_fire_job_completed_automation
  after update on public.bookings
  for each row execute function private.on_booking_completed_fire_automation();

-- --- bookings UPDATE status (non-completed) trigger ------------------------
-- Fires for any status change that ISN'T to 'completed' (which has its own
-- dedicated trigger above). The engine filters by trigger_config.to_status
-- to find automations for the specific transition.
create or replace function private.on_booking_status_changed_fire_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_phone text;
begin
  if new.status is distinct from old.status
     and new.status <> 'completed' then
    select c.phone into v_recipient_phone
      from public.customers c
     where c.id = new.customer_id;

    perform private.enqueue_automation_trigger(
      new.client_id,
      'job_status_changed'::public.automation_trigger_type,
      jsonb_build_object(
        'bookingId',      new.id::text,
        'leadId',         new.lead_id::text,
        'customerId',     new.customer_id::text,
        'recipientName',  new.customer_name_snapshot,
        'recipientPhone', v_recipient_phone,
        'fromStatus',     coalesce(old.status::text, ''),
        'toStatus',       new.status::text
      ),
      new.id::text
    );
  end if;
  return new;
end;
$$;

create trigger bookings_fire_status_changed_automation
  after update on public.bookings
  for each row execute function private.on_booking_status_changed_fire_automation();

-- --- pg_cron: daily cold-lead scan -----------------------------------------
-- 09:00 UTC daily (configurable via env COLD_LEAD_SCAN_TIME_UTC in app code,
-- but the cron line itself is the deploy-time default). Enqueues a single
-- `cold_lead_scan` job per accessible enabled cold_lead_nudge automation;
-- the handler iterates leads and fires lead_inactive triggers.
--
-- One job per (client, automation) so the scan parallelises naturally and
-- a per-client failure doesn't block the rest of the platform.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping cold_lead_scan schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_cold_lead_scan_daily')
   where exists (select 1 from cron.job where jobname = 'webnua_cold_lead_scan_daily');

  perform cron.schedule(
    'webnua_cold_lead_scan_daily',
    '0 9 * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'cold_lead_scan',
        jsonb_build_object(
          'clientId',     a.client_id::text,
          'automationId', a.id::text
        ),
        'automations',
        now(),
        3,
        a.client_id,
        a.id::text
      from public.automations a
      where a.trigger_type = 'lead_inactive'
        and a.is_enabled = true;
    $cron$
  );
end $$;
