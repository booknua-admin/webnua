// =============================================================================
// page-starters — curated starter pages for the website builder.
//
// These are builder-facing templates: intentional section stacks with seeded
// copy + layout variants that an operator can drop straight into the editor
// without going through AI generation first.
// =============================================================================

import { applyCtaDefaults } from './cta-defaults';
import { defaultPopupConfig, POPUP_HREF } from './popup-config';
import { getSectionDefinition } from './sections';
import type { BrandObject, Page, PageType, Section, SectionType } from './types';

export type PageStarterId =
  | 'emergency-callout'
  | 'service-menu'
  | 'founder-story'
  | 'proof-process'
  | 'quick-quote'
  | 'visit-contact'
  | 'offer-landing'
  | 'portfolio-showcase';

export type PageStarter = {
  id: PageStarterId;
  pageType: PageType;
  label: string;
  description: string;
  title: string;
  sections: readonly StarterSection[];
};

type StarterSection = {
  type: SectionType;
  patch?: Record<string, unknown>;
  popup?: boolean;
};

const STARTERS: readonly PageStarter[] = [
  {
    id: 'emergency-callout',
    pageType: 'services',
    label: 'Emergency Callout',
    description: 'Fast-response service page with proof, jobs list, and a hard CTA.',
    title: 'Emergency',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'overlay',
          eyebrow: 'FAST RESPONSE',
          headline: 'Need help today?',
          sub: 'Lead with the urgent problem, the response promise, and the next step.',
          ctaPrimaryLabel: 'Call now',
          ctaSecondaryLabel: 'Get a quote',
        },
      },
      {
        type: 'trust',
        patch: {
          display: 'compact-icons',
          headline: 'Why people call first',
          sub: 'Use this row for the fast trust signals that calm a stressed customer.',
          showBadges: true,
        },
      },
      {
        type: 'services',
        patch: {
          title: 'Common jobs we handle',
          intro: 'Turn this into the short menu of urgent fixes and fast-win jobs.',
        },
      },
      {
        type: 'reviews',
        patch: {
          layout: 'grid',
          headline: 'What customers say after the job',
          sub: 'Swap in real reviews that reduce the last-minute trust gap.',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'background',
          eyebrow: 'READY TO BOOK?',
          headline: 'Make the next step obvious.',
          sub: 'Repeat the promise, remove friction, and give the customer one clean action.',
          primaryLabel: 'Call now',
          secondaryLabel: 'Request a quote',
        },
      },
    ],
  },
  {
    id: 'service-menu',
    pageType: 'services',
    label: 'Service Menu',
    description: 'Calmer services page with a menu, showcase grid, offer, and close CTA.',
    title: 'Services',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'split',
          eyebrow: 'OUR SERVICES',
          headline: 'Clear offers. No guesswork.',
          sub: 'Frame the category of work, who it is for, and why customers trust you with it.',
          ctaPrimaryLabel: 'Get a quote',
          ctaSecondaryLabel: 'See pricing',
        },
      },
      {
        type: 'features',
        patch: {
          layout: 'cards',
          headline: 'What we’re known for',
          sub: 'Use this as the high-level showcase before the service menu below.',
          ctaLabel: 'Talk to us',
        },
      },
      {
        type: 'offer',
        patch: {
          layout: 'card',
          tag: 'POPULAR OPTION',
          title: 'Lead with the clearest offer',
          sub: 'Use one strong package, fixed-price visit, or lead offer here.',
          ctaLabel: 'Request this service',
        },
      },
      {
        type: 'services',
        patch: {
          title: 'Service menu',
          intro: 'List the most common jobs, typical price anchors, and any time expectations.',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'split',
          eyebrow: 'NEED HELP DECIDING?',
          headline: 'End with the easy next step.',
          sub: 'Invite the visitor to ask a question, request a quote, or book the right service.',
          primaryLabel: 'Get a quote',
          secondaryLabel: 'Ask a question',
        },
      },
    ],
  },
  {
    id: 'founder-story',
    pageType: 'about',
    label: 'Founder Story',
    description: 'Narrative about page with story-arc layout, proof strip, and social proof.',
    title: 'About',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'minimal',
          eyebrow: 'OUR STORY',
          headline: 'Tell people why you do this.',
          sub: 'Use the page opening to set tone, values, and what kind of business this is.',
          ctaPrimaryLabel: 'Work with us',
          ctaSecondaryVisible: false,
        },
      },
      {
        type: 'about',
        patch: {
          layout: 'story-arc',
          eyebrow: 'HOW WE WORK',
          headline: 'A business with a point of view.',
          sub: 'Write the opening paragraph like a real story, not a corporate bio.',
          pullQuote: 'Add one short line that captures the belief behind the business.',
        },
      },
      {
        type: 'trust',
        patch: {
          display: 'stats',
          headline: 'The proof behind the story',
          sub: 'Add the facts that make the story credible.',
        },
      },
      {
        type: 'reviews',
        patch: {
          layout: 'spotlight',
          headline: 'What it feels like to work with us',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'centered',
          eyebrow: 'LET’S TALK',
          headline: 'Bring the story back to action.',
          primaryLabel: 'Get in touch',
          secondaryVisible: false,
        },
      },
    ],
  },
  {
    id: 'proof-process',
    pageType: 'about',
    label: 'Proof & Process',
    description: 'Credentials-led about page focused on process, trust, and structured proof.',
    title: 'Why Us',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'split',
          eyebrow: 'WHY CHOOSE US',
          headline: 'Show how you work, not just what you say.',
          sub: 'Use this page to explain your process, standards, and what customers can expect.',
          ctaPrimaryLabel: 'Start a project',
        },
      },
      {
        type: 'about',
        patch: {
          layout: 'split',
          extra: 'features',
          headline: 'A practical, reliable process',
        },
      },
      {
        type: 'trust',
        patch: {
          display: 'compact-icons',
          headline: 'The reasons customers trust the work',
          showBadges: true,
        },
      },
      {
        type: 'features',
        patch: {
          layout: 'numbered',
          headline: 'What working with us looks like',
          sub: 'Turn this into the simple step-by-step process from first contact to finished job.',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'centered',
          eyebrow: 'NEXT STEP',
          headline: 'Give them a confident next move.',
          primaryLabel: 'Request a quote',
          secondaryLabel: 'Talk to us',
        },
      },
    ],
  },
  {
    id: 'quick-quote',
    pageType: 'contact',
    label: 'Quick Quote Popup',
    description: 'Minimal contact page with a single strong CTA that opens a popup form.',
    title: 'Contact',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'minimal',
          eyebrow: 'GET IN TOUCH',
          headline: 'Make asking easy.',
          sub: 'Use this opener to tell visitors how fast you respond and what to send you.',
          ctaPrimaryLabel: 'Get a quote',
          ctaSecondaryVisible: false,
        },
      },
      {
        type: 'contact',
        popup: true,
        patch: {
          layout: 'minimal-cta',
          eyebrow: 'SEND US A MESSAGE',
          headline: 'One clean action. No clutter.',
          sub: 'Use the popup for the quote form and keep the page itself simple.',
          ctaLabel: 'Open quote form',
          ctaHref: POPUP_HREF,
        },
      },
      {
        type: 'faq',
      },
    ],
  },
  {
    id: 'visit-contact',
    pageType: 'contact',
    label: 'Visit & Contact',
    description: 'Contact page centered on address, hours, map image, and direct details.',
    title: 'Visit Us',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'split',
          eyebrow: 'CONTACT',
          headline: 'Put the practical details first.',
          sub: 'This version works best when visitors want to find, call, or visit you directly.',
          ctaPrimaryLabel: 'Call now',
          ctaSecondaryLabel: 'Send a message',
        },
      },
      {
        type: 'contact',
        popup: true,
        patch: {
          layout: 'map',
          headline: 'How to reach us',
          sub: 'Fill in the direct contact details, service area, opening hours, and optional popup form.',
        },
      },
      {
        type: 'trust',
        patch: {
          display: 'logos',
          headline: 'Signals that reduce hesitation',
          sub: 'Use this band for accreditations, guarantees, and recognisable proof.',
        },
      },
    ],
  },
  {
    id: 'offer-landing',
    pageType: 'generic',
    label: 'Offer Landing',
    description: 'Focused landing page for one offer, one promise, and one primary CTA.',
    title: 'Offer',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'overlay',
          eyebrow: 'LIMITED OFFER',
          headline: 'Lead with the offer.',
          sub: 'This page should feel focused, specific, and built around one conversion action.',
          ctaPrimaryLabel: 'Claim this offer',
          ctaSecondaryVisible: false,
        },
      },
      {
        type: 'offer',
        patch: {
          layout: 'card',
          tag: 'WHAT’S INCLUDED',
          title: 'Spell out the offer clearly',
          ctaLabel: 'Get this offer',
        },
      },
      {
        type: 'trust',
        patch: {
          display: 'stats',
          headline: 'Why this feels safe',
        },
      },
      {
        type: 'reviews',
        patch: {
          layout: 'grid',
          headline: 'Use social proof to remove doubt',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'background',
          eyebrow: 'READY?',
          headline: 'Repeat the offer one last time.',
          primaryLabel: 'Claim this offer',
          secondaryVisible: false,
        },
      },
    ],
  },
  {
    id: 'portfolio-showcase',
    pageType: 'generic',
    label: 'Portfolio Showcase',
    description: 'Light landing page for showing work examples, proof, and an inquiry CTA.',
    title: 'Portfolio',
    sections: [
      {
        type: 'hero',
        patch: {
          layout: 'split',
          eyebrow: 'RECENT WORK',
          headline: 'Show the standard of the work.',
          sub: 'Use this page to highlight examples, visual proof, and the kind of jobs you want more of.',
          ctaPrimaryLabel: 'Ask about your project',
          ctaSecondaryLabel: 'See our work',
        },
      },
      {
        type: 'features',
        patch: {
          layout: 'cards',
          mediaStyle: 'image',
          headline: 'What clients come to us for',
          sub: 'Turn this into a gallery of capabilities, categories, or job types.',
        },
      },
      {
        type: 'reviews',
        patch: {
          layout: 'spotlight',
          headline: 'Back the visuals with real outcomes',
        },
      },
      {
        type: 'cta',
        patch: {
          layout: 'split',
          eyebrow: 'START YOUR PROJECT',
          headline: 'End with the enquiry CTA.',
          primaryLabel: 'Ask about your project',
          secondaryLabel: 'Request a quote',
        },
      },
    ],
  },
] as const;

