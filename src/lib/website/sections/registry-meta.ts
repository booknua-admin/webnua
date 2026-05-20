// =============================================================================
// registry-meta — server-safe section metadata SSOT.
//
// Why this file exists: every section module under `sections/*.tsx` is
// marked `'use client'` because it ships React components (Fields, Preview)
// that use hooks. Next.js + the React Server Components bundler replaces
// every export of a 'use client' module with a `registerClientReference`
// stub on the server side. That made the server-side reads of
// `SECTION_REGISTRY` (in `generation-prompt.ts` and `generation-stub.ts`)
// crash with `TypeError: Cannot read properties of undefined (reading
// 'includes')` — the stub functions had no `allowedContainers`.
//
// This module is **not** `'use client'`, imports only types and pure data,
// and is the single source of truth for the metadata server-side consumers
// need. Section modules `import { heroMeta } from './registry-meta'` and
// spread it into their `defineSection({ ...heroMeta, defaultData, Fields,
// Preview })` call — so the data lives here exactly once.
//
// Adding a new section type: add an entry below AND in `./index.ts`'s
// `SECTION_REGISTRY` array. Do not duplicate metadata between this file
// and the section's .tsx file — section files MUST spread their entry.
// =============================================================================

import type { ContainerKind, PageType, SectionType } from '../types';

/** Section metadata — every field a server-side consumer needs. Mirrors the
 *  shape of `SectionTypeDefinition` minus the runtime `defaultData` factory
 *  and the React `Fields` / `Preview` components, which live in the section
 *  module (and are client-only). */
export type SectionMeta = {
  type: SectionType;
  /** Eyebrow-style label rendered in section pickers, e.g. "// HERO". */
  label: string;
  /** Short description shown in the "Add section" menu. Also surfaced to
   *  the LLM in the generation prompt's registry catalog. */
  description: string;
  /** Where this section type can be placed (design doc §2.2). */
  allowedContainers: readonly ContainerKind[];
  /** Page/step types this section is allowed on. Omit / empty = all. */
  allowedPageTypes?: readonly (PageType | string)[];
  /** False for section types whose Fields/Preview are still placeholders. */
  implemented: boolean;
  /** Capability hints — which fields are pure-copy vs media. Drives the
   *  per-field capability gating inside the editor. */
  capabilityHints?: {
    copyFields?: readonly string[];
    mediaFields?: readonly string[];
  };
  /** Human labels for the section's selectable preview elements, keyed by
   *  element id (element-inspector model). The fields panel reads this to
   *  title the inspector when an element is selected. */
  elementLabels?: Record<string, string>;
  /** Field keys the section's `data` Record uses. Server-safe stand-in for
   *  `Object.keys(defaultData())` — the prompt builder uses this to tell
   *  the LLM what fields each section type expects, and the validation
   *  pipeline uses it to detect missing fields. Kept in sync with the
   *  section's DEFAULTS by convention; if a field is added in the section
   *  file, add it here too. */
  defaultDataKeys: readonly string[];
};

// -- Stackable sections (page + funnelStep) --------------------------------

export const heroMeta: SectionMeta = {
  type: 'hero',
  label: '// HERO',
  description: 'Above-the-fold lead — eyebrow, two-line headline, sub, two CTAs, image.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'ctaPrimaryLabel',
      'ctaPrimaryHref',
      'ctaSecondaryLabel',
      'ctaSecondaryHref',
    ],
    mediaFields: ['heroImageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    ctaPrimary: 'Primary button',
    ctaSecondary: 'Secondary button',
  },
  defaultDataKeys: [
    'layout',
    'theme',
    'imageSide',
    'overlayOpacity',
    'contentAlign',
    'eyebrow',
    'headline',
    'headlineAccent',
    'headlineSize',
    'sub',
    'subSize',
    'ctaPrimaryLabel',
    'ctaPrimaryHref',
    'ctaPrimaryVisible',
    'ctaSecondaryLabel',
    'ctaSecondaryHref',
    'ctaSecondaryVisible',
    'heroImageUrl',
  ],
};

