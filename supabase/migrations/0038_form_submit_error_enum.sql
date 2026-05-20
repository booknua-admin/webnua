-- =============================================================================
-- Webnua backend — add the `form_submit_error` analytics event type.
--
-- Closes analytics-audit §5.2 gap #1: a failed form submission was previously
-- indistinguishable from a successful one — the tracker's capture-phase
-- `form_submit` event fired before the API outcome was known. We retain
-- `form_submit` with relabelled semantics ("submit attempted") and add a
-- dedicated error event the React form layer fires after the API rejects.
--
-- The aggregator's `case` block reads this value as a literal, which Postgres
-- only allows once the enum value is committed (PG 12+ allows ADD VALUE in a
-- transaction but the new value can't be used until commit). So this is a
-- schema-only migration; the aggregator update lands in 0039 separately.
--
-- Enum sort order is not significant. `if not exists` keeps it idempotent.
-- =============================================================================

alter type analytics_event_type add value if not exists 'form_submit_error';
