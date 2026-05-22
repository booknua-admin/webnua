-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · integration_call_log.
--
-- Every outbound call to an external provider — and every inbound webhook we
-- accept — is logged here by src/lib/integrations/_shared/call.ts
-- (callExternal). This is the audit + debugging spine for ALL Phase 7
-- integrations.
--
-- A separate table from generation_log, by operator decision: generation_log
-- is an AI prompt-tuning artefact; integration calls are operational telemetry.
-- Different lifecycle, different retention, different consumers — separate
-- table keeps each concern clean.
--
-- Trust model:
--   • Rows are written ONLY by server code holding the service-role key
--     (callExternal). `authenticated` gets NO write access — the 0018
--     default-privilege INSERT/UPDATE/DELETE grant is revoked below.
--   • Operators get SELECT, tenant-scoped through accessible_client_ids() so a
--     junior operator cannot read another tenant's call history. (The brief
--     said "operators see all"; scoping through accessible_client_ids() honours
--     that for senior operators — whose accessible set IS every client — while
--     keeping juniors inside their assignment, consistent with the migration
--     0045 cross-tenant discipline.) Platform-level calls (client_id NULL —
--     e.g. Vercel) are visible to every operator.
--   • Client-role users get no access at all.
--
-- Partitioning strategy: a single table for V1. Expected Phase 7 launch volume
-- is well under 100k rows/day and the two composite indexes carry the query
-- patterns (per-provider debugging, per-client audit). IF write volume later
-- exceeds ~100k rows/day, migrate to monthly RANGE partitions on occurred_at
-- (declarative partitioning) plus a retention job that DROPs partitions past
-- the window — cheaper than DELETE-by-date on a large heap. Not warranted now.
-- =============================================================================

create table public.integration_call_log (
  id              uuid primary key default gen_random_uuid(),
  occurred_at     timestamptz not null default now(),
  provider        text not null,
  operation       text not null,
  -- 'outbound' = a call we made; 'inbound' = a webhook we received. Both are
  -- logged so a webhook delivery is auditable alongside the calls it triggers.
  direction       text not null default 'outbound'
                    check (direction in ('outbound', 'inbound')),
  -- Redacted JSON shapes — secret-looking keys are blanked before write
  -- (callExternal's defaultRedact). Request/response *headers* are never
  -- logged: that is where auth tokens live.
  request_shape   jsonb,
  response_status integer,
  response_shape  jsonb,
  latency_ms      integer,
  error_class     text
                    check (error_class is null or error_class in
                      ('retryable', 'non_retryable', 'auth_failed', 'rate_limited')),
  error_message   text,
  -- NULL for platform-level calls (Webnua's own account, no tenant). on delete
  -- set null: an audit row outlives the client it referenced.
  client_id       uuid references public.clients (id) on delete set null,
  -- Traces a unit of async work across the several calls it fans into.
  correlation_id  uuid
);

create index integration_call_log_provider_idx
  on public.integration_call_log (provider, occurred_at desc);
create index integration_call_log_client_idx
  on public.integration_call_log (client_id, occurred_at desc);
create index integration_call_log_correlation_idx
  on public.integration_call_log (correlation_id)
  where correlation_id is not null;

-- --- RLS ---------------------------------------------------------------------
alter table public.integration_call_log enable row level security;

-- The 0018 default-privilege grant hands `authenticated` full DML on every new
-- public table; this log is service-role-write-only, so the write privileges
-- are revoked. RLS still gates SELECT; service_role keeps full access.
revoke insert, update, delete on public.integration_call_log from authenticated;

create policy integration_call_log_select on public.integration_call_log
  for select to authenticated
  using (
    private.is_operator()
    and (
      client_id is null
      or client_id in (select private.accessible_client_ids())
    )
  );
