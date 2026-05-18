-- =============================================================================
-- Webnua backend — Phase 1b · builder enums.
--
-- backend-schema-design.md §1.7 + backend-builder-data-model.md §6. The closed
-- unions the builder family (websites / funnels / versions / content drafts)
-- references. Enum labels are the verbatim TypeScript union strings.
-- =============================================================================

create type ssl_status as enum ('pending', 'live', 'error');

create type page_type as enum ('home', 'about', 'services', 'contact', 'generic');

-- The 11 section types — verbatim TS labels (camelCase preserved). Stackable
-- types first, then funnel-only, then the website-level singletons.
create type section_type as enum (
  'hero',
  'offer',
  'trust',
  'services',
  'reviews',
  'faq',
  'cta',
  'schedulePicker',
  'thanksConfirmation',
  'header',
  'footer'
);

create type version_status as enum ('draft', 'pending_approval', 'published', 'archived');

create type funnel_step_type as enum ('landing', 'schedule', 'thanks', 'optin', 'upsell');

-- The autosave write-buffer scope discriminator (builder-data-model §2).
create type draft_scope_kind as enum ('page', 'header', 'footer', 'funnel_step');
