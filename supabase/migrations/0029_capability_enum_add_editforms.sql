-- =============================================================================
-- Webnua backend — add the `editForms` capability.
--
-- The form-builder effort introduces a dedicated `editForms` capability that
-- gates lead-capture form editing (distinct from editCopy / editLayout — a
-- form captures customer data and creates leads). The capability is a
-- Postgres enum (`capability`, created in 0001) backing
-- `capability_grants.capabilities`, so the TypeScript `Capability` union and
-- the enum must stay in lockstep.
--
-- Enum sort order is not significant — nothing ORDERs BY this enum — so the
-- new label is appended. `if not exists` keeps the migration idempotent.
-- =============================================================================

alter type capability add value if not exists 'editForms';
