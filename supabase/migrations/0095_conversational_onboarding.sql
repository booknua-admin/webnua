-- =============================================================================
-- Webnua backend — Conversational onboarding (Session B).
--
-- Replaces the wizard-based /sign-up path with a chat surface. The wizard
-- moves to /sign-up/legacy and stays valid for 30+ days as the fallback.
--
-- Two new pieces of schema:
--   (1) clients.conversation_state jsonb — sibling of wizard_state, NOT an
--       extension. Schema { messages, capturedFacts, current_turn, verified }.
--       Independent lifecycle from wizard_state; both columns coexist during
--       the legacy keep-alive. Drop wizard_state in V1.1 when telemetry says
--       conversational is the only path used.
--   (2) email_verification_codes — 6-digit codes via Resend, 10-minute
--       lifetime, hashed at rest (SHA-256 with email-as-salt). Replaces
--       magic-link for in-chat verification; magic-link infrastructure stays
--       wired for password reset + operator invites + client teammate invites.
--
-- The verification policy (10-min lifetime, 5 attempts before 15-min lockout,
-- 3 codes per email per hour) is enforced in app code (the route + the
-- rate-limit infra). This migration provides the storage shape only.
-- =============================================================================

-- --- 1. clients.conversation_state ----------------------------------------------

alter table public.clients
  add column if not exists conversation_state jsonb;

comment on column public.clients.conversation_state is
  'Conversational onboarding state — sibling of wizard_state. '
  'Schema: { messages, capturedFacts, current_turn, verified }. '
  'Independent lifecycle from wizard_state; both coexist during the 30-day '
  'legacy keep-alive.';

-- --- 2. email_verification_codes -----------------------------------------------
--
-- Append-mostly table. The `code_hash` stores SHA-256(email + ':' + code) —
-- never the raw code. `attempts` increments on each wrong submission;
-- `consumed_at` marks the code spent (either by successful verification OR
-- when a fresh code is requested — invalidates the prior).
--
-- One active code per email at a time. The request route marks any prior
-- active rows consumed BEFORE inserting the new row (so the latest row
-- whose expires_at > now() AND consumed_at IS NULL is the canonical active
-- code). Lookups always pick the most-recent row, so even if two requests
-- race, the newer one wins.
--
-- RLS: enabled, no policies — service-role only. Pattern of
-- public.integration_jobs / public.rate_limit_hits. Revoke INSERT/UPDATE/
-- DELETE/SELECT from authenticated explicitly (defence in depth).

create table if not exists public.email_verification_codes (
  email       text         not null,
  code_hash   text         not null,
  expires_at  timestamptz  not null,
  attempts    integer      not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz  not null default now(),
  primary key (email, created_at)
);

-- Active-code lookup: most recent unconsumed unexpired row for an email.
create index if not exists email_verification_codes_email_active_idx
  on public.email_verification_codes (email, expires_at desc)
  where consumed_at is null;

-- Cleanup-cron uses occurred_at for window deletes (a future cron could
-- prune consumed/expired rows older than 24h; not added in this migration).
create index if not exists email_verification_codes_created_at_idx
  on public.email_verification_codes (created_at);

comment on table public.email_verification_codes is
  'Conversational onboarding: 6-digit codes for in-chat email verification. '
  'Codes hashed at rest (SHA-256, email-as-salt). One active code per email; '
  'a fresh request marks prior rows consumed. 10-min lifetime + 5-attempt cap '
  'enforced in app code.';

-- --- 3. RLS -------------------------------------------------------------------

alter table public.email_verification_codes enable row level security;

revoke insert, update, delete, select
  on public.email_verification_codes
  from authenticated;

-- No policies — service-role only. The verification routes run under the
-- integration_db service client (bypasses RLS). Empty policy set is the
-- strictest possible authenticated-role posture.
