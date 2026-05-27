-- =============================================================================
-- 0102 — Auto-assign SMS sender id lifecycle.
--
-- The previous lifecycle assumed an operator manually submitted a sender id
-- on /settings/sms; the route called Twilio first and inserted the row only
-- on success. The auto-assign work in PR A enqueues a background job that
-- calls Twilio for every new client at signup. To make that job's progress
-- visible in the operator UI, we insert the client_sms_senders row BEFORE
-- the Twilio call:
--
--   pending_registration → twilio call enqueued, not yet attempted
--   pending_approval     → Twilio AlphaSender resource exists; awaiting
--                          carrier approval in regulated countries
--                          (unchanged — the manual operator path lands here
--                           too, post-Twilio-call)
--   approved             → carrier-approved, sender is usable (unchanged)
--   failed               → Twilio rejected the registration (auth 20003,
--                          invalid sender, service unavailable). Operator
--                          intervenes — error in `notes`.
--   rejected             → Twilio Console marked the AlphaSender rejected
--                          (regulated-country review denied; unchanged)
--   suspended            → Twilio suspended the sender (unchanged)
--
-- Adds a global UNIQUE on sender_id (case-folded) so the derivation's
-- collision check is enforced at the DB even under racing inserts. Twilio
-- itself rejects duplicates within a Messaging Service, but catching it at
-- our DB is faster + clearer than waiting for a 409 from Twilio.
-- =============================================================================

-- 1. Drop the old status check, install the new one. Existing rows have a
--    status value already inside the new closed set so no data migration is
--    needed.
alter table public.client_sms_senders
  drop constraint if exists client_sms_senders_status_check;

alter table public.client_sms_senders
  add constraint client_sms_senders_status_check
    check (status in
      ('pending_registration', 'pending_approval', 'approved',
       'failed', 'rejected', 'suspended'));

-- 2. Case-folded unique on sender_id. Webnua runs a single Twilio Messaging
--    Service so duplicate AlphaSender values are not legal anyway.
create unique index if not exists client_sms_senders_sender_id_lower_unique
  on public.client_sms_senders (lower(sender_id));

-- 3. Track the active auto-assign job + the last failure reason so the
--    operator UI surfaces what is in flight without polling Twilio. Optional
--    columns — manual-path rows (the existing operator submission flow) do
--    not populate them.
alter table public.client_sms_senders
  add column if not exists registration_job_id uuid
    references public.integration_jobs(id) on delete set null,
  add column if not exists last_registration_attempt_at timestamptz,
  add column if not exists last_failure_code text,
  add column if not exists last_failure_message text;

comment on column public.client_sms_senders.registration_job_id is
  'The most-recent twilio_register_sender_id integration_jobs row that owns
   the registration call. Set on enqueue, cleared once the job reaches a
   terminal status (approved / failed / rejected).';

comment on column public.client_sms_senders.last_failure_code is
  'Twilio error code (or "auth_failed" / "transport_error") from the most
   recent failed registration attempt. Read by the operator UI to show
   "Twilio credentials invalid — fix env, then retry" style messaging.';