export const offerMeta: SectionMeta = {
  type: 'offer',
  label: '// OFFER',
  description:
    'Offer block — a single-offer card (price, inclusions, scarcity) or a value stack of components.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'tag',
      'title',
      'titleAccent',
      'sub',
      'priceLabel',
      'priceCaption',
      'inclusions',
      'scarcityCopy',
      'items',
      'signals',
      'ctaLabel',
      'ctaHref',
    ],
    mediaFields: ['imageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    price: 'Price',
    inclusions: 'Inclusions',
    scarcity: 'Scarcity line',
    media: 'Image',
    items: 'Value items',
    signals: 'Trust signals',
    cta: 'Button',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'headerAlign',
    'headlineSize',
    'showHeadlineRule',
    'tag',
    'title',
    'titleAccent',
    'sub',
    'priceLabel',
    'priceCaption',
    'inclusions',
    'scarcityCopy',
    'imageUrl',
    'items',
    'stackStyle',
    'columns',
    'showNumbers',
    'showSignals',
    'signals',
    'ctaVisible',
    'ctaLabel',
    'ctaHref',
  ],
};

export const trustMeta: SectionMeta = {
  type: 'trust',
  label: '// TRUST',
  description:
    'Social-proof band — a row of trust stats or client logos, optional badge strip.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: ['eyebrow', 'headline', 'headlineAccent', 'sub', 'items', 'badges'],
    mediaFields: ['items'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Trust items',
    badges: 'Badge strip',
  },
  defaultDataKeys: [
    'theme',
    'display',
    'columns',
    'headerAlign',
    'showDividers',
    'showHeadlineRule',
    'headlineSize',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'items',
    'showBadges',
    'badges',
  ],
};

export const featuresMeta: SectionMeta = {
  type: 'features',
  label: '// FEATURES',
  description:
    'Icon / image grid showcase — header band over N item cards, optional CTA.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: ['eyebrow', 'headline', 'headlineAccent', 'sub', 'ctaLabel', 'ctaHref', 'items'],
    mediaFields: ['items'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Service items',
    cta: 'Button',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'mediaStyle',
    'iconStyle',
    'columns',
    'headerAlign',
    'showDividers',
    'showItemLinks',
    'showHeadlineRule',
    'headlineSize',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'ctaVisible',
    'ctaStyle',
    'ctaLabel',
    'ctaHref',
    'items',
  ],
};

export const servicesMeta: SectionMeta = {
  type: 'services',
  label: '// SERVICES',
  description: 'Deprecated — superseded by the Features section.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: false,
  capabilityHints: {
    copyFields: ['title', 'intro', 'services'],
  },
  defaultDataKeys: ['title', 'intro', 'services'],
};

export const aboutMeta: SectionMeta = {
  type: 'about',
  label: '// ABOUT',
  description:
    'About / why-choose-us block — copy beside an image, with feature list, stats, signoff, or button.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'features',
      'stats',
      'noteText',
      'buttonLabel',
      'buttonHref',
      'badgeValue',
      'badgeLabel',
      'badgeQuote',
    ],
    mediaFields: ['imageUrl', 'imageUrl2', 'imageUrl3'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Intro paragraph',
    extra: 'Extra block',
    overlay: 'Overlay card',
  },
  defaultDataKeys: [
    'theme',
    'imageSide',
    'headlineSize',
    'showHeadlineRule',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'extra',
    'features',
    'stats',
    'noteText',
    'buttonLabel',
    'buttonHref',
    'mediaMode',
    'mediaShape',
    'imageUrl',
    'imageUrl2',
    'imageUrl3',
    'overlay',
    'badgeIcon',
    'badgeValue',
    'badgeLabel',
    'badgeQuote',
  ],
};

export const galleryMeta: SectionMeta = {
  type: 'gallery',
  label: '// GALLERY',
  description:
    'Project / photo gallery — uniform auto-cropped grid or masonry, with filter chips.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'categories',
      'items',
      'ctaLabel',
      'ctaHref',
    ],
    mediaFields: ['items'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    filters: 'Filter chips',
    items: 'Photos',
    cta: 'Button',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'columns',
    'aspect',
    'headerAlign',
    'headlineSize',
    'showHeadlineRule',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'showFilters',
    'categories',
    'items',
    'showCaptions',
    'ctaVisible',
    'ctaStyle',
    'ctaLabel',
    'ctaHref',
  ],
};

