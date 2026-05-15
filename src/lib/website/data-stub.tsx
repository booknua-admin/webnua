// =============================================================================
// Stub website data — websites, header/footer/nav, version snapshots, and
// the brand store keyed by clientId.
//
// Per design doc §2.0 + §2.3: brand lives on the CLIENT, not the website.
// Both `Website` and `Funnel` (Session 7) reference brand via clientId.
// This stub holds the brand-by-client map and the website data side by
// side; when real backend lands brand moves to the Client model.
//
// Three website states demonstrate the publish lifecycle:
//
//   Voltline   → 3 pages (Home + About + Contact), partial build:
//                Services page exists but is empty (no sections enabled).
//                Published version + a draft identical to it.
//   FreshHome  → 4 pages (Home + About + Services + Contact), fully
//                published. Draft is ahead of published — hero copy edits
//                pending on the home page.
//   KeyHero    → 1 page (Home), draft only, never published. First-publish
//                state for Session 8 preflight + publish demos.
//   NeatWorks  → no website. Empty state in the agency roster.
//
// The previously-stubbed funnel-shaped pages (landing / schedule / thanks)
// were removed — that's funnel data, not website data. The existing
// `lib/funnels/client-detail.tsx` analytics-detail stub stays untouched.
// =============================================================================

import type {
  BrandObject,
  NavLink,
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
import type { ServicesData } from './sections/services';

// ---- Brand store (keyed by clientId) -------------------------------------

const BRANDS_BY_CLIENT: Record<string, BrandObject> = {
  voltline: {
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
  },
  freshhome: {
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
  },
  keyhero: {
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
  },
  neatworks: {
    accentColor: '#6b4ea6',
    logoUrl: null,
    faviconUrl: null,
    voice: { formality: 3, urgency: 2, technicality: 1 },
    audienceLine: 'Dublin landlords + property managers',
    industryCategory: 'commercial cleaning',
    topJobsToBeBooked: [
      'End-of-tenancy cleans',
      'Office cleaning contracts',
      'Common-area maintenance',
    ],
  },
};

export function getBrandForClient(clientId: string): BrandObject | null {
  return BRANDS_BY_CLIENT[clientId] ?? null;
}

/** Used by `/dev/sections` when no client context applies. */
export const DEFAULT_PREVIEW_BRAND: BrandObject = BRANDS_BY_CLIENT.voltline;

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

function emptyPage(
  id: string,
  websiteId: string,
  slug: string,
  title: string,
  type: PageType,
  createdAt: string,
): Page {
  return {
    id,
    websiteId,
    slug,
    title,
    type,
    sections: [],
    seo: {},
    createdAt,
    updatedAt: createdAt,
  };
}

// ---- Voltline website ----------------------------------------------------
// Partial-build state: Home + About + Contact populated; Services page
// exists with no sections (empty state demo).

const voltlineHomeHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// VOLTLINE · PERTH METRO',
  headline: 'Local sparkies. Honest pricing. On time, or it’s free.',
  sub: 'Licensed electricians serving Perth metro. Same-day callouts, written quotes before any work, and a 12-month workmanship guarantee.',
  ctaPrimaryLabel: 'See services',
  ctaPrimaryHref: '/services',
  ctaSecondaryLabel: 'Call us',
  ctaSecondaryHref: 'tel:0411222333',
};

