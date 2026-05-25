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
import type { PopupConfig } from './popup-config';

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
  | 'schedulePicker' // funnel-only
  | 'thanksConfirmation' // funnel-only
  // Website-level singletons — never in a page's sections[]
  | 'header'
  | 'footer';

/** Where a section type can be placed. The registry constraint that
 *  enforces singletons vs stackables — see design doc §2.2. */
export type ContainerKind =
  | 'page' // Section is added to a Page.sections[]
  | 'funnelStep' // Section is added to a FunnelStep.sections[]
  | 'websiteHeader' // Section IS Website.header (singleton)
  | 'websiteFooter'; // Section IS Website.footer (singleton)

/** Verbatim snapshot of one AI-drafted review item, captured at generation
 *  time. Only the text fields a human would edit are stored — the detection
 *  in `lib/website/placeholder-testimonials.ts` compares a live review item
 *  against these to decide whether it is still an untouched AI placeholder. */
export type PlaceholderReviewSnapshot = {
  quote: string;
  authorName: string;
  authorRole: string;
};

export type SectionAIMeta = {
  draftedFields: string[];
  lastRegenAt?: string;
  /** Verbatim snapshot of AI-drafted placeholder content, captured when the
   *  section was generated. Today only `reviews` sections populate it (the
   *  AI-invented testimonials). A live review item that still EXACTLY matches
   *  a snapshot entry is treated as an unedited placeholder; the moment the
   *  operator changes the text it counts as a real review. Exact-content
   *  comparison (not a dirty flag) means changes to the AI generator never
   *  break detection — the snapshot is whatever was generated for THIS
   *  section. See `lib/website/placeholder-testimonials.ts`. */
  placeholderSnapshot?: { reviews?: PlaceholderReviewSnapshot[] };
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
  /** Optional popup/modal a button in this section can open instead of
   *  navigating (see lib/website/popup-config.ts). Envelope-level for the
   *  same reason as `form`. */
  popup?: PopupConfig;
};

// ---- Pages ----------------------------------------------------------------

/** Website page types (NOT funnel step types — those live in lib/funnel). */
export type PageType = 'home' | 'about' | 'services' | 'contact' | 'generic';

/** A navigable destination on the site — a `{ label, href }` pair. Fed to the
 *  CTA / redirect pickers so a link is chosen from real pages, not typed. */
export type PageLink = { label: string; href: string };

export type PageSEO = {
  title?: string;
  description?: string;
  ogImageUrl?: string;
};

export type Page = {
  id: string;
  websiteId: string;
  slug: string; // 'home' | 'about' | 'services' | 'contact'
  title: string;
  type: PageType;
  sections: Section[];
  seo: PageSEO;
  createdAt: string;
  updatedAt: string;
};

// ---- Navigation -----------------------------------------------------------

/** Internal page link OR external href. */
export type NavLinkTarget = { kind: 'page'; pageId: string } | { kind: 'href'; href: string };

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
  /** Design bundle id (Bundle C2b-1). One of the closed set in
   *  lib/website/design-bundles.ts. Absent → resolve via industry default
   *  (lib/website/industry-bundle-defaults.ts). SectionShell reads this
   *  and injects bundle CSS custom properties on the section root. */
  designBundleId?: string;
  /** Cached derived colour palette (Bundle C2b-1). The shape is
   *  `DerivedPalette` from lib/website/color-derivation.ts — kept as
   *  unknown here so types.ts doesn't pull color-derivation into every
   *  consumer; readers narrow via `isDerivedPalette`. Absent → readers
   *  re-derive from accentColor at render time. */
  derivedPalette?: unknown;
  /** Brand-level offer (Session C.5). The four-field offer is the single
   *  source of truth that propagates to website hero CTA, the dedicated
   *  offer section, and the funnel hero (as a fallback when no per-funnel
   *  override is set). Stored on `brands.offer` jsonb in snake_case;
   *  surfaced here in camelCase. Absent / null → no brand-level offer; the
   *  funnel falls back to its own `funnel_offer` (if any), the website
   *  sections render their own static copy. */
  offer?: BrandOffer | null;
};

/** The brand-level offer. Same four fields as `FunnelOffer` from
 *  lib/website/offer-generate.ts (which is the browser-side caller
 *  type — kept separate so types.ts has no dependency on the offer
 *  generator's module). Equivalent shape; both are camelCase at the
 *  TS boundary, snake_case at the DB boundary. */
export type BrandOffer = {
  headline: string;
  promise: string;
  riskReversal: string;
  ctaText: string;
};

// ---- Versions -------------------------------------------------------------

export type VersionStatus = 'draft' | 'pending_approval' | 'published' | 'archived';

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
