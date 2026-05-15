// =============================================================================
// Website data model — the shape every later session builds against.
//
// See reference/builder-design.md §2 for the rationale. The headline shapes:
//
//   Website { id, clientId, brand, pages[], domain, draftVersionId,
//             publishedVersionId | null }
//   Page    { id, websiteId, slug, title, type, sections[], seo }
//   Section { id, type: SectionType, enabled, data, ai? }
//   Version { id, websiteId, status, snapshot, createdBy/At, ... }
//
// Single-shape versioning: drafts and published versions share the Version
// type, distinguished by `status`. The current draft is referenced by
// Website.draftVersionId; the live one by Website.publishedVersionId.
//
// Section.data is intentionally Record<string, unknown> at the registry
// boundary. Each section type's actual data shape is exported from its
// own module (e.g. HeroData from sections/hero.tsx) and asserted at the
// Fields/Preview component boundary. defaultData() factories keep runtime
// shape correct.
// =============================================================================

// ---- Section types --------------------------------------------------------

export type SectionType =
  | 'hero'
  | 'offer'
  | 'trust'
  | 'services'
  | 'reviews'
  | 'faq'
  | 'cta'
  | 'schedulePicker'
  | 'thanksConfirmation';

export type SectionAIMeta = {
  /** Field keys whose current value was AI-drafted. */
  draftedFields: string[];
  /** ISO 8601 timestamp of the last regeneration. */
  lastRegenAt?: string;
};

export type Section = {
  id: string;
  type: SectionType;
  enabled: boolean;
  /** Section-type-specific data. Typed per-type via the section registry. */
  data: Record<string, unknown>;
  ai?: SectionAIMeta;
};

// ---- Pages ----------------------------------------------------------------

export type PageType = 'landing' | 'schedule' | 'thanks' | 'generic';

export type PageSEO = {
  title?: string;
  description?: string;
  ogImageUrl?: string;
};

export type Page = {
  id: string;
  websiteId: string;
  slug: string;
  title: string;
  type: PageType;
  sections: Section[];
  seo: PageSEO;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
};

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

/** Three named presets that map to fixed VoiceTone triples. Stored value is
 *  always the triple; preset is just a UI affordance (see design doc §2.3). */
export const VOICE_TONE_PRESETS = {
  friendlyLocal: { formality: 4, urgency: 2, technicality: 2 },
  professional: { formality: 3, urgency: 2, technicality: 3 },
  premiumTrade: { formality: 2, urgency: 2, technicality: 3 },
} as const satisfies Record<string, VoiceTone>;

export type BrandObject = {
  /** Hex string, e.g. "#d24317". Drives accent color in section previews. */
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  voice: VoiceTone;
  /** One-line description of the audience, e.g. "tradies in Perth's outer
   *  suburbs". Prepended to every AI generation prompt. */
  audienceLine: string;
  industryCategory: string;
  /** 3–5 short phrases pulled from services menu. Prepended to AI prompts. */
  topJobsToBeBooked: string[];
};

// ---- Versions -------------------------------------------------------------

export type VersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'archived';

export type VersionSnapshot = {
  pages: Page[];
  brand: BrandObject;
  pageOrder: string[];
};

export type Version = {
  id: string;
  websiteId: string;
  status: VersionStatus;
  snapshot: VersionSnapshot;
  /** User id of the actor. */
  createdBy: string;
  /** ISO 8601. */
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
  /** Optional human note ("Fixed phone number" / "Q3 offer refresh" etc). */
  notes?: string;
  /** When this version branched from a prior published version. */
  parentVersionId?: string;
};

// ---- Domain ---------------------------------------------------------------

export type DomainSSLStatus = 'pending' | 'live' | 'error';

export type WebsiteDomain = {
  /** e.g. "voltline.webnua.app" (V1 subdomain) or "voltline.com.au" (V2). */
  primary: string;
  aliases: string[];
  sslStatus: DomainSSLStatus;
};

// ---- Website (top-level) --------------------------------------------------

export type Website = {
  id: string;
  /** FK to AdminClient.id (lib/nav/admin-clients.ts). */
  clientId: string;
  /** Display name for the website (typically the client business name). */
  name: string;
  domain: WebsiteDomain;
  brand: BrandObject;
  /** Page ids in nav order. */
  pageOrder: string[];
  /** The current editable draft. Always populated. */
  draftVersionId: string;
  /** The currently-live published version. null = never published. */
  publishedVersionId: string | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
};
