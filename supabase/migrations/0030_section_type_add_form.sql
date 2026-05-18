-- =============================================================================
-- Webnua backend — add the `form` section type.
--
-- The form-builder effort adds a dedicated `form` section type (a section
-- whose content is a lead-capture form). The `section_type` enum (created in
-- 0012, extended in 0026) is kept in lockstep with the TypeScript
-- SectionType union — `generation_log.section_type` is this enum.
--
-- Enum sort order is not significant. `if not exists` keeps it idempotent.
-- =============================================================================

alter type section_type add value if not exists 'form';
