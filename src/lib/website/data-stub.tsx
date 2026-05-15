// =============================================================================
// Stub website data — the single source of truth for the Website / Page /
// Section / Version model during the stub phase. Three clients with
// progressively-different states so later sessions can demonstrate the
// shape of the publish flow against real-looking data:
//
//   Voltline   → fully published, 3 pages (landing + schedule + thanks).
//                Draft is identical to published (no pending edits).
//   FreshHome  → published landing page + a newer draft with copy edits.
//                Demonstrates the draft-ahead-of-published state.
//   KeyHero    → just-generated draft, never published. Demonstrates the
//                first-publish state.
//
// NeatWorks intentionally has no website — demonstrates the empty state
// in the agency-mode website roster.
//
// This file is intentionally not consumed by the onboarding wizard's stub
// (`lib/onboarding/voltline-build.tsx`). That stub uses the older
// FunnelPreviewState model and is refactored onto the section registry
// in Session 7. Transient duplication is expected.
// =============================================================================

import type {
  BrandObject,
  Page,
  PageType,
  Section,
  SectionType,
  Version,
  Website,
} from './types';

import { heroSection } from './sections/hero';
import { offerSection } from './sections/offer';
import { servicesSection } from './sections/services';
import type { HeroData } from './sections/hero';
import type { OfferData } from './sections/offer';
import type { ServicesData } from './sections/services';

// ---- Brand defaults -------------------------------------------------------

const voltlineBrand: BrandObject = {
  accentColor: '#d24317',
  logoUrl: null,
  faviconUrl: null,
  voice: { formality: 4, urgency: 3, technicality: 2 },
  audienceLine: 'home owners and small businesses in Perth metro',
  industryCategory: 'electrical services',
  topJobsToBeBooked: [
    'Emergency callouts after-hours',
    'Switchboard upgrades to modern RCDs',
    'Power point installs (indoor + outdoor)',
  ],
};

const freshhomeBrand: BrandObject = {
  accentColor: '#2d7d8a',
  logoUrl: null,
  faviconUrl: null,
  voice: { formality: 3, urgency: 2, technicality: 1 },
  audienceLine: 'busy households booking recurring cleans',
  industryCategory: 'residential cleaning',
  topJobsToBeBooked: [
    'Fortnightly home cleans',
    'End-of-lease deep cleans',
    'Spring window + screen cleans',
  ],
};

const keyheroBrand: BrandObject = {
  accentColor: '#c8941e',
  logoUrl: null,
  faviconUrl: null,
  voice: { formality: 3, urgency: 4, technicality: 2 },
  audienceLine: 'drivers + homeowners locked out, mostly at the worst time',
  industryCategory: 'mobile locksmith',
  topJobsToBeBooked: [
    'Emergency lockouts (24/7)',
    'Lock changes after a move',
    'Car key cutting + programming',
  ],
};

// ---- Section helpers ------------------------------------------------------

function mkSection<TData>(
  id: string,
  type: SectionType,
  data: TData,
  enabled = true,
): Section {
  return {
    id,
    type,
    enabled,
    data: data as Record<string, unknown>,
  };
}

// ---- Voltline pages (fully built) ----------------------------------------

const voltlineHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// PERTH METRO · 24/7',
  headline: 'Sparkie at your door in under an hour. Or the callout is free.',
  sub: 'Licensed electricians covering Perth metro. Fixed $99 callout, written quote on arrival, no after-hours surcharges.',
  ctaPrimaryLabel: 'Book emergency callout',
  ctaPrimaryHref: '/schedule',
  ctaSecondaryLabel: 'Call 0411 222 333',
  ctaSecondaryHref: 'tel:0411222333',
};

const voltlineOffer: OfferData = {
  ...offerSection.defaultData(),
  tag: '// THE OFFER',
  title: '$99 callout, on-site in under 60 minutes — or your callout is free.',
  priceLabel: '$99',
  priceCaption: 'Fixed call-out fee · 24/7',
  includedText: [
    'Sparkie on-site within 60 min, Perth metro',
    'Written repair quote before any work',
    'No surcharges — nights, weekends, holidays included',
    '12-month workmanship guarantee on every job',
  ].join('\n'),
  scarcityCopy: 'Limited to 5 emergency slots per day.',
  ctaLabel: 'Book my callout',
  ctaHref: '/schedule',
};

