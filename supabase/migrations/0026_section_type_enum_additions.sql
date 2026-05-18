-- =============================================================================
-- Webnua backend — Phase 6 · section-library uplift · Phase 0.
--
-- The section library gains four new section types for full website page
-- coverage: about / features / gallery / contact. The section_type enum
-- (created in 0012) is extended to match the TypeScript SectionType union.
--
-- generation_log.section_type IS this enum (0011 + promoted in 0016), so a
-- generation run can log fallbacks against the new types with no further
-- schema change.
--
-- Enum sort order is not significant — nothing ORDERs BY this enum — so the
-- new labels are simply appended. `if not exists` keeps the migration
-- idempotent.
-- =============================================================================

alter type section_type add value if not exists 'features';
alter type section_type add value if not exists 'gallery';
alter type section_type add value if not exists 'about';
alter type section_type add value if not exists 'contact';
