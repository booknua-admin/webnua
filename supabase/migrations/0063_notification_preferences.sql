-- =============================================================================
-- Webnua backend — Phase 7 Resend · 0063_notification_preferences.sql
--
-- Per-client operator notification recipients. Each row is one operator
-- address that should receive notifications about events on this client; the
-- per-event flags decide which events go to that address. Multiple rows per
-- client = multiple recipients.
--
-- The send_lead_notification job (registered in
-- src/lib/integrations/resend/job-handlers.ts) loads the matching recipients
-- when a new lead is created, runs the throttle check against
-- notifications_outbound (max one per (client, recipient, template) per 5
-- minutes), and either fires the email or marks the lead as
-- notification_pending so the hourly digest worker batches it.
--
-- RLS: operators see their accessible clients' preferences; writes are
-- service-role only (operator-authed routes call as service_role). The 0018
-- default DML grant's INSERT/UPDATE/DELETE are revoked.
--
-- Why an email column, not a users FK: a notification recipient may be an
-- email address that does NOT correspond to a Webnua user — e.g. the client
-- business's owner who hasn't been invited as a platform user, or a shared
-- inbox like ops@brand.com. Keeping it as a plain text address means
-- "configure a recipient for this client" is a property of the configuration,
-- not a user-management gate.
-- =============================================================================

create table public.notification_preferences (
  id                            uuid primary key default gen_random_uuid(),
  client_id                     uuid not null references public.clients (id) on delete cascade,
  operator_email                text not null,
  -- Per-event subscription flags. Defaults match the most useful baseline:
  -- new leads are the high-value signal; payment failures are urgent;
  -- reviews are nice-to-know.
  notify_on_new_lead            boolean not null default true,
  notify_on_payment_failure     boolean not null default true,
  notify_on_review_received     boolean not null default true,
  -- 'immediate' = fire the email the moment the trigger lands (subject to the
  --   in-job throttle that absorbs bursts).
  -- 'hourly'    = always batch into the hourly digest, regardless of throttle.
  -- 'daily'     = always batch into a daily digest. The hourly worker rolls
  --   pending rows for daily-frequency recipients into one daily email at the
  --   end of the day (08:00 UTC the next morning).
  digest_frequency              text not null default 'immediate'
                                  check (digest_frequency in ('immediate', 'hourly', 'daily')),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  -- One row per (client, email). A recipient can have only one preference set
  -- per client; toggling fields is an UPDATE, not a second row.
  unique (client_id, operator_email)
);

create index notification_preferences_client_idx
  on public.notification_preferences (client_id);
create index notification_preferences_lead_idx
  on public.notification_preferences (client_id)
  where notify_on_new_lead = true;

-- --- updated_at trigger ------------------------------------------------------
create function private.notification_preferences_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function private.notification_preferences_set_updated_at();

-- --- RLS ---------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
revoke insert, update, delete on public.notification_preferences from authenticated;

create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- =============================================================================
-- leads.notification_pending — flag set by the send_lead_notification job
-- when the throttle absorbed an immediate notification, picked up by the
-- hourly digest worker. NULL when no notification has been deferred. Cleared
-- (set to NULL) the moment a digest goes out.
-- =============================================================================

alter table public.leads
  add column if not exists notification_pending_at timestamptz;

create index if not exists leads_notification_pending_idx
  on public.leads (client_id, notification_pending_at)
  where notification_pending_at is not null;

-- =============================================================================
-- Lead-notification fan: trigger an immediate notification job whenever a
-- new lead lands. Service-role function — bypasses the operator-only INSERT
-- RLS on integration_jobs the same way migration 0032's notification triggers
-- do for the in-app feed.
--
-- An enqueue failure must not fail the lead insert; the trigger swallows
-- exceptions and logs to Postgres notice so a misconfigured deployment leaves
-- the inbox working.
-- =============================================================================

create function private.on_lead_insert_enqueue_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.integration_jobs (
      job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
    ) values (
      'send_lead_notification',
      jsonb_build_object('clientId', new.client_id::text, 'leadId', new.id::text),
      'resend',
      now(),
      3,
      new.client_id,
      new.id::text
    );
  exception when others then
    raise notice 'send_lead_notification enqueue failed for lead %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create trigger leads_enqueue_notification
  after insert on public.leads
  for each row execute function private.on_lead_insert_enqueue_notification();

-- =============================================================================
-- pg_cron schedule: the hourly digest worker.
--
-- Enqueues one batch_notification_digest job every hour. The job handler
-- (src/lib/integrations/resend/job-handlers.ts) finds every lead with
-- notification_pending_at set, groups by client, sends one digest email per
-- (client, recipient), then clears the flags.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    raise notice 'pg_cron extension not installed; skipping digest schedule.';
    return;
  end if;

  -- Idempotent — drop any prior schedule with the same name.
  perform cron.unschedule('webnua_notification_digest_hourly')
  where exists (
    select 1 from cron.job where jobname = 'webnua_notification_digest_hourly'
  );

  perform cron.schedule(
    'webnua_notification_digest_hourly',
    '0 * * * *',                                -- top of every hour
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      ) values (
        'batch_notification_digest',
        '{}'::jsonb,
        'resend',
        now(),
        3,
        null,
        null
      );
    $cron$
  );
end;
$$;
