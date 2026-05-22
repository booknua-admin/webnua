-- =============================================================================
-- Webnua backend — Phase 7 Twilio SMS · 0058_client_sms_sender_registration.sql
--
-- Migration 0050 created client_sms_senders (one alphanumeric sender per
-- client, with a carrier-registration status lifecycle). The Twilio SMS
-- session adds the one missing column: the Twilio-side identifier of the
-- registration / AlphaSender resource so getSenderIDStatus() can poll it.
--
-- registerSenderID() adds the alphanumeric string to Webnua's Twilio
-- Messaging Service as an AlphaSender resource; that resource has a SID, kept
-- here so a later status check (or a support-ticket reference, for the
-- regulated-country registration path) can be resolved back to the row.
--
-- NULL until the operator first submits the sender id through the provisioning
-- UI. RLS / grants unchanged — client_sms_senders stays operator-SELECT
-- (scoped through accessible_client_ids()) and service-role-write; SELECT is
-- column-agnostic so the new column inherits the existing policy.
-- =============================================================================

alter table public.client_sms_senders
  add column twilio_registration_sid text;

comment on column public.client_sms_senders.twilio_registration_sid is
  'Twilio AlphaSender resource SID for this sender, set by registerSenderID(). '
  'NULL before the operator submits the sender id. Polled by getSenderIDStatus().';
