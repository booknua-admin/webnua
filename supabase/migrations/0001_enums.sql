-- =============================================================================
-- Webnua backend — Phase 1 Session A · enums (identity + policy layer).
--
-- The closed unions from backend-schema-design.md §1.7 that the identity +
-- policy tables reference. Operational enums (leads/tickets/...) land in
-- Session B; builder enums (page/section/version) land in Phase 1b.
--
-- Enum labels are the verbatim TypeScript union strings (camelCase included)
-- so generated types match the front-end types 1:1 with no mapping layer.
-- =============================================================================

create type user_role as enum ('admin', 'client');

create type team_role as enum ('owner', 'operator', 'junior');

create type capability as enum (
  'viewBuilder',
  'editCopy',
  'editMedia',
  'editSEO',
  'editLayout',
  'editSections',
  'editTheme',
  'editPages',
  'useAI',
  'publish',
  'approve',
  'rollback',
  'manageDomain'
);

create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create type client_lifecycle as enum ('onboarding', 'live', 'paused', 'churned');

create type policy_key as enum (
  'defaultClientCapabilities',
  'integrationDefaults',
  'defaultSeatLimit',
  'brandDefaults',
  'automationDefaults',
  'pricingDefaults'
);

create type billing_cycle as enum ('monthly', 'yearly');