const voltlineServices: ServicesData = {
  ...servicesSection.defaultData(),
  title: 'What we fix',
  intro: 'Fixed prices on the common stuff. Free quote for the rest.',
  services: [
    {
      id: 'svc-switchboard',
      name: 'Switchboard upgrades',
      priceFrom: 'from $1,250',
      durationLabel: '2–3 hours',
      description: 'Old fuses to modern RCDs. Inspection report included.',
    },
    {
      id: 'svc-powerpoints',
      name: 'Power point installs',
      priceFrom: 'from $180',
      durationLabel: '~45 min',
      description: 'Single or double, indoor or weatherproof outdoor.',
    },
    {
      id: 'svc-hotwater',
      name: 'Hot water diagnostics',
      priceFrom: 'Quoted',
      durationLabel: '~1 hour',
      description: 'Find why it tripped and quote a fix on the spot.',
    },
    {
      id: 'svc-ev',
      name: 'EV charger installs',
      priceFrom: 'from $1,890',
      durationLabel: '3–4 hours',
      description: 'Tesla / Type 2 wall chargers wired through your switchboard.',
    },
  ],
};

const voltlinePages: Page[] = [
  {
    id: 'page-voltline-landing',
    websiteId: 'website-voltline',
    slug: 'home',
    title: '$99 emergency callout · Voltline',
    type: 'landing' as PageType,
    sections: [
      mkSection('sec-vl-hero', 'hero', voltlineHero),
      mkSection('sec-vl-offer', 'offer', voltlineOffer),
      mkSection('sec-vl-trust', 'trust', {}),
      mkSection('sec-vl-services', 'services', voltlineServices),
      mkSection('sec-vl-reviews', 'reviews', {}),
      mkSection('sec-vl-faq', 'faq', {}),
      mkSection('sec-vl-cta', 'cta', {}),
    ],
    seo: {
      title: '$99 Emergency Electrician · Voltline · Perth',
      description: 'Licensed sparkies in Perth metro. $99 callout, 60-min response, no surcharges.',
    },
    createdAt: '2026-04-18T09:00:00+08:00',
    updatedAt: '2026-05-08T14:22:00+08:00',
  },
  {
    id: 'page-voltline-schedule',
    websiteId: 'website-voltline',
    slug: 'schedule',
    title: 'Book a callout · Voltline',
    type: 'schedule' as PageType,
    sections: [
      mkSection('sec-vl-sched-hero', 'hero', {
        ...heroSection.defaultData(),
        eyebrow: '// BOOK YOUR CALLOUT',
        headline: 'Pick a time. We confirm by SMS in 10 minutes.',
        sub: 'Pick a 1-hour window. Your sparkie sends a confirmation SMS within 10 minutes of booking.',
        ctaPrimaryLabel: '',
        ctaSecondaryLabel: '',
        ctaPrimaryHref: '',
        ctaSecondaryHref: '',
      } satisfies HeroData),
      mkSection('sec-vl-sched-picker', 'schedulePicker', {}),
      mkSection('sec-vl-sched-trust', 'trust', {}),
    ],
    seo: {
      title: 'Book your sparkie · Voltline',
      description: 'Pick a 1-hour window for your $99 emergency electrical callout.',
    },
    createdAt: '2026-04-18T09:00:00+08:00',
    updatedAt: '2026-04-18T09:00:00+08:00',
  },
  {
    id: 'page-voltline-thanks',
    websiteId: 'website-voltline',
    slug: 'thanks',
    title: 'Booking confirmed · Voltline',
    type: 'thanks' as PageType,
    sections: [
      mkSection('sec-vl-thx-confirm', 'thanksConfirmation', {}),
      mkSection('sec-vl-thx-cta', 'cta', {}),
    ],
    seo: {
      title: 'Booking confirmed · Voltline',
    },
    createdAt: '2026-04-18T09:00:00+08:00',
    updatedAt: '2026-04-18T09:00:00+08:00',
  },
];

// ---- FreshHome pages (draft ahead of published) --------------------------

const freshhomeLandingPublishedHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// PERTH NORTHERN SUBURBS',
  headline: 'Reliable home cleaning, on the same day every fortnight.',
  sub: 'Vetted cleaners, fixed prices, locked in for the year. Skip a week with 24h notice — no fuss.',
  ctaPrimaryLabel: 'See pricing',
  ctaPrimaryHref: '/schedule',
  ctaSecondaryLabel: 'Talk to us',
  ctaSecondaryHref: 'tel:0411444555',
};

