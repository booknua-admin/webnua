-- Bundle C2b-2 — extend `generation_fallback_reason` with the
-- `variant-reassigned` value the new bundle-aware variant-assignment pass
-- (`assignBundleVariants` in `lib/website/generation-validation.ts`) writes
-- whenever a section's variant key (e.g. `hero.layout`) is narrowed to a
-- bundle-allowable set that excludes the AI's pick.
--
-- This is distinct from `invalid` (the AI emitted a value outside the
-- catalog) — the AI here emitted a CATALOG-valid value, and bundle policy
-- steered it to a different in-bundle pick. Telemetry needs the two
-- distinguishable so the variant-narrowing rate per bundle is queryable.
--
-- Pure-additive ALTER TYPE — non-destructive, fully backwards compatible
-- with every existing row.

alter type generation_fallback_reason add value if not exists 'variant-reassigned';
