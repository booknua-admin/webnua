-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · notifications_outbound.
--
-- An audit row per operator-facing notification email actually SENT (via the
-- Resend integration). Distinct from public.notifications (0011) — that is the
-- in-app notification feed; this is the external-email send log. Two purposes:
--   • Throttling — "have we already emailed this client about this lead?" is a
--     query against (client_id, sent_at).
--   • Audit — what was sent, to whom, did it deliver.
--
-- Rows are written by the email-send path (service_role). `resend_message_id`
-- is the provider's id, kept for delivery-status reconciliation against Resend
-- webhooks.
--
-- RLS: operators see notifications for their accessible clients; client-role
-- users get no access. Writes are service-role only.
-- =============================================================================

create table public.notifications_outbound (
  id                uuid primary key default gen_random_uuid(),
  sent_at           timestamptz not null default now(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  recipient_email   text not null,
  template_name     text not null,
  -- The lead this notification was about, when applicable. on delete set null:
  -- the send-log row outlives the lead.
  related_lead_id   uuid references public.leads (id) on delete set null,
  status            text not null default 'sent'
                      check (status in ('sent', 'failed')),
  -- Resend's message id — for delivery-status reconciliation. NULL on a send
  -- that failed before Resend accepted it.
  resend_message_id text
);

-- Throttle query: recent notifications for a client.
create index notifications_outbound_client_idx
  on public.notifications_outbound (client_id, sent_at desc);

-- --- RLS ---------------------------------------------------------------------
alter table public.notifications_outbound enable row level security;
revoke insert, update, delete on public.notifications_outbound from authenticated;

create policy notifications_outbound_select on public.notifications_outbound
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
