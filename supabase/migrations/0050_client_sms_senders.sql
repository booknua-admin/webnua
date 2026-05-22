-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · client_sms_senders.
--
-- Webnua owns the Twilio account. Customers do NOT connect their own Twilio.
-- Each client is assigned ONE alphanumeric, one-way SMS sender id (V1: no
-- per-customer phone numbers — operator decision). The sender id is the brand
-- string that appears as the "From" on outbound SMS.
--
-- Twilio's alphanumeric-sender-id constraint: 1–11 characters, letters and
-- digits only, no spaces. The CHECK enforces it at the database boundary.
--
-- `status` tracks the carrier-registration lifecycle — alphanumeric senders
-- need pre-registration in many regions, so an assigned sender is not usable
-- until 'approved'.
--
-- RLS: operators see their accessible clients' senders; client-role users get
-- no access. Writes are service-role only this session (the operator
-- assignment UI is a later session) — the 0018 default DML grant's
-- INSERT/UPDATE/DELETE are revoked.
-- =============================================================================

create table public.client_sms_senders (
  id            uuid primary key default gen_random_uuid(),
  -- One sender per client.
  client_id     uuid not null unique references public.clients (id) on delete cascade,
  sender_id     varchar(11) not null check (sender_id ~ '^[A-Za-z0-9]+$'),
  registered_at timestamptz not null default now(),
  status        text not null default 'pending_approval'
                  check (status in
                    ('pending_approval', 'approved', 'rejected', 'suspended')),
  notes         text
);

-- --- RLS ---------------------------------------------------------------------
alter table public.client_sms_senders enable row level security;
revoke insert, update, delete on public.client_sms_senders from authenticated;

create policy client_sms_senders_select on public.client_sms_senders
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
