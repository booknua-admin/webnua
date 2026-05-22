-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · client_email_senders.
--
-- Webnua owns the Resend account and the mail.webnua.com sending domain
-- (operator decision — a subdomain of the primary, not a lookalike domain).
-- Each client is assigned ONE email sub-address slug. The composed sending
-- address is [slug]@mail.webnua.com — composed in app code from `slug` +
-- the EMAIL_SENDING_DOMAIN env var, NOT stored, so the domain can move without
-- a data migration.
--
-- `display_name` is the human "From" name shown in the recipient's client.
-- Replies route to the Webnua lead inbox (no forwarding to a personal mailbox
-- in V1) — handled by the inbound-email integration in a later session.
--
-- `custom_domain` is the V1.1 path: a client that verifies its own domain
-- sends from it instead of the shared subdomain. Nullable; unused this session.
--
-- RLS: operators see all (scoped through accessible_client_ids() so juniors
-- stay inside their assignment); client-role users get no access. Writes are
-- service-role only this session.
-- =============================================================================

create table public.client_email_senders (
  id            uuid primary key default gen_random_uuid(),
  -- One sender per client.
  client_id     uuid not null unique references public.clients (id) on delete cascade,
  -- Unique across ALL clients — it is the local-part of a real address.
  -- Lowercase alphanumeric + hyphens (a valid, collision-resistant local-part).
  slug          varchar(30) not null unique check (slug ~ '^[a-z0-9-]+$'),
  -- Shown as the "From" display name on outbound email.
  display_name  varchar(80) not null,
  status        text not null default 'active'
                  check (status in ('active', 'suspended')),
  -- V1.1: a client's own verified domain. NULL = use [slug]@mail.webnua.com.
  custom_domain text,
  created_at    timestamptz not null default now()
);

-- --- RLS ---------------------------------------------------------------------
alter table public.client_email_senders enable row level security;
revoke insert, update, delete on public.client_email_senders from authenticated;

create policy client_email_senders_select on public.client_email_senders
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
