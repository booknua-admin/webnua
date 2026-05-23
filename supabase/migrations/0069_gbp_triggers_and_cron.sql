-- =============================================================================
-- Webnua backend — Phase 7 GBP · triggers, cron, realtime.
--
-- Three pieces of plumbing on top of the GBP tables:
--
-- 1. AFTER UPDATE trigger on bookings — when a booking transitions to
--    'completed', enqueue a `gbp_send_review_request` job with a 2-HOUR
--    DELAY. Rationale: the request should land when the customer has had
--    time to experience the work, not immediately as the tradie is walking
--    out the door. Same swallow-errors pattern as the lead-notification
--    trigger (0063) — an integration_jobs enqueue failure must not fail
--    the booking update.
--
-- 2. pg_cron daily sync — once a day, enqueue one `gbp_sync_reviews` job
--    per connected client_gbp_locations row. The job handler then calls
--    Google's listReviews via callWithToken and upserts gbp_reviews rows.
--    Polling rather than push because GBP review notifications aren't
--    reliable.
--
-- 3. AFTER INSERT trigger on gbp_reviews — when a new review lands, fan
--    an in-app notification to the client's users (and any operator
--    users) via private.notify_client_users from 0032.
--
-- 4. Realtime publication — gbp_reviews + gbp_review_requests are added
--    so RealtimeProvider (Phase 9) can keep operator dashboards live.
-- =============================================================================

-- --- 1. booking-completion → review-request trigger --------------------------

create function private.on_booking_completed_enqueue_review_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_phone text;
  v_recipient_email text;
  v_run_after       timestamptz;
begin
  -- Only fire on the transition to 'completed' — re-saving a completed
  -- booking, or any other status change, is a no-op.
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    -- Look up the customer's contact info so the job handler has a
    -- single source of truth for who to message.
    select c.phone, c.email
      into v_recipient_phone, v_recipient_email
      from public.customers c
     where c.id = new.customer_id;

    -- Skip cleanly when there is no way to reach the customer — silent
    -- because this is the trigger; the job runner would also skip but
    -- there is no point enqueueing a job that can't run.
    if coalesce(v_recipient_phone, '') = '' and coalesce(v_recipient_email, '') = '' then
      return new;
    end if;

    v_run_after := now() + interval '2 hours';

    begin
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      ) values (
        'gbp_send_review_request',
        jsonb_build_object(
          'clientId',       new.client_id::text,
          'bookingId',      new.id::text,
          'leadId',         new.lead_id::text,
          'customerId',     new.customer_id::text,
          'recipientName',  new.customer_name_snapshot,
          'recipientPhone', v_recipient_phone,
          'recipientEmail', v_recipient_email
        ),
        'google_business_profile',
        v_run_after,
        3,
        new.client_id,
        new.id::text
      );
    exception when others then
      raise notice 'gbp_send_review_request enqueue failed for booking %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

create trigger bookings_enqueue_review_request
  after update on public.bookings
  for each row execute function private.on_booking_completed_enqueue_review_request();

-- --- 2. daily review-sync cron ----------------------------------------------

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping gbp_sync_reviews schedule.';
    return;
  end if;

  -- Idempotent — drop any prior schedule with the same name.
  perform cron.unschedule('webnua_gbp_sync_reviews_daily')
   where exists (select 1 from cron.job where jobname = 'webnua_gbp_sync_reviews_daily');

  -- 06:00 UTC daily. One job enqueued per connected location; the
  -- handler does the actual API call.
  perform cron.schedule(
    'webnua_gbp_sync_reviews_daily',
    '0 6 * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'gbp_sync_reviews',
        jsonb_build_object('clientId', l.client_id::text),
        'google_business_profile',
        now(),
        3,
        l.client_id,
        l.client_id::text
      from public.client_gbp_locations l
      join public.integration_connections c
        on c.client_id = l.client_id
       and c.provider  = 'google_business_profile'
       and c.status    = 'active';
    $cron$
  );
end;
$$;

-- --- 3. new-review notification fan ------------------------------------------

create function private.on_gbp_review_insert_fan_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  -- Skip re-imports that arrive as updates (status sync) — only fan on
  -- a genuine first insert.
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- Build a short title — used as the in-app notification headline.
  v_title :=
    'New ' || new.rating || '★ review' ||
    case when coalesce(new.reviewer_name, '') <> '' then ' from ' || new.reviewer_name else '' end;

  begin
    perform private.notify_client_users(
      new.client_id,
      'review'::notification_kind,
      v_title,
      'gbp_review',
      new.id
    );
  exception when others then
    raise notice 'notify_client_users failed for review %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

create trigger gbp_reviews_fan_notification
  after insert on public.gbp_reviews
  for each row execute function private.on_gbp_review_insert_fan_notification();

-- --- 4. realtime publication --------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.gbp_reviews;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.gbp_review_requests;
  exception when duplicate_object then null; end;
end;
$$;
