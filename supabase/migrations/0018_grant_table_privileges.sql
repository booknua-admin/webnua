-- =============================================================================
-- Webnua backend — Phase 2 · table privileges for the `authenticated` role.
--
-- Phase 1 created every table, enabled RLS, and authored RLS policies that
-- target `to authenticated` — but never issued the table-level DML GRANTs the
-- policies sit on top of. RLS narrows what a role may see; it does NOT grant
-- base access. With no `GRANT SELECT/INSERT/UPDATE/DELETE`, `authenticated`
-- hits `permission denied for table` before any policy is consulted — which
-- means a real signed-in session cannot even read its own `public.users`
-- profile. This migration restores the grant baseline the RLS layer assumes.
--
-- `anon` is deliberately left without DML — every Phase 1 policy targets
-- `authenticated` only; there is no anonymous data access.
--
-- Also hardens the two `SECURITY DEFINER` functions that live in the
-- PostgREST-exposed `public` schema (flagged by the security advisor):
--   - public.handle_new_user()  — a trigger function (0017); never an RPC.
--   - public.rls_auto_enable()  — a platform-provided event-trigger function
--     that auto-enables RLS on new `public` tables. Event-trigger functions
--     cannot be invoked via `/rest/v1/rpc`, and neither fires through an
--     EXECUTE grant, so revoking EXECUTE from PUBLIC is safe and clears the
--     advisor warning without changing behaviour.
-- =============================================================================

-- --- existing tables ---------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- --- future tables (objects created later by the migration role) -------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;

-- --- sequences (future-proofing — no public sequences exist today) -----------
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- --- SECURITY DEFINER function exposure hardening ----------------------------
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.rls_auto_enable() from public;