const voltlineHomeServices: ServicesData = {
  ...servicesSection.defaultData(),
  title: 'What we do',
  intro: 'Fixed prices on the common stuff. Free written quote for the rest.',
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
      name: 'Power points',
      priceFrom: 'from $180',
      durationLabel: '~45 min',
      description: 'Single or double, indoor or weatherproof outdoor.',
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

const voltlineHeader: Section = mkSection('sec-vl-header', 'header', {
  // Real Fields land in Session 4. For now the placeholder Preview renders.
});

const voltlineFooter: Section = mkSection('sec-vl-footer', 'footer', {});

const voltlineNav: NavLink[] = [
  { label: 'Home', target: { kind: 'page', pageId: 'page-voltline-home' } },
  { label: 'Services', target: { kind: 'page', pageId: 'page-voltline-services' } },
  { label: 'About', target: { kind: 'page', pageId: 'page-voltline-about' } },
  { label: 'Contact', target: { kind: 'page', pageId: 'page-voltline-contact' } },
];

const voltlineHomePage: Page = {
  id: 'page-voltline-home',
  websiteId: 'website-voltline',
  slug: 'home',
  title: 'Voltline · Perth electricians',
  type: 'home',
  sections: [
    mkSection('sec-vl-home-hero', 'hero', voltlineHomeHero),
    mkSection('sec-vl-home-services', 'services', voltlineHomeServices),
    mkSection('sec-vl-home-trust', 'trust', {}),
    mkSection('sec-vl-home-cta', 'cta', {}),
  ],
  seo: {
    title: 'Voltline · Licensed Electricians · Perth',
    description: 'Same-day electrical callouts across Perth metro. Fixed pricing, written quotes, 12-month guarantee.',
  },
  createdAt: '2026-04-18T09:00:00+08:00',
  updatedAt: '2026-05-08T14:22:00+08:00',
};

const voltlineAboutPage: Page = {
  id: 'page-voltline-about',
  websiteId: 'website-voltline',
  slug: 'about',
  title: 'About us · Voltline',
  type: 'about',
  sections: [
    mkSection('sec-vl-about-hero', 'hero', {
      ...heroSection.defaultData(),
      eyebrow: '// ABOUT VOLTLINE',
      headline: 'Trained sparkies. Real receipts. Real warranties.',
      sub: 'Licensed master electricians serving Perth metro since 2018. Insured to $20M. Two-year warranty on all installs.',
      ctaPrimaryLabel: '',
      ctaSecondaryLabel: '',
      ctaPrimaryHref: '',
      ctaSecondaryHref: '',
    } satisfies HeroData),
    mkSection('sec-vl-about-trust', 'trust', {}),
  ],
  seo: { title: 'About Voltline · Perth Electricians' },
  createdAt: '2026-04-18T09:00:00+08:00',
  updatedAt: '2026-04-21T12:00:00+08:00',
};

const voltlineServicesPage: Page = emptyPage(
  'page-voltline-services',
  'website-voltline',
  'services',
  'Our services · Voltline',
  'services',
  '2026-04-18T09:00:00+08:00',
);

const voltlineContactPage: Page = {
  id: 'page-voltline-contact',
  websiteId: 'website-voltline',
  slug: 'contact',
  title: 'Contact · Voltline',
  type: 'contact',
  sections: [
    mkSection('sec-vl-contact-hero', 'hero', {
      ...heroSection.defaultData(),
      eyebrow: '// CONTACT',
      headline: 'Need a sparkie? We answer the phone.',
      sub: 'Real humans, Perth-based. SMS or call us — most days you’ll hear back within the hour.',
      ctaPrimaryLabel: 'Call 0411 222 333',
      ctaPrimaryHref: 'tel:0411222333',
      ctaSecondaryLabel: 'SMS us',
      ctaSecondaryHref: 'sms:0411222333',
    } satisfies HeroData),
  ],
  seo: { title: 'Contact Voltline · Perth Electricians' },
  createdAt: '2026-04-18T09:00:00+08:00',
  updatedAt: '2026-04-18T09:00:00+08:00',
};

const voltlinePages: Page[] = [
  voltlineHomePage,
  voltlineAboutPage,
  voltlineServicesPage,
  voltlineContactPage,
];

// ---- FreshHome website ---------------------------------------------------
// Draft ahead of published: hero copy edits pending on the home page.

const freshhomeHomeHeroPublished: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// FRESHHOME · PERTH',
  headline: 'Reliable home cleaning, fortnightly, on the same day.',
  sub: 'Vetted cleaners, fixed prices, locked in for the year. Skip a week with 24h notice — no fuss.',
  ctaPrimaryLabel: 'See pricing',
  ctaPrimaryHref: '/services',
  ctaSecondaryLabel: 'Talk to us',
  ctaSecondaryHref: '/contact',
};

const freshhomeHomeHeroDraft: HeroData = {
  ...freshhomeHomeHeroPublished,
  // Pending edit: tighter headline + new sub.
  headline: 'Same day, every fortnight. Same cleaner, every visit.',
  sub: 'Vetted cleaners, fixed pricing, same person every visit. Skip a week with 24h notice — no fuss, no fees.',
};

const freshhomeHeader: Section = mkSection('sec-fh-header', 'header', {});
const freshhomeFooter: Section = mkSection('sec-fh-footer', 'footer', {});

const freshhomeNav: NavLink[] = [
  { label: 'Home', target: { kind: 'page', pageId: 'page-freshhome-home' } },
  { label: 'Services', target: { kind: 'page', pageId: 'page-freshhome-services' } },
  { label: 'About', target: { kind: 'page', pageId: 'page-freshhome-about' } },
  { label: 'Contact', target: { kind: 'page', pageId: 'page-freshhome-contact' } },
];

