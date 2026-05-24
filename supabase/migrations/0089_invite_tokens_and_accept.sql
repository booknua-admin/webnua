-- =============================================================================
-- 0089_invite_tokens_and_accept — real magic-link invite acceptance.
--
-- Adds the columns the invite-accept flow needs on both invite tables:
--
--   token        — opaque random URL-safe id, the path segment in the magic
--                  link `{appBase}/invite/{token}`. Random 32 bytes →
--                  base64url ≈ 43 chars; the unique index gives us the
--                  one-row lookup the GET /api/invites/[token] route runs.
--   consumed_at  — when the customer accepted (clicked the link, set the
--                  password, was provisioned). NULL while pending; non-NULL
--                  rows are LOCKED — a second use of the same link is
--                  rejected by the accept route + the lookup-by-token RLS.
--
-- The existing `magic_link text not null` column stays — it carries the
-- full URL the email body uses. New code reads `token`; existing hydration
-- paths keep working unchanged.
--
-- Backfill: any pre-existing rows have fake magic_links produced by the
-- previous client-side stub modal. They never resolved to anything and
-- are dev-only. We backfill `token` with a fresh random string so the
-- NOT NULL constraint holds, then mark them `expired` (status flip) so
-- they don't show up as actionable on operator/client team surfaces.
--
-- Daily expiry sweep cron: flips `pending` invites whose `expires_at`
-- has passed to `expired` (so the UI's "Expired · Resend" affordance
-- can light up). The accept route ALSO defends against an expired
-- invite — the cron is the UI-feedback path, not the security check.
--
-- The auto-grant trigger from migration 0088 (`grant_owner_caps_on_first_user`)
-- already covers the accept flow: when the accept route inserts a public.users
-- row (via `auth.admin.createUser` + the 0017 trigger), the 0088 trigger
-- fires and grants CLIENT_OWNER_DEFAULTS if no other client-role user
-- exists for that workspace. Teammate invitees (subsequent users) stay at
-- CLIENT_DEFAULTS as designed.
-- =============================================================================

-- --- 1. team_invites -------------------------------------------------------

alter table public.team_invites
  add column if not exists token text,
  add column if not exists consumed_at timestamptz;

-- Backfill any existing rows with a random token + mark them expired.
update public.team_invites
set
  token = replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
  status = case when status = 'pending' then 'expired'::invite_status else status end
where token is null;

alter table public.team_invites
  alter column token set not null;

create unique index if not exists ux_team_invites_token on public.team_invites (token);

-- --- 2. client_user_invites ------------------------------------------------

alter table public.client_user_invites
  add column if not exists token text,
  add column if not exists consumed_at timestamptz;

update public.client_user_invites
set
  token = replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
  status = case when status = 'pending' then 'expired'::invite_status else status end
where token is null;

alter table public.client_user_invites
  alter column token set not null;

create unique index if not exists ux_client_user_invites_token
  on public.client_user_invites (token);

-- --- 3. daily expiry sweep cron -------------------------------------------

-- pg_cron extension is already enabled by earlier migrations (0049, 0086).
-- Schedule the sweep at 02:00 UTC daily — comfortably before the
-- pending_verification sweep (03:00 UTC) so an invite that expires on the
-- same day as the user's signup window doesn't race.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'webnua_invite_expiry_sweep') then
    perform cron.unschedule('webnua_invite_expiry_sweep');
  end if;
  perform cron.schedule(
    'webnua_invite_expiry_sweep',
    '0 2 * * *',
    $cron$
      update public.team_invites
        set status = 'expired'
        where status = 'pending' and expires_at < now();
      update public.client_user_invites
        set status = 'expired'
        where status = 'pending' and expires_at < now();
    $cron$
  );
exception
  -- Fail open — the cron is observability/UI feedback, not security. A dev
  -- DB without pg_cron (uncommon) shouldn't block the migration.
  when others then
    raise notice 'invite expiry cron skipped: %', sqlerrm;
end;
$$;