export const reviewsMeta: SectionMeta = {
  type: 'reviews',
  label: '// REVIEWS',
  description:
    'Customer testimonials — a grid of review cards or a spotlight layout, optional rating summary.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'items',
      'ratingValue',
      'ratingCount',
      'ctaLabel',
      'ctaHref',
    ],
    mediaFields: ['items', 'spotlightImageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Reviews',
    rating: 'Rating summary',
    cta: 'Button',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'columns',
    'headerAlign',
    'headlineSize',
    'showHeadlineRule',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'items',
    'showRatingSummary',
    'ratingStars',
    'ratingValue',
    'ratingCount',
    'nav',
    'ctaVisible',
    'ctaStyle',
    'ctaLabel',
    'ctaHref',
    'spotlightImageUrl',
  ],
};

export const faqMeta: SectionMeta = {
  type: 'faq',
  label: '// FAQ',
  description:
    'Question / answer accordion — centred, grid, or sidebar layout, with an optional footer block.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'items',
      'footerText',
      'footerLinkLabel',
      'footerLinkHref',
      'footerCardTitle',
      'footerCardText',
      'signals',
    ],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Questions',
    footer: 'Footer block',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'columns',
    'headerAlign',
    'headlineSize',
    'showHeadlineRule',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'items',
    'footer',
    'footerText',
    'footerLinkLabel',
    'footerLinkHref',
    'footerCardIcon',
    'footerCardTitle',
    'footerCardText',
    'signals',
  ],
};

export const ctaMeta: SectionMeta = {
  type: 'cta',
  label: '// CTA',
  description:
    'Call-to-action block — centered, split-image, background-image, or dual-panel layouts.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'primaryLabel',
      'primaryHref',
      'secondaryLabel',
      'secondaryHref',
      'signals',
      'panelA',
      'panelB',
      'dualDivider',
    ],
    mediaFields: ['imageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    primaryCta: 'Primary button',
    secondaryCta: 'Secondary button',
    signals: 'Trust signals',
    panelA: 'Left panel',
    panelB: 'Right panel',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'align',
    'headlineSize',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'primaryVisible',
    'primaryLabel',
    'primaryHref',
    'secondaryVisible',
    'secondaryLabel',
    'secondaryHref',
    'showSignals',
    'signals',
    'imageUrl',
    'imageSide',
    'overlayOpacity',
    'panelA',
    'panelB',
    'dualDivider',
  ],
};

export const contactMeta: SectionMeta = {
  type: 'contact',
  label: '// CONTACT',
  description:
    'Contact block — header, contact details, and a message form, in four layouts.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'items',
      'formTitle',
      'formButtonLabel',
    ],
    mediaFields: ['imageUrl', 'mapImageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Contact details',
    form: 'Message form',
    media: 'Image / map',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'headerAlign',
    'headlineSize',
    'showHeadlineRule',
    'eyebrow',
    'headline',
    'headlineAccent',
    'sub',
    'items',
    'formTitle',
    'formButtonLabel',
    'showPhoneField',
    'imageUrl',
    'mapImageUrl',
  ],
};

export const formMeta: SectionMeta = {
  type: 'form',
  label: '// FORM',
  description:
    'A lead-capture form — collects enquiries straight into the leads inbox.',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: ['eyebrow', 'heading'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    heading: 'Heading',
  },
  defaultDataKeys: ['theme', 'eyebrow', 'heading'],
};

// -- Funnel-only stackable sections ----------------------------------------

export const schedulePickerMeta: SectionMeta = {
  type: 'schedulePicker',
  label: '// SCHEDULE PICKER',
  description: 'Calendar-integrated booking picker (mockup — booking system lands later).',
  allowedContainers: ['funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: ['eyebrow', 'title', 'intro', 'durationLabel', 'earliestSlotLabel'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Title',
    subheadline: 'Intro',
  },
  defaultDataKeys: ['theme', 'eyebrow', 'title', 'intro', 'durationLabel', 'earliestSlotLabel'],
};