function freshhomeBuildHomePage(hero: HeroData): Page {
  return {
    id: 'page-freshhome-home',
    websiteId: 'website-freshhome',
    slug: 'home',
    title: 'FreshHome · Fortnightly cleaning · Perth',
    type: 'home',
    sections: [
      mkSection('sec-fh-home-hero', 'hero', hero),
      mkSection('sec-fh-home-trust', 'trust', {}),
      mkSection('sec-fh-home-cta', 'cta', {}),
    ],
    seo: {
      title: 'FreshHome · Fortnightly Home Cleaning · Perth',
      description: 'Same-day fortnightly cleans, same cleaner every visit. From $129.',
    },
    createdAt: '2026-04-21T11:00:00+08:00',
    updatedAt: '2026-05-14T10:33:00+08:00',
  };
}

const freshhomeAboutPage: Page = {
  id: 'page-freshhome-about',
  websiteId: 'website-freshhome',
  slug: 'about',
  title: 'About FreshHome',
  type: 'about',
  sections: [
    mkSection('sec-fh-about-hero', 'hero', {
      ...heroSection.defaultData(),
      eyebrow: '// ABOUT FRESHHOME',
      headline: 'A small Perth team. Background-checked cleaners.',
      sub: 'We hire local, train hard, and keep the same cleaner on each home. Three years running, 4.9★ on Google.',
      ctaPrimaryLabel: '',
      ctaSecondaryLabel: '',
      ctaPrimaryHref: '',
      ctaSecondaryHref: '',
    } satisfies HeroData),
  ],
  seo: { title: 'About FreshHome · Perth Cleaning' },
  createdAt: '2026-04-21T11:00:00+08:00',
  updatedAt: '2026-04-21T11:00:00+08:00',
};

const freshhomeServicesPage: Page = {
  id: 'page-freshhome-services',
  websiteId: 'website-freshhome',
  slug: 'services',
  title: 'Services · FreshHome',
  type: 'services',
  sections: [
    mkSection('sec-fh-services-services', 'services', {
      ...servicesSection.defaultData(),
      title: 'Plans + pricing',
      intro: 'Pick a frequency. Same cleaner every visit. Skip free with 24h notice.',
      services: [
        {
          id: 'svc-fortnightly',
          name: 'Fortnightly · 3-bed home',
          priceFrom: '$129 / clean',
          durationLabel: '~2.5 hours',
          description: 'Kitchen + bathrooms deep cleaned. Vacuum + mop throughout.',
        },
        {
          id: 'svc-weekly',
          name: 'Weekly · 3-bed home',
          priceFrom: '$99 / clean',
          durationLabel: '~2 hours',
          description: 'Same scope as fortnightly, lighter touch each visit.',
        },
        {
          id: 'svc-eol',
          name: 'End-of-lease deep clean',
          priceFrom: 'Quoted',
          durationLabel: '4–6 hours',
          description: 'Bond-back guarantee for Perth metro homes.',
        },
      ],
    } satisfies ServicesData),
    mkSection('sec-fh-services-faq', 'faq', {}),
  ],
  seo: { title: 'Cleaning services + pricing · FreshHome' },
  createdAt: '2026-04-21T11:00:00+08:00',
  updatedAt: '2026-04-30T15:00:00+08:00',
};

const freshhomeContactPage: Page = {
  id: 'page-freshhome-contact',
  websiteId: 'website-freshhome',
  slug: 'contact',
  title: 'Contact · FreshHome',
  type: 'contact',
  sections: [
    mkSection('sec-fh-contact-hero', 'hero', {
      ...heroSection.defaultData(),
      eyebrow: '// GET IN TOUCH',
      headline: 'Quote in 24 hours. SMS is fastest.',
      sub: 'Send us a quick SMS with your suburb and home size — we’ll text back a price.',
      ctaPrimaryLabel: 'SMS 0411 444 555',
      ctaPrimaryHref: 'sms:0411444555',
      ctaSecondaryLabel: 'Email us',
      ctaSecondaryHref: 'mailto:hello@freshhome.com.au',
    } satisfies HeroData),
  ],
  seo: { title: 'Contact FreshHome' },
  createdAt: '2026-04-21T11:00:00+08:00',
  updatedAt: '2026-04-21T11:00:00+08:00',
};

const freshhomePublishedPages: Page[] = [
  freshhomeBuildHomePage(freshhomeHomeHeroPublished),
  freshhomeAboutPage,
  freshhomeServicesPage,
  freshhomeContactPage,
];

const freshhomeDraftPages: Page[] = [
  freshhomeBuildHomePage(freshhomeHomeHeroDraft),
  freshhomeAboutPage,
  freshhomeServicesPage,
  freshhomeContactPage,
];