const freshhomeLandingDraftHero: HeroData = {
  ...freshhomeLandingPublishedHero,
  // Pending edit: tighter headline + new sub.
  headline: 'Same-day, every fortnight. Same cleaner, every visit.',
  sub: 'Vetted cleaners, fixed pricing, same person every visit. Skip a week with 24h notice — no fuss, no fees.',
};

const freshhomeOffer: OfferData = {
  ...offerSection.defaultData(),
  tag: '// FORTNIGHTLY HOMES',
  title: 'Fortnightly 3-bed clean from $129.',
  priceLabel: '$129',
  priceCaption: 'per fortnightly clean · 3-bed',
  includedText: [
    'Same cleaner every visit',
    'Kitchen + bathrooms deep clean',
    'Vacuum + mop throughout',
    'Skip weeks free with 24h notice',
  ].join('\n'),
  scarcityCopy: '',
  ctaLabel: 'See full pricing',
  ctaHref: '/schedule',
};

const freshhomePublishedPage: Page = {
  id: 'page-freshhome-landing',
  websiteId: 'website-freshhome',
  slug: 'home',
  title: 'Fortnightly home cleaning · FreshHome',
  type: 'landing' as PageType,
  sections: [
    mkSection('sec-fh-hero', 'hero', freshhomeLandingPublishedHero),
    mkSection('sec-fh-offer', 'offer', freshhomeOffer),
    mkSection('sec-fh-services', 'services', servicesSection.defaultData()),
    mkSection('sec-fh-reviews', 'reviews', {}),
    mkSection('sec-fh-cta', 'cta', {}),
  ],
  seo: {
    title: 'Fortnightly Home Cleaning · FreshHome · Perth',
    description: 'Same-day fortnightly cleans, same cleaner every visit. From $129.',
  },
  createdAt: '2026-04-21T11:00:00+08:00',
  updatedAt: '2026-05-02T16:11:00+08:00',
};

const freshhomeDraftPage: Page = {
  ...freshhomePublishedPage,
  sections: [
    mkSection('sec-fh-hero', 'hero', freshhomeLandingDraftHero, true),
    ...freshhomePublishedPage.sections.slice(1),
  ],
  updatedAt: '2026-05-14T10:33:00+08:00',
};

// ---- KeyHero pages (just generated, never published) ---------------------

const keyheroLandingHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// PERTH · MOBILE · 24/7',
  headline: "Locked out? We're 25 minutes away.",
  sub: 'Mobile locksmiths covering Perth metro. Lockouts, lock changes, car keys. Up-front pricing.',
  ctaPrimaryLabel: 'Call now',
  ctaPrimaryHref: 'tel:0411666777',
  ctaSecondaryLabel: 'Get a quote',
  ctaSecondaryHref: '/schedule',
};

const keyheroLandingPage: Page = {
  id: 'page-keyhero-landing',
  websiteId: 'website-keyhero',
  slug: 'home',
  title: 'Mobile locksmith · KeyHero',
  type: 'landing' as PageType,
  sections: [
    mkSection('sec-kh-hero', 'hero', keyheroLandingHero),
    mkSection('sec-kh-offer', 'offer', offerSection.defaultData()),
    mkSection('sec-kh-services', 'services', servicesSection.defaultData()),
    mkSection('sec-kh-cta', 'cta', {}),
  ],
  seo: {},
  createdAt: '2026-05-13T14:50:00+08:00',
  updatedAt: '2026-05-13T14:50:00+08:00',
};

// ---- Versions -------------------------------------------------------------

