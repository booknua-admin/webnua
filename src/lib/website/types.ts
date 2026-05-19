// =============================================================================
// Website data model — see reference/builder-design.md §2 for the design.
//
// Funnels and Websites are independent artefacts (§2.0). This file holds
// website types only. Funnel types live in `lib/funnel/types.ts` (shape-
// only until Session 7 wires them).
//
// Brand lives on the Client (see lib/website/data-stub.tsx → the brand-by-
// clientId helper). Both Website and Funnel reference their client's brand
// via clientId — there is no `brand` field on Website itself in V1.
// =============================================================================

import type { FormConfig } from './form-config';

// ---- Section types --------------------------------------------------------

export type SectionType =
  // Stackable — appear in Page.sections[] and/or FunnelStep.sections[]
  | 'hero'
  | 'offer'
  | 'trust'
  | 'features'
  | 'services'
  | 'gallery'
  | 'reviews'
  | 'faq'
  | 'about'
  | 'contact'
  | 'cta'
  | 'form'
  | 'schedulePicker'      // funnel-only
  | 'thanksConfirmation'  // funnel-only
  // Website-level singletons — never in a page's sections[]
  | 'header'
  | 'footer';

/** Where a section type can be placed. The registry constraint that
 *  enforces singletons vs stackables — see design doc §2.2. */
export type ContainerKind =
  | 'page'              // Section is added to a Page.sections[]
  | 'funnelStep'        // Section is added to a FunnelStep.sections[]
  | 'websiteHeader'     // Section IS Website.header (singleton)
  | 'websiteFooter';    // Section IS Website.footer (singleton)

export type SectionAIMeta = {
  draftedFields: string[];
  lastRegenAt?: string;
};

export type Section = {
  id: string;
  type: SectionType;
  enabled: boolean;
  /** Section-type-specific data. Typed per-type via the section registry. */
  data: Record<string, unknown>;
  ai?: SectionAIMeta;
  /** Optional lead-capture form. Type-agnostic — any section may host one
   *  (see lib/website/form-config.ts). Lives on the envelope, not in `data`,
   *  because `data` is per-type-typed and a form attaches to every type. */
  form?: FormConfig;
};

// ---- Pages ----------------------------------------------------------------

/** Website page types (NOT funnel step types — those live in lib/funnel). */
export type PageType = 'home' | 'about' | 'services' | 'contact' | 'generic';

export type PageSEO = {
  title?: string;
  description?: string;
  ogImageUrl?: string;
};

export type Page = {
  id: string;
  websiteId: string;
  slug: string;            // 'home' | 'about' | 'services' | 'contact'
  title: string;
  type: PageType;
  sections: Section[];
  seo: PageSEO;
  createdAt: string;
  updatedAt: string;
};

// ---- Navigation -----------------------------------------------------------

/** Internal page link OR external href. */
export type NavLinkTarget =
  | { kind: 'page'; pageId: string }
  | { kind: 'href'; href: string };

export type NavLink = {
  label: string;
  target: NavLinkTarget;
};

/** V1 cap on flat nav size — forcing function, not arbitrary. See design doc §2.5. */
export const MAX_NAV_LINKS = 6;

// ---- Brand ----------------------------------------------------------------

export type VoiceToneAxis = 1 | 2 | 3 | 4 | 5;

export type VoiceTone = {
  /** formal ↔ casual */
  formality: VoiceToneAxis;
  /** calm ↔ urgent */
  urgency: VoiceToneAxis;
  /** plain ↔ technical */
  technicality: VoiceToneAxis;
};

export const VOICE_TONE_PRESETS = {
  friendlyLocal: { formality: 4, urgency: 2, technicality: 2 },
  professional: { formality: 3, urgency: 2, technicality: 3 },
  premiumTrade: { formality: 2, urgency: 2, technicality: 3 },
} as const satisfies Record<string, VoiceTone>;

export type BrandObject = {
  accentColor: string;
  /** The business's brand palette — 1–3 hex colours captured in the
   *  create-client flow. `accentColor` is always `brandColors[0]`; colours 2–3
   *  are supporting brand colours. The generator themes sections from this
   *  palette so a generated site looks on-brand. Absent on older brand data —
   *  readers fall back to `[accentColor]`. */
  brandColors?: string[];
  logoUrl: string | null;
  faviconUrl: string | null;
  voice: VoiceTone;
  audienceLine: string;
  industryCategory: string;
  topJobsToBeBooked: string[];
  /** Curated Google Font id (see lib/website/google-fonts.ts) for display
   *  headings. Absent → the platform default (Inter Tight). Optional so the
   *  field can land ahead of the brand-editing surface + a brands-table
   *  column; absence resolves to the default everywhere it is read. */
  headingFont?: string;
  /** Curated Google Font id for body copy. Absent → the platform default. */
  bodyFont?: string;
  /** Brand-level colour defaults — a section inherits these when it has not
   *  overridden the colour itself (see lib/website/section-theme.ts). Set by
   *  the operator's "apply to all", or by the AI builder when it picks a
   *  palette. Absent → the section's own hardcoded default applies. */
  headingColor?: string;
  bodyColor?: string;
  backgroundColor?: string;
};

// ---- Versions -------------------------------------------------------------

export type VersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'archived';

/** Snapshot of a website's editable content at a point in time. */
export type VersionSnapshot = {
  pages: Page[];
  header: Section;
  footer: Section;
  nav: NavLink[];
  pageOrder: string[];
};

export type Version = {
  id: string;
  websiteId: string;
  status: VersionStatus;
  snapshot: VersionSnapshot;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
  notes?: string;
  parentVersionId?: string;
};

// ---- Domain ---------------------------------------------------------------

export type DomainSSLStatus = 'pending' | 'live' | 'error';

export type WebsiteDomain = {
  primary: string;
  aliases: string[];
  sslStatus: DomainSSLStatus;
};

// ---- Website --------------------------------------------------------------

export type Website = {
  id: string;
  /** FK to AdminClient.id. Brand resolves through the client. */
  clientId: string;
  name: string;
  domain: WebsiteDomain;
  /** The current editable draft. Always populated; contains pages /
   *  header / footer / nav in its snapshot. */
  draftVersionId: string;
  /** The currently-live published version. null = never published. */
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};
