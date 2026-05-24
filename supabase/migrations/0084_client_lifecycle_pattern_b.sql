-- =============================================================================
-- Webnua backend — Pattern B onboarding · lifecycle enum extension.
--
-- Pattern B refactors signup from "pay first, then onboard" → "sign up free,
-- build a preview, pay to publish". This migration extends the
-- `client_lifecycle` enum with the new states; uses of the new values
-- (default change + columns) land in 0085 because Postgres requires the
-- ADD VALUE transaction to commit before the new value can be referenced
-- (same precedent as migrations 0038 → 0039 and 0026).
--
--   pending_verification — workspace exists, user has not yet clicked the
--                          email-verification magic link. After 7 days the
--                          0086 cron deletes the row.
--   preview              — email verified; user runs the wizard, generates a
--                          site/funnel against this workspace. Public site at
--                          {slug}.webnua.dev renders with a "preview"
--                          watermark + noindex; forms render but are
--                          disabled so a non-paying workspace cannot
--                          accidentally capture real leads.
--   banned               — operator-imposed terminal state. Public site stops
--                          rendering. Used for abuse cleanup.
--   active               — Pattern B's published-and-paying state. Synonym of
--                          Session 1's 'live'; both stay valid so Session 1's
--                          production rows remain unchanged.
--
-- `if not exists` keeps the migration idempotent. Schema-only — downstream
-- USES of these values are in migration 0085.
-- =============================================================================

alter type public.client_lifecycle add value if not exists 'pending_verification';
alter type public.client_lifecycle add value if not exists 'preview';
alter type public.client_lifecycle add value if not exists 'banned';
alter type public.client_lifecycle add value if not exists 'active';