export const thanksConfirmationMeta: SectionMeta = {
  type: 'thanksConfirmation',
  label: '// THANKS',
  description: 'Funnel thanks-step confirmation — success icon, copy, optional referral block.',
  allowedContainers: ['funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'title',
      'body',
      'detailLine',
      'referralTag',
      'referralTitle',
      'referralBody',
      'referralCtaLabel',
      'referralCtaHref',
    ],
  },
  elementLabels: {
    icon: 'Success icon',
    headline: 'Title',
    body: 'Body copy',
    referral: 'Referral block',
  },
  defaultDataKeys: [
    'theme',
    'icon',
    'title',
    'body',
    'detailLine',
    'showReferral',
    'referralTag',
    'referralTitle',
    'referralBody',
    'referralCtaLabel',
    'referralCtaHref',
  ],
};

// -- Website-level singletons ----------------------------------------------

export const headerMeta: SectionMeta = {
  type: 'header',
  label: '// HEADER',
  description: 'Site header — logo, navigation, and an optional CTA. Wraps every page.',
  allowedContainers: ['websiteHeader'],
  implemented: true,
  capabilityHints: {
    copyFields: ['logoText', 'logoTagline', 'ctaLabel', 'ctaHref'],
    mediaFields: ['logoImageUrl'],
  },
  elementLabels: {
    logo: 'Logo',
    cta: 'CTA button',
  },
  defaultDataKeys: [
    'theme',
    'layout',
    'logoText',
    'logoTagline',
    'logoImageUrl',
    'showCta',
    'ctaLabel',
    'ctaHref',
    'ctaStyle',
  ],
};

export const footerMeta: SectionMeta = {
  type: 'footer',
  label: '// FOOTER',
  description:
    'Site footer — brand block, link columns, contact details, newsletter / CTA, copyright bar.',
  allowedContainers: ['websiteFooter'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'logoText',
      'brandLine',
      'socials',
      'columns',
      'contactHeading',
      'contactAddress',
      'contactPhone',
      'contactEmail',
      'newsletterTitle',
      'newsletterText',
      'ctaTitle',
      'ctaText',
      'ctaLabel',
      'ctaHref',
      'legalText',
      'legalLinks',
    ],
    mediaFields: ['logoImageUrl'],
  },
  elementLabels: {
    brand: 'Brand block',
    columns: 'Link columns',
    contact: 'Contact block',
    right: 'Side block',
    legal: 'Copyright bar',
  },
  defaultDataKeys: [
    'theme',
    'logoText',
    'logoImageUrl',
    'brandLine',
    'socials',
    'columns',
    'showContact',
    'contactHeading',
    'contactAddress',
    'contactPhone',
    'contactEmail',
    'rightBlock',
    'newsletterTitle',
    'newsletterText',
    'ctaIcon',
    'ctaTitle',
    'ctaText',
    'ctaLabel',
    'ctaHref',
    'legalText',
    'legalLinks',
  ],
};

// -- The registry array -----------------------------------------------------

/** Server-safe metadata for every registered section type. Order matches
 *  `SECTION_REGISTRY` in `./index.ts`. The two arrays MUST stay aligned —
 *  if you add a section type, add it in both places (lint will not catch
 *  the misalignment, but the server consumers will read this array and
 *  the editor will read the other). */
export const SECTION_REGISTRY_META: readonly SectionMeta[] = [
  // Stackable on pages and funnel steps
  heroMeta,
  offerMeta,
  trustMeta,
  featuresMeta,
  servicesMeta,
  aboutMeta,
  galleryMeta,
  reviewsMeta,
  faqMeta,
  ctaMeta,
  contactMeta,
  formMeta,
  // Funnel-only stackable
  schedulePickerMeta,
  thanksConfirmationMeta,
  // Website-level singletons
  headerMeta,
  footerMeta,
];

export function getSectionMeta(type: SectionType): SectionMeta | undefined {
  return SECTION_REGISTRY_META.find((m) => m.type === type);
}