// ---- KeyHero website -----------------------------------------------------
// Single home page, draft only, never published.

const keyheroHomeHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// KEYHERO · PERTH · 24/7',
  headline: 'Locked out? We’re 25 minutes away.',
  sub: 'Mobile locksmiths covering Perth metro. Lockouts, lock changes, car keys. Up-front pricing.',
  ctaPrimaryLabel: 'Call now',
  ctaPrimaryHref: 'tel:0411666777',
  ctaSecondaryLabel: 'Get a quote',
  ctaSecondaryHref: '/contact',
};

const keyheroHeader: Section = mkSection('sec-kh-header', 'header', {});
const keyheroFooter: Section = mkSection('sec-kh-footer', 'footer', {});

const keyheroNav: NavLink[] = [
  { label: 'Home', target: { kind: 'page', pageId: 'page-keyhero-home' } },
];

const keyheroHomePage: Page = {
  id: 'page-keyhero-home',
  websiteId: 'website-keyhero',
  slug: 'home',
  title: 'KeyHero · Perth mobile locksmith',
  type: 'home',
  sections: [
    mkSection('sec-kh-home-hero', 'hero', keyheroHomeHero),
    mkSection('sec-kh-home-cta', 'cta', {}),
  ],
  seo: {},
  createdAt: '2026-05-13T14:50:00+08:00',
  updatedAt: '2026-05-13T14:50:00+08:00',
};

// ---- Versions -------------------------------------------------------------

const stubVersions: Version[] = [
  // Voltline — published.
  {
    id: 'version-voltline-published-1',
    websiteId: 'website-voltline',
    status: 'published',
    snapshot: {
      pages: voltlinePages,
      header: voltlineHeader,
      footer: voltlineFooter,
      nav: voltlineNav,
      pageOrder: voltlinePages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-08T14:22:00+08:00',
    publishedAt: '2026-05-08T14:22:00+08:00',
    publishedBy: 'user-admin-craig',
    notes: 'Initial website publish — Home / About / Services / Contact scaffolded.',
  },
  // Voltline — draft (identical to published — no pending edits).
  {
    id: 'version-voltline-draft',
    websiteId: 'website-voltline',
    status: 'draft',
    snapshot: {
      pages: voltlinePages,
      header: voltlineHeader,
      footer: voltlineFooter,
      nav: voltlineNav,
      pageOrder: voltlinePages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-08T14:22:00+08:00',
    parentVersionId: 'version-voltline-published-1',
  },

  // FreshHome — published.
  {
    id: 'version-freshhome-published-1',
    websiteId: 'website-freshhome',
    status: 'published',
    snapshot: {
      pages: freshhomePublishedPages,
      header: freshhomeHeader,
      footer: freshhomeFooter,
      nav: freshhomeNav,
      pageOrder: freshhomePublishedPages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-02T16:11:00+08:00',
    publishedAt: '2026-05-02T16:11:00+08:00',
    publishedBy: 'user-admin-craig',
  },
  // FreshHome — draft with pending hero edits on the home page.
  {
    id: 'version-freshhome-draft',
    websiteId: 'website-freshhome',
    status: 'draft',
    snapshot: {
      pages: freshhomeDraftPages,
      header: freshhomeHeader,
      footer: freshhomeFooter,
      nav: freshhomeNav,
      pageOrder: freshhomeDraftPages.map((p) => p.id),
    },
    createdBy: 'user-admin-craig',
    createdAt: '2026-05-14T10:33:00+08:00',
    parentVersionId: 'version-freshhome-published-1',
    notes: 'Tightening home hero — "same cleaner every visit" is the wedge.',
  },

  // KeyHero — draft only.
  {
    id: 'version-keyhero-draft',
    websiteId: 'website-keyhero',
    status: 'draft',
    snapshot: {
      pages: [keyheroHomePage],
      header: keyheroHeader,
      footer: keyheroFooter,
      nav: keyheroNav,
      pageOrder: [keyheroHomePage.id],
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

export function getWebsitesForClient(clientId: string): Website[] {
  return STUB_WEBSITES.filter((w) => w.clientId === clientId);
}

export function findVersion(id: string): Version | null {
  return STUB_VERSIONS.find((v) => v.id === id) ?? null;
}

export function getDraftForWebsite(websiteId: string): Version | null {
  return (
    STUB_VERSIONS.find(
      (v) => v.websiteId === websiteId && v.status === 'draft',
    ) ?? null
  );
}

export function getPublishedForWebsite(websiteId: string): Version | null {
  return (
    STUB_VERSIONS.find(
      (v) => v.websiteId === websiteId && v.status === 'published',
    ) ?? null
  );
}
