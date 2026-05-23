-- =============================================================================
-- Webnua backend — Phase 7 GBP · gbp_review_requests.
--
-- Log of review-request messages (SMS or email) Webnua sent to a customer.
-- One row per send attempt, written by the gbp_send_review_request job
-- (migration 0069's trigger + the integration_jobs queue).
--
-- Powers two surfaces:
--   - Operator review-request log: who got asked, when, did they convert.
--   - Conversion measurement: a review arriving within 7 days of a sent
--     request can be linked via `resulted_in_review_id`. The sync job
--     does this attribution when it imports the review.
--
-- `channel` is sms OR email (not both — the job picks one based on lead
-- contact info, with SMS as the preferred default).
--
-- `status` mirrors the underlying provider's lifecycle in a small,
-- channel-agnostic vocabulary: queued -> sent -> delivered, or failed.
-- Updated by the send-job's terminal write; we DON'T currently push status
-- callbacks from Twilio/Resend into this row (the sms_messages /
-- email_messages tables are the authoritative per-channel logs — this
-- table is a higher-level audit of the review-request *intent*).
--
-- `resulted_in_review_id` is FK with on-delete-set-null because we keep
-- the request row even if the review is deleted at Google later.
--
-- RLS: operators see their accessible clients' requests; clients see
-- their own. Writes service-role only.
-- =============================================================================

create table public.gbp_review_requests (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients (id) on delete cascade,

  -- Linking context (all nullable — a manual operator-sent request may
  -- have neither lead nor booking).
  lead_id                  uuid references public.leads (id) on delete set null,
  booking_id               uuid references public.bookings (id) on delete set null,

  -- Recipient snapshot at send-time (the customer record may have changed
  -- since; an audit log must persist what we ACTUALLY sent to).
  recipient_name           text,
  recipient_phone          text,
  recipient_email          text,

  -- Channel + lifecycle.
  channel                  text not null check (channel in ('sms', 'email')),
  sent_at                  timestamptz not null default now(),
  status                   text not null default 'queued'
                              check (status in ('queued', 'sent', 'delivered', 'failed')),
  error_message            text,

  -- The deep-link the customer received.
  review_link              text not null,

  -- Engagement signals.
  clicked_at               timestamptz,
  resulted_in_review_id    uuid references public.gbp_reviews (id) on delete set null
);

create index gbp_review_requests_client_sent_idx
  on public.gbp_review_requests (client_id, sent_at desc);

create index gbp_review_requests_lead_idx
  on public.gbp_review_requests (lead_id)
  where lead_id is not null;

create index gbp_review_requests_unresolved_idx
  on public.gbp_review_requests (client_id, sent_at)
  where resulted_in_review_id is null
    and status in ('sent', 'delivered');

-- --- RLS ---------------------------------------------------------------------
alter table public.gbp_review_requests enable row level security;
revoke insert, update, delete on public.gbp_review_requests from authenticated;

create policy gbp_review_requests_select on public.gbp_review_requests
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