export function getPageStarters(pageType: PageType): PageStarter[] {
  return STARTERS.filter((starter) => starter.pageType === pageType);
}

export function getPageStarter(starterId: PageStarterId): PageStarter | null {
  return STARTERS.find((starter) => starter.id === starterId) ?? null;
}

export function buildStarterPage(args: {
  websiteId: string;
  starterId: PageStarterId;
  existingPages: readonly Page[];
  brand: BrandObject;
}): Page {
  const starter = getPageStarter(args.starterId);
  if (!starter) {
    throw new Error(`Unknown page starter: ${args.starterId}`);
  }

  const now = new Date().toISOString();
  const title = dedupeTitle(starter.title, args.existingPages);
  const slug = dedupeSlug(slugify(title), args.existingPages);
  const sections = starter.sections.map((section) =>
    instantiateSection(section, args.brand, args.existingPages),
  );

  return {
    id: `page-${rid()}`,
    websiteId: args.websiteId,
    slug,
    title,
    type: starter.pageType,
    sections,
    seo: {},
    createdAt: now,
    updatedAt: now,
  };
}

function instantiateSection(
  config: StarterSection,
  brand: BrandObject,
  existingPages: readonly Page[],
): Section {
  const def = getSectionDefinition(config.type);
  if (!def) throw new Error(`Unknown section type: ${config.type}`);
  const baseData = def.defaultData() as Record<string, unknown>;
  let section: Section = {
    id: `sec-${rid()}`,
    type: config.type,
    enabled: true,
    data: {
      ...baseData,
      ...materializePatch(config.patch ?? {}, brand),
    } as Record<string, unknown>,
  };
  if (config.popup || sectionNeedsPopup(section)) {
    section.popup = defaultPopupConfig();
  }
  section = applyCtaDefaults(section, existingPages);
  return section;
}

function materializePatch(
  patch: Record<string, unknown>,
  brand: BrandObject,
): Record<string, unknown> {
  const trade = firstTrade(brand);
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? value
            .replaceAll('{trade}', trade)
            .replaceAll('{Trade}', titleCase(trade))
        : value,
    ]),
  );
}

function sectionNeedsPopup(section: Section): boolean {
  return (
    section.type === 'contact' &&
    typeof section.data.ctaHref === 'string' &&
    section.data.ctaHref === POPUP_HREF
  );
}

function firstTrade(brand: BrandObject): string {
  return (
    brand.topJobsToBeBooked.find((job) => job.trim().length > 0) ??
    brand.industryCategory ??
    'service'
  );
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'page'
  );
}

function dedupeTitle(base: string, existingPages: readonly Page[]): string {
  const existing = new Set(existingPages.map((page) => page.title.trim().toLowerCase()));
  if (!existing.has(base.trim().toLowerCase())) return base;
  let n = 2;
  while (existing.has(`${base.trim().toLowerCase()} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function dedupeSlug(base: string, existingPages: readonly Page[]): string {
  const existing = new Set(existingPages.map((page) => page.slug.trim().toLowerCase()));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function rid(): string {
  return Math.random().toString(36).slice(2, 9);
}
