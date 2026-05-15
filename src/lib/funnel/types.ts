// =============================================================================
// Funnel data model — shape-only this session.
//
// See reference/builder-design.md §2.0 + §2.1. Funnels are independent
// artefacts from Websites: linear conversion sequences with their own
// analytics, no shared chrome, one per offer / campaign. A business can
// have many funnels.
//
// Types defined here lock the shape for Session 7's funnel-step editor.
// No stub data, no routes, no UI references this session — genuinely
// just types. The wizard refactor (Session 7) will populate these and
// wire `/funnels/[id]/edit` against them.
//
// **Naming note** (CLAUDE.md "Open decisions"): `lib/funnel/` (this dir,
// singular) is the editable build model. `lib/funnels/` (plural, Cluster
// 4) holds the analytics/detail types for the existing `/funnels/[id]`
// view — different concern, different shape. The overlap is intentional
// for V1; the dirs disambiguate.
// =============================================================================

import type { Section, WebsiteDomain } from '@/lib/website/types';

/** Funnel-specific step kinds. Distinct from `PageType` in
 *  `lib/website/types.ts` — funnel steps and website pages aren't
 *  interchangeable (a funnel's landing page is not a website's home
 *  page; see design doc §2.0). */
export type FunnelStepType =
  | 'landing'
  | 'schedule'
  | 'thanks'
  | 'optin'
  | 'upsell';

export type FunnelStepSEO = {
  title?: string;
  description?: string;
  ogImageUrl?: string;
};

export type FunnelStep = {
  id: string;
  funnelId: string;
  slug: string;
  title: string;
  type: FunnelStepType;
  sections: Section[];
  seo: FunnelStepSEO;
  createdAt: string;
  updatedAt: string;
};

export type FunnelVersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'archived';

export type FunnelVersionSnapshot = {
  steps: FunnelStep[];
  stepOrder: string[];
};

export type FunnelVersion = {
  id: string;
  funnelId: string;
  status: FunnelVersionStatus;
  snapshot: FunnelVersionSnapshot;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
  notes?: string;
  parentVersionId?: string;
};

export type Funnel = {
  id: string;
  /** FK to AdminClient.id. Brand resolves through the client (same brand
   *  the client's Website uses). */
  clientId: string;
  /** Funnel name, e.g. "$99 emergency callout · Voltline". */
  name: string;
  /** Funnel-specific domain (usually a subdomain or the website's
   *  primary). */
  domain: WebsiteDomain;
  draftVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};