const stubVersions: Version[] = [
  // Voltline — published version (the live site).
  {
    id: 'version-voltline-published-1',
    websiteId: 'website-voltline',
    status: 'published',
    snapshot: {
      pages: voltlinePages,
      brand: voltlineBrand,
      pageOrder: voltlinePages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-08T14:22:00+08:00',
    publishedAt: '2026-05-08T14:22:00+08:00',
    publishedBy: 'user-admin-craig',
    notes: 'Tightened the hero copy after Mark fed back from the first week.',
  },
  // Voltline — current draft (same content as published — no pending edits).
  {
    id: 'version-voltline-draft',
    websiteId: 'website-voltline',
    status: 'draft',
    snapshot: {
      pages: voltlinePages,
      brand: voltlineBrand,
      pageOrder: voltlinePages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-08T14:22:00+08:00',
    parentVersionId: 'version-voltline-published-1',
  },

  // FreshHome — published version.
  {
    id: 'version-freshhome-published-1',
    websiteId: 'website-freshhome',
    status: 'published',
    snapshot: {
      pages: [freshhomePublishedPage],
      brand: freshhomeBrand,
      pageOrder: [freshhomePublishedPage.id],
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-02T16:11:00+08:00',
    publishedAt: '2026-05-02T16:11:00+08:00',
    publishedBy: 'user-admin-craig',
  },
  // FreshHome — current draft with pending hero edits.
  {
    id: 'version-freshhome-draft',
    websiteId: 'website-freshhome',
    status: 'draft',
    snapshot: {
      pages: [freshhomeDraftPage],
      brand: freshhomeBrand,
      pageOrder: [freshhomeDraftPage.id],
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-14T10:33:00+08:00',
    parentVersionId: 'version-freshhome-published-1',
    notes: 'Tightening hero copy — "same cleaner every visit" is the wedge.',
  },

  // KeyHero — draft only (never published).
  {
    id: 'version-keyhero-draft',
    websiteId: 'website-keyhero',
    status: 'draft',
    snapshot: {
      pages: [keyheroLandingPage],
      brand: keyheroBrand,
      pageOrder: [keyheroLandingPage.id],
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-13T14:50:00+08:00',
  },
];

// ---- Websites -------------------------------------------------------------

const stubWebsites: Website[] = [
  {
    id: 'website-voltline',
    clientId: 'voltline',
    name: 'Voltline',
    domain: {
      primary: 'voltline.webnua.app',
      aliases: [],
      sslStatus: 'live',
    },
    brand: voltlineBrand,
    pageOrder: voltlinePages.map((p) => p.id),
    draftVersionId: 'version-voltline-draft',
    publishedVersionId: 'version-voltline-published-1',
    createdAt: '2026-04-18T09:00:00+08:00',
    updatedAt: '2026-05-08T14:22:00+08:00',
  },
  {
    id: 'website-freshhome',
    clientId: 'freshhome',
    name: 'FreshHome',
    domain: {
      primary: 'freshhome.webnua.app',
      aliases: [],
      sslStatus: 'live',
    },
    brand: freshhomeBrand,
    pageOrder: [freshhomePublishedPage.id],
    draftVersionId: 'version-freshhome-draft',
    publishedVersionId: 'version-freshhome-published-1',
    createdAt: '2026-04-21T11:00:00+08:00',
    updatedAt: '2026-05-14T10:33:00+08:00',
  },
  {
    id: 'website-keyhero',
    clientId: 'keyhero',
    name: 'KeyHero',
    domain: {
      primary: 'keyhero.webnua.app',
      aliases: [],
      sslStatus: 'pending',
    },
    brand: keyheroBrand,
    pageOrder: [keyheroLandingPage.id],
    draftVersionId: 'version-keyhero-draft',
    publishedVersionId: null,
    createdAt: '2026-05-13T14:50:00+08:00',
    updatedAt: '2026-05-13T14:50:00+08:00',
  },
];

// ---- Public accessors -----------------------------------------------------

export const STUB_WEBSITES: readonly Website[] = stubWebsites;
export const STUB_VERSIONS: readonly Version[] = stubVersions;

export function findWebsite(id: string): Website | null {
  return STUB_WEBSITES.find((w) => w.id === id) ?? null;
}

export function findWebsiteByClient(clientId: string): Website | null {
  return STUB_WEBSITES.find((w) => w.clientId === clientId) ?? null;
}

/** Every website belonging to the given client. V1 returns 0–1 entries;
 *  signature is plural for forward-compat with multi-website clients. */
export function getWebsitesForClient(clientId: string): Website[] {
  return STUB_WEBSITES.filter((w) => w.clientId === clientId);
}

export function findVersion(id: string): Version | null {
  return STUB_VERSIONS.find((v) => v.id === id) ?? null;
}

export function getDraftForWebsite(websiteId: string): Version | null {
  return STUB_VERSIONS.find(
    (v) => v.websiteId === websiteId && v.status === 'draft',
  ) ?? null;
}

export function getPublishedForWebsite(websiteId: string): Version | null {
  return STUB_VERSIONS.find(
    (v) => v.websiteId === websiteId && v.status === 'published',
  ) ?? null;
}

/** Default brand used by /dev/sections when no website context applies. */
export const DEFAULT_PREVIEW_BRAND: BrandObject = voltlineBrand;
