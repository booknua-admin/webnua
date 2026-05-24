-- =============================================================================
-- Webnua backend — Pattern B onboarding wizard + two-stage cancellation
-- infrastructure.
--
-- Adds the storage columns the Session-C wizard + the cancellation flow
-- need, plus the daily pg_cron job that drives the two-stage cancellation
-- lifecycle ('cancelled' → 'deleted' → hard-delete).
--
-- Columns on public.clients:
--   wizard_state                jsonb        — in-progress wizard state
--                                              (current_step, completed_steps,
--                                              step_data). NULL until the
--                                              customer starts the wizard.
--   wizard_completed_at         timestamptz  — set when the customer reaches
--                                              step 7. Drives the dashboard
--                                              redirect: NULL + preview =
--                                              redirect to /onboarding.
--   cancelled_at                timestamptz  — Stripe webhook stamps this on
--                                              subscription.deleted; cleared
--                                              on subscription.created if
--                                              lifecycle was 'cancelled'.
--   data_deletion_scheduled_at  timestamptz  — set to NOW() + 30 days at
--                                              cancellation. The cron uses
--                                              this to move 'cancelled' →
--                                              'deleted' on day 30.
--   hard_delete_warning_sent_at timestamptz  — set on day 83 (7 days before
--                                              hard delete); a daily NULL
--                                              check + age filter prevents
--                                              double sends.
--
-- pg_cron job: webnua_cancellation_lifecycle (daily 05:00 UTC). Three
-- stages run in one tick — all idempotent, each gated by its own predicate:
--
--   Stage 1 (day 30, 'cancelled' → 'deleted'): clients where
--           lifecycle_status='cancelled' AND data_deletion_scheduled_at <
--           now(). Sets lifecycle_status='deleted'. (The original
--           data_deletion_scheduled_at is REUSED as the hard-delete-warning
--           anchor — day 83 = scheduled + 53 days; day 90 = scheduled +
--           60 days.)
--
--   Stage 2 (day 83, warning email): enqueue send_cancellation_warning_email
--           jobs for clients where lifecycle_status='deleted' AND
--           data_deletion_scheduled_at < now() - interval '53 days' AND
--           hard_delete_warning_sent_at IS NULL. The handler stamps
--           hard_delete_warning_sent_at on success so the next sweep skips.
--
--   Stage 3 (day 90, hard delete): DELETE clients where
--           lifecycle_status='deleted' AND data_deletion_scheduled_at <
--           now() - interval '60 days'. Cascade FKs handle related rows
--           (brands, websites, funnels, bookings, leads, etc. — every FK to
--           clients.id is `on delete cascade`). The auth.users row is
--           orphaned and left for Supabase admin cleanup (same precedent
--           as the pending_verification_sweep in 0086).
--
-- RLS — no changes here. The 0087 widening of clients_update for publish-cap
-- holders already covers the wizard's wizard_state writes from the client
-- side. The cancellation timestamps are written exclusively via service-
-- role from the Stripe webhook + the /api/clients/[id]/cancel route, so
-- they don't need a client-write policy. Reading the new columns rides on
-- the existing clients_select policy (clients see their own row; operators
-- see accessible_client_ids).
-- =============================================================================

-- --- columns ----------------------------------------------------------------

alter table public.clients
  add column if not exists wizard_state jsonb,
  add column if not exists wizard_completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists data_deletion_scheduled_at timestamptz,
  add column if not exists hard_delete_warning_sent_at timestamptz;

comment on column public.clients.wizard_state is
  'Pattern B onboarding wizard in-progress state. JSON shape: { current_step, completed_steps[], step_data }. NULL until the wizard starts.';
comment on column public.clients.wizard_completed_at is
  'Stamped when the customer reaches the wizard''s step 7. Drives the dashboard gate: NULL + lifecycle_status=preview = redirect to /onboarding.';
comment on column public.clients.cancelled_at is
  'Set by the Stripe subscription.deleted webhook. Cleared on reactivation. Pairs with data_deletion_scheduled_at for the 30-day grace.';
comment on column public.clients.data_deletion_scheduled_at is
  'NOW() + 30 days at cancellation. Acts as the anchor for stages 1 (+0d → deleted), 2 (+53d → warning email), 3 (+60d → hard delete).';
comment on column public.clients.hard_delete_warning_sent_at is
  'Stamped when the 7-day hard-delete-warning email fires. Prevents double sends across daily cron ticks.';

-- --- cron: webnua_cancellation_lifecycle ------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping cancellation_lifecycle schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_cancellation_lifecycle')
   where exists (select 1 from cron.job where jobname = 'webnua_cancellation_lifecycle');

  perform cron.schedule(
    'webnua_cancellation_lifecycle',
    '0 5 * * *',  -- daily at 05:00 UTC (after the existing 03/04/09 cron set)
    $cron$
      -- Stage 1: day 30, 'cancelled' → 'deleted'. The original
      -- data_deletion_scheduled_at is left in place — it becomes the
      -- hard-delete anchor for stages 2 and 3.
      update public.clients
         set lifecycle_status = 'deleted'
       where lifecycle_status = 'cancelled'
         and data_deletion_scheduled_at is not null
         and data_deletion_scheduled_at < now();

      -- Stage 2: day 83, enqueue the 7-day-warning email job. Gated by the
      -- NULL check on hard_delete_warning_sent_at so we never send twice.
      -- The handler stamps the timestamp on completion.
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts, client_id, correlation_id
      )
      select
        'send_cancellation_warning_email',
        jsonb_build_object('client_id', c.id),
        'resend',
        now(),
        2,
        c.id,
        gen_random_uuid()::text
      from public.clients c
      where c.lifecycle_status = 'deleted'
        and c.data_deletion_scheduled_at is not null
        and c.data_deletion_scheduled_at < (now() - interval '53 days')
        and c.hard_delete_warning_sent_at is null;

      -- Stage 3: day 90, hard delete. Cascade FKs handle the dependent rows;
      -- the auth.users row is orphaned and falls to Supabase admin cleanup.
      -- A short audit row is written to integration_call_log BEFORE the
      -- delete so the operation is traceable (the row's client_id FK will
      -- be NULL after delete, but the JSON request_shape preserves the
      -- client_id + slug for forensics).
      with to_delete as (
        select id, slug, name
          from public.clients
         where lifecycle_status = 'deleted'
           and data_deletion_scheduled_at is not null
           and data_deletion_scheduled_at < (now() - interval '60 days')
      ), audit_write as (
        insert into public.integration_call_log (
          provider, operation, direction, request_shape, response_status,
          response_shape, latency_ms, error_class, error_message, client_id,
          correlation_id
        )
        select
          'webnua',
          'cancellation_hard_delete',
          'inbound',
          jsonb_build_object(
            'client_id', id,
            'client_slug', slug,
            'client_name', name,
            'reason', 'two_stage_cancellation_grace_expired'
          ),
          200, null, null, null, null,
          null,  -- client_id NULLed: row is about to vanish, FK would break
          gen_random_uuid()::text
        from to_delete
        returning 1
      )
      delete from public.clients c
       using to_delete d
       where c.id = d.id;
    $cron$
  );
end $$;
