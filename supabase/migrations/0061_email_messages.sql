-- =============================================================================
-- Webnua backend — Phase 7 Resend · 0061_email_messages.sql
--
-- One row per email send AND per inbound reply. The Resend integration's send
-- log + inbound mailbox: every outbound transactional email (lead nurture,
-- review request, operator notification) and every inbound reply that lands
-- at *@mail.webnua.com is recorded here.
--
-- Single table for both directions (discriminated by `direction`) — the
-- conversation view on a lead reads `email_messages` filtered by
-- related_lead_id and renders the rows in chronological order. Distinct from
-- integration_call_log (the raw HTTP-call audit), sms_messages (the SMS
-- send log), and notifications_outbound (the Stripe-era operator email log;
-- new operator notification emails write rows here AND a notifications_outbound
-- row for the throttle query — see 0063).
--
-- Threading: the `reply_to_address` carries a plus-addressed token
-- (`{clientSlug}+lead-{token}@mail.webnua.com`) signed by an HMAC; the
-- inbound webhook verifies the token and resolves the lead. The `thread_token`
-- column stores the raw token so a future operator-side audit / debug can
-- look it up directly.
--
-- Attachments are saved to the email-attachments Storage bucket (0064); the
-- column carries an array of `{ filename, content_type, storage_path }` JSON
-- objects.
--
-- RLS: operators see their accessible clients' messages; client-role users
-- see their own client's messages (a client can read replies on their leads).
-- accessible_client_ids() covers both. Writes are service-role only (the
-- send_email job handler + the inbound webhook + the reply route all run as
-- service_role).
-- =============================================================================

create table public.email_messages (
  id                       uuid primary key default gen_random_uuid(),
  occurred_at              timestamptz not null default now(),
  client_id                uuid not null references public.clients (id) on delete cascade,
  -- 'outbound' = we sent it (lead nurture, review request, operator notification,
  -- or an operator reply from the inbox). 'inbound' = a lead replied to one of
  -- our outbound emails and Resend's inbound webhook delivered it here.
  direction                text not null
                             check (direction in ('outbound', 'inbound')),
  -- The visible From / To / Reply-To addresses, snapshotted at send/receive time
  -- — text, NOT a join. The sender slug may change later (re-branded), but the
  -- email that went out carried whatever string was current.
  sender_address           text not null,
  recipient_address        text not null,
  reply_to_address         text,
  subject                  text not null default '',
  body_text                text not null default '',
  body_html                text not null default '',
  -- For outbound: the Resend message id (re_…) returned by the send response.
  -- The delivery-status webhook updates the row's status by this id.
  resend_message_id        text,
  -- For threading: the email this one was sent in reply to (RFC 2822
  -- In-Reply-To header). Stored so the conversation view can stitch incoming
  -- replies to the outgoing message they answer.
  in_reply_to_message_id   text,
  -- Lifecycle. Outbound: queued → sent → delivered (or bounced / failed /
  -- complained). Inbound: 'received' on insert. The Resend delivery webhook
  -- updates outbound rows; inbound rows stay at 'received'.
  status                   text not null default 'queued'
                             check (status in
                               ('queued', 'sent', 'delivered',
                                'bounced', 'complained', 'failed',
                                'received')),
  -- The lead this email concerns. Outbound: set from the send job's payload.
  -- Inbound: resolved from the plus-addressing thread token at the inbound
  -- webhook. on delete set null: the message log row outlives the lead.
  related_lead_id          uuid references public.leads (id) on delete set null,
  -- The raw plus-addressing token (e.g. `lead-abc123-xyz789…`). Outbound: the
  -- token we minted for the reply-to we sent. Inbound: the token we parsed
  -- out of the recipient address. Stored for debug / audit; the source of
  -- truth for "which lead is this" is related_lead_id.
  thread_token             text,
  -- Attachments — `[{ filename, content_type, storage_path }, …]`. Storage
  -- lives under the email-attachments bucket (0064). Outbound: pictures /
  -- documents the operator attached on the reply. Inbound: attachments
  -- Resend extracted from the inbound MIME and we re-uploaded.
  attachments              jsonb not null default '[]'::jsonb,
  -- Auto-responder detection — true when the inbound webhook identified an
  -- out-of-office / vacation autoreply by header (`Auto-Submitted`,
  -- `X-Autoreply`) or subject pattern. Such inbound rows are recorded for
  -- audit but the conversation view filters them out by default — we never
  -- want a customer's "I'm on holiday" to look like a real reply.
  is_auto_responder        boolean not null default false,
  -- Trace id for stitching this row to the integration_call_log row(s) of the
  -- send / receive call. Optional.
  correlation_id           text,
  -- The operator who composed this row (outbound, when reaching from the
  -- inbox reply composer). NULL for inbound or for system-generated sends
  -- (lead notifications, automated nurture). on delete set null: the row
  -- outlives the user.
  sent_by                  uuid references public.users (id) on delete set null
);

-- The conversation lookup: every email on a lead, oldest first.
create index email_messages_lead_idx
  on public.email_messages (related_lead_id, occurred_at)
  where related_lead_id is not null;
-- The client log query: a client's recent emails, newest first.
create index email_messages_client_idx
  on public.email_messages (client_id, occurred_at desc);
-- The delivery-webhook lookup: find a row by its Resend message id. Partial —
-- only rows that actually reached Resend carry the id.
create index email_messages_resend_id_idx
  on public.email_messages (resend_message_id)
  where resend_message_id is not null;
-- The inbound-routing lookup: find an outbound row by its thread token (debug
-- / audit). Partial — only rows that carry a token.
create index email_messages_thread_idx
  on public.email_messages (thread_token)
  where thread_token is not null;

-- --- RLS ---------------------------------------------------------------------
alter table public.email_messages enable row level security;
revoke insert, update, delete on public.email_messages from authenticated;

create policy email_messages_select on public.email_messages
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
