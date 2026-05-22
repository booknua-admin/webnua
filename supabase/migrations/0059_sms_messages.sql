-- =============================================================================
-- Webnua backend — Phase 7 Twilio SMS · 0059_sms_messages.sql
--
-- One row per outbound SMS send. The send log: every transactional SMS
-- (lead acknowledgment, job confirmation, arrival notification, review
-- request) is recorded here by the send_sms job handler, with the Twilio
-- message SID kept so the delivery status-callback webhook can update the row
-- as Twilio reports queued → sent → delivered (or failed / undelivered).
--
-- Distinct from integration_call_log (the raw HTTP-call audit) and from
-- notifications_outbound (operator emails) — this is the customer-facing SMS
-- log a client / operator reads to see what went out and whether it landed.
--
-- segments_count + encoding are computed by the SMS character validator at
-- send time (src/lib/sms/character-validator.ts), not read back from Twilio —
-- the validator is the source of truth the cost estimate is built on.
-- cost_eur = segments × the per-segment rate (src/lib/sms/pricing.ts).
--
-- RLS: operators see their accessible clients' messages; client-role users
-- see their own client's messages (a client can audit what was sent on their
-- behalf). accessible_client_ids() covers both — it returns an operator's
-- assignment set and a client's own single client. Writes are service-role
-- only (the send_sms job handler + the Twilio webhook run as service_role);
-- the 0018 default DML grant's INSERT/UPDATE/DELETE are revoked.
-- =============================================================================

create table public.sms_messages (
  id                 uuid primary key default gen_random_uuid(),
  sent_at            timestamptz not null default now(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  -- The alphanumeric string that appeared as the "From" — a value snapshot,
  -- NOT an FK: the sender row may change or be re-registered later, but the
  -- message went out under whatever string was current at send time.
  sender_id          text not null,
  recipient_phone    text not null,
  message_body       text not null,
  -- Computed by the SMS validator at send time. GSM: 160 single / 153 multi;
  -- UCS-2: 70 single / 67 multi. Typically 1–2 for a transactional SMS.
  segments_count     integer not null default 1 check (segments_count >= 1),
  encoding           text not null default 'gsm'
                       check (encoding in ('gsm', 'ucs2')),
  -- Twilio's message SID (SM…). NULL when a send failed before Twilio
  -- accepted it (e.g. Twilio unconfigured, network error). The status webhook
  -- looks the row up by this id.
  twilio_message_sid text,
  status             text not null default 'queued'
                       check (status in
                         ('queued', 'sent', 'delivered', 'failed', 'undelivered')),
  -- Twilio's delivery error code + a human message, populated on a failed /
  -- undelivered outcome (from the send response or the status webhook).
  error_code         text,
  error_message      text,
  -- The lead this SMS was about, when applicable (the lead-acknowledgment
  -- send). on delete set null: the send-log row outlives the lead.
  related_lead_id    uuid references public.leads (id) on delete set null,
  -- segments × per-segment rate, in EUR. An estimate — see src/lib/sms/pricing.ts.
  cost_eur           numeric(10, 4)
);

-- The operator / client log query: a client's recent messages, newest first.
create index sms_messages_client_idx
  on public.sms_messages (client_id, sent_at desc);
-- The status-webhook lookup: find a row by its Twilio SID. Partial — only
-- rows that actually reached Twilio carry a SID.
create index sms_messages_twilio_sid_idx
  on public.sms_messages (twilio_message_sid)
  where twilio_message_sid is not null;
create index sms_messages_lead_idx
  on public.sms_messages (related_lead_id)
  where related_lead_id is not null;

-- --- RLS ---------------------------------------------------------------------
alter table public.sms_messages enable row level security;
revoke insert, update, delete on public.sms_messages from authenticated;

create policy sms_messages_select on public.sms_messages
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
