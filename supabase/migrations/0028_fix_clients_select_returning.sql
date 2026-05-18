-- =============================================================================
-- Webnua backend — fix clients_select so INSERT ... RETURNING works.
--
-- clients_select (0004) was the one tenant-isolation policy whose USING
-- expression re-queries its OWN table:
--   using (id in (select private.accessible_client_ids()))
-- accessible_client_ids() is a STABLE SECURITY DEFINER function that, for an
-- operator, runs `select c.id from public.clients c where <operator>`.
--
-- A plain SELECT is fine. But PostgREST issues every insert as
-- `INSERT ... RETURNING` (supabase-js `.insert().select()`), and PostgreSQL
-- applies the SELECT policy to the RETURNING row. accessible_client_ids() is
-- STABLE, so its sub-SELECT over `clients` uses the statement-start snapshot —
-- which does NOT contain the row being inserted. The new id is therefore not
-- in the returned set, the USING expression is false, and the insert fails
-- with `42501: new row violates row-level security policy for table
-- "clients"` — a 403 that misreads as "you are not an operator".
--
-- The create-client flow (operator-only) hits this on its very first write.
--
-- Fix: give clients_select the operator short-circuit users_select already
-- carries (`... or private.is_operator()`). For an operator the policy passes
-- without enumerating `clients`, so the RETURNING row is visible immediately.
-- Non-operators cannot INSERT into clients (clients_insert requires
-- is_operator), so they never reach the RETURNING path; their reads still
-- resolve through accessible_client_ids() exactly as before.
-- =============================================================================

drop policy clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated
  using (
    private.is_operator()
    or id in (select private.accessible_client_ids())
  );
