-- =============================================================================
-- Webnua backend — Phase 9 · client_custom_domains.
--
-- Self-serve + operator-concierge custom domain attachment for client sites.
-- Replaces the legacy single-domain pattern on `websites` (domain_primary +
-- domain_aliases stay for back-compat; the public resolver reads both this
-- new table AND those columns — see lib/public-site/resolve.ts).
--
-- A "client custom domain" is an attribute of the CLIENT, not a website — a
-- client business has one published website that lives on one or more
-- hostnames (their `{slug}.webnua.dev` Webnua subdomain + zero or more
-- registrar-owned domains they brought). The owning website is resolved by
-- joining clients → websites at render time.
--
-- Lifecycle status (resolves at the Vercel layer):
--   pending_dns   — added to Vercel, DNS records not yet pointing here
--   verifying     — DNS matches, Vercel is confirming
--   ssl_pending   — verified, SSL cert being provisioned
--   live          — Vercel says verified + DNS config OK
--   failed        — verification failed; verification_failed_reason is set
--   removed       — soft-deleted; removed_at populated
--
-- Multiple domains per client are supported; ONE may be `is_primary = true`
-- and that one drives 301 redirects from other hostnames serving the same
-- client. The half-unique partial index enforces "at most one primary per
-- client" without forcing every client to have one.
--
-- RLS:
--   • operators: SELECT all rows where client_id IN accessible_client_ids()
--   • clients:   SELECT, INSERT, UPDATE on their own rows
--   • DELETE / status writes from the polling job: service-role only
--     (DELETE is revoked from `authenticated`; the application path is a soft
--     delete via `removed_at` + `status='removed'`)
-- =============================================================================

-- --- enum --------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_custom_domain_status') then
    create type public.client_custom_domain_status as enum (
      'pending_dns',
      'verifying',
      'ssl_pending',
      'live',
      'failed',
      'removed'
    );
  end if;
end $$;

-- --- table -------------------------------------------------------------------

create table public.client_custom_domains (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid not null references public.clients (id) on delete cascade,
  -- Always stored lowercased + normalized; UNIQUE across all clients so two
  -- clients can never register the same host. NOT a citext column — we
  -- enforce lowercase in the manager + with the CHECK so an indexed varchar
  -- works.
  domain                      varchar(253) not null
                                check (domain = lower(domain) and domain <> ''),
  status                      public.client_custom_domain_status not null
                                default 'pending_dns',
  -- Canonical Vercel name (Vercel may normalize a punycode domain or fold a
  -- trailing dot — store what Vercel returns so subsequent calls are exact).
  -- Defaults to `domain` until the first Vercel call confirms.
  vercel_domain_name          varchar(253),
  -- Array of {type, name, value, ttl} the operator sets at their registrar.
  -- Both an A record (root) and a CNAME (subdomain) flavour are usually
  -- returned; the UI shows whichever matches the domain kind.
  dns_records_required        jsonb not null default '[]'::jsonb
                                check (jsonb_typeof(dns_records_required) = 'array'),
  verification_failed_reason  text,
  is_primary                  boolean not null default false,
  added_at                    timestamptz not null default now(),
  verified_at                 timestamptz,
  last_checked_at             timestamptz,
  last_error                  text,
  added_by                    uuid references public.users (id) on delete set null,
  removed_at                  timestamptz
);

-- A live (non-removed) domain is globally unique across all tenants. A removed
-- row is kept for audit + may collide with a fresh re-add (the manager handles
-- this case: re-adding a previously-removed domain reuses the row's history
-- vs inserting a duplicate is rejected by this index).
create unique index client_custom_domains_live_domain_uq
  on public.client_custom_domains (domain)
  where status <> 'removed';

-- At most one primary per client (excluding removed rows).
create unique index client_custom_domains_primary_per_client_uq
  on public.client_custom_domains (client_id)
  where is_primary = true and status <> 'removed';

create index client_custom_domains_client_status_idx
  on public.client_custom_domains (client_id, status);

-- The polling job scans this — (status, last_checked_at) is the query shape.
create index client_custom_domains_status_checked_idx
  on public.client_custom_domains (status, last_checked_at)
  where status in ('pending_dns', 'verifying', 'ssl_pending');

create index client_custom_domains_vercel_name_idx
  on public.client_custom_domains (vercel_domain_name);

-- --- RLS ---------------------------------------------------------------------

alter table public.client_custom_domains enable row level security;

-- DELETE stays service-role-only — the app uses a soft delete (status=removed
-- + removed_at). INSERT/UPDATE allowed for clients on their own rows;
-- operators see/write across their accessible clients.
revoke delete on public.client_custom_domains from authenticated;

-- Operators read every accessible client's row; client users read only their
-- own client's rows.
create policy client_custom_domains_select on public.client_custom_domains
  for select to authenticated
  using (
    client_id in (select private.accessible_client_ids())
  );

-- Insert: either operator on an accessible client, or a client user on their
-- own client. The `added_by` must equal auth.uid() so a row carries honest
-- attribution (the trigger below also stamps it; this WITH CHECK guards
-- against a hand-crafted INSERT spoofing another user).
create policy client_custom_domains_insert on public.client_custom_domains
  for insert to authenticated
  with check (
    client_id in (select private.accessible_client_ids())
    and (added_by is null or added_by = (select auth.uid()))
  );

-- Update: same scope as insert. Status transitions (pending → verifying →
-- live) come from the polling job under service-role and bypass this policy.
-- Application-side update paths are limited (set_primary, soft delete) —
-- those are operator + own-client only via the row's client_id.
create policy client_custom_domains_update on public.client_custom_domains
  for update to authenticated
  using (
    client_id in (select private.accessible_client_ids())
  )
  with check (
    client_id in (select private.accessible_client_ids())
  );

-- Stamp added_by from auth.uid() when the caller omitted it.
create or replace function private.stamp_client_custom_domain_added_by()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.added_by is null then
    new.added_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger client_custom_domains_stamp_added_by
  before insert on public.client_custom_domains
  for each row execute function private.stamp_client_custom_domain_added_by();
