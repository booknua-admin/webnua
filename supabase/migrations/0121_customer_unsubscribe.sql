-- =============================================================================
-- Webnua backend — customer marketing opt-out.
--
-- Compliance: every automation-driven customer-facing email now carries an
-- unsubscribe link (HMAC-signed token → /api/email/unsubscribe). Opting out
-- stamps customers.unsubscribed_at; the send_email + send_sms job handlers
-- check the flag before any customer-facing automation send and skip
-- honestly. One flag covers both channels — alphanumeric SMS senders are
-- one-way (no STOP path), so the email unsubscribe is the opt-out surface
-- for both.
--
-- Direct 1:1 operator replies from the inbox are transactional and are NOT
-- gated — a customer who replied to the business expects the answer.
-- =============================================================================

alter table public.customers
  add column if not exists unsubscribed_at timestamptz;

comment on column public.customers.unsubscribed_at is
  'When the customer opted out of automated marketing messages (email + SMS). NULL = subscribed. Set via the signed unsubscribe link; writes are service-role only.';
