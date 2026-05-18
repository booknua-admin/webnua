-- =============================================================================
-- Webnua backend — Phase 1 Session A · move RLS helpers to a private schema.
--
-- The RLS helper functions (0003) were created in `public`, which PostgREST
-- exposes as RPC endpoints (/rest/v1/rpc/...). They are RLS internals, not a
-- public API — the security advisor flags the exposure. Moving them to a
-- non-exposed `private` schema removes the RPC surface; RLS policies follow
-- the functions (the move is OID-stable) and keep working. `authenticated`
-- is granted USAGE on the schema so policy evaluation can still reach them.
--
-- Convention henceforth: RLS helper functions are created in `private`.
-- =============================================================================

create schema if not exists private;

-- Policy evaluation runs as the querying role; it needs schema USAGE to
-- reach the helpers. `anon` is intentionally not granted — every Session A
-- policy targets `authenticated` only.
grant usage on schema private to authenticated;

alter function public.is_operator() set schema private;
alter function public.is_senior_operator() set schema private;
alter function public.current_client_id() set schema private;
alter function public.accessible_client_ids() set schema private;
alter function public.has_capability(uuid, public.capability) set schema private;
