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
  /** Server-safe static snapshot of the section's `defaultData()` output.
   *  Section modules are `'use client'`, so server consumers (currently the
   *  `fillHeaderSection` / `fillFooterSection` helpers reached from the
   *  `/api/generate-site` route) cannot call `defaultData()` on the section
   *  exports — they become client-reference stubs in the server bundle.
   *  Populate this for any section a server-reachable code path needs to
   *  read defaults from. Use stable string ids for any item arrays — they
   *  are scoped to a single rendered section, so collisions across
   *  generated sites are harmless. */
  defaultDataValues?: Readonly<Record<string, unknown>>;
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
    'heroImageDisplay',
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
    'imageDisplay',
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
    // `featuredIndex` is an editorial choice (which item is the focal one),
    // not a layout knob — surfaced on the items element-inspector.
    copyFields: [
      'eyebrow', 'headline', 'headlineAccent', 'sub',
      'ctaLabel', 'ctaHref', 'items', 'featuredIndex',
    ],
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
    // C2b-3 — item-array asymmetry primitive. `null` = uniform grid;
    // 0..items.length-1 = the index of the featured (larger) item.
    'featuredIndex',
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
    'About / why-choose-us block — copy beside an image (split), or a vertical narrative with chapters and an optional pull-quote (story-arc).',
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
      // C2b-3 — V2 story-arc fields are editorial copy.
      'chapters',
      'pullQuote',
    ],
    mediaFields: ['imageUrl', 'imageUrl2', 'imageUrl3'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Intro paragraph',
    extra: 'Extra block',
    overlay: 'Overlay card',
    // C2b-3 — V2 story-arc elements.
    chapters: 'Chapters',
    pullQuote: 'Pull-quote',
  },
  defaultDataKeys: [
    'theme',
    // C2b-3 — top-level layout switch. `split` (default) = the existing
    // 2-column copy+media layout; `story-arc` = V2 vertical narrative.
    'layout',
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
    'imageDisplay',
    'imageDisplay2',
    'imageDisplay3',
    'overlay',
    'badgeIcon',
    'badgeValue',
    'badgeLabel',
    'badgeQuote',
    // C2b-3 — V2 story-arc narrative fields. `chapters` is an array of
    // { id, heading, body }; `pullQuote` is an optional middle pull-quote.
    'chapters',
    'pullQuote',
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
    'spotlightImageDisplay',
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
    'imageDisplay',
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
    'Contact block — header, contact details, and a CTA that opens a lead-capture popup (or an inline form, your call).',
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'items',
      'ctaLabel',
      'ctaHref',
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
    cta: 'Call-to-action',
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
    // Default-CTA mode (C1): a single primary CTA that opens the popup
    // form modal. `showInlineForm` flips the section back to the legacy
    // two-column "details + inline form" layout when the operator wants
    // it. The popup uses the platform-standard `Section.popup` envelope
    // + `PopupHost` modal — no contact-specific modal component.
    'showInlineForm',
    'ctaLabel',
    'ctaHref',
    'formTitle',
    'formButtonLabel',
    'showPhoneField',
    'imageUrl',
    'mapImageUrl',
    'imageDisplay',
    'mapImageDisplay',
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
  // Server-side consumers (the funnel generation route's thanks-step
  // builder) read defaults from here — section modules are 'use client'
  // and become client-reference stubs in the server bundle. Same pattern
  // as headerMeta / footerMeta. Mirror of the DEFAULTS const in
  // sections/thanksConfirmation.tsx.
  defaultDataValues: {
    theme: {},
    icon: 'check',
    title: "You're booked.",
    body: "We'll SMS to confirm within 10 minutes.",
    detailLine: "Look for a text from a local number — that's us.",
    showReferral: true,
    referralTag: 'REFER + EARN',
    referralTitle: 'Know someone who needs us?',
    referralBody:
      'Refer a friend — they get $25 off their first job, you get $25 credit on your next.',
    referralCtaLabel: 'Send a referral',
    referralCtaHref: '/refer',
  },
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
    'overlayHero',
    'sticky',
    'navColor',
  ],
  defaultDataValues: {
    theme: {},
    layout: 'logo-left',
    logoText: 'Your Business',
    logoTagline: '',
    logoImageUrl: '',
    showCta: true,
    ctaLabel: 'Get a quote',
    ctaHref: '/contact',
    ctaStyle: 'solid',
    overlayHero: false,
    sticky: false,
    navColor: '',
  },
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
  defaultDataValues: {
    theme: {},
    logoText: 'Your Business',
    logoImageUrl: '',
    brandLine: 'Quality service you can count on.',
    socials: [
      { id: 'soc-fb', network: 'facebook', href: '#' },
      { id: 'soc-ig', network: 'instagram', href: '#' },
      { id: 'soc-li', network: 'linkedin', href: '#' },
    ],
    columns: [
      {
        id: 'col-services',
        heading: 'Services',
        links: [
          { id: 'lnk-services-1', label: 'Overview', href: '#' },
          { id: 'lnk-services-2', label: 'Pricing', href: '#' },
          { id: 'lnk-services-3', label: 'Book a job', href: '#' },
          { id: 'lnk-services-4', label: 'Service areas', href: '#' },
        ],
      },
      {
        id: 'col-company',
        heading: 'Company',
        links: [
          { id: 'lnk-company-1', label: 'About us', href: '#' },
          { id: 'lnk-company-2', label: 'Our work', href: '#' },
          { id: 'lnk-company-3', label: 'Reviews', href: '#' },
          { id: 'lnk-company-4', label: 'Careers', href: '#' },
        ],
      },
      {
        id: 'col-resources',
        heading: 'Resources',
        links: [
          { id: 'lnk-resources-1', label: 'FAQs', href: '#' },
          { id: 'lnk-resources-2', label: 'Guides', href: '#' },
          { id: 'lnk-resources-3', label: 'Contact', href: '#' },
          { id: 'lnk-resources-4', label: 'Blog', href: '#' },
        ],
      },
    ],
    showContact: true,
    contactHeading: 'Contact us',
    contactAddress: '123 Main Street, Anytown',
    contactPhone: '(555) 123-4567',
    contactEmail: 'hello@example.com',
    rightBlock: 'newsletter',
    newsletterTitle: 'Stay in the loop',
    newsletterText: 'Subscribe for tips, ideas, and exclusive offers.',
    ctaIcon: 'message',
    ctaTitle: "Let's build something great",
    ctaText: 'Have a project in mind? Let’s talk about how we can help.',
    ctaLabel: 'Get a free quote',
    ctaHref: '/contact',
    legalText: '© 2026 Your Business. All rights reserved.',
    legalLinks: [
      { id: 'leg-privacy', label: 'Privacy Policy', href: '#' },
      { id: 'leg-terms', label: 'Terms of Service', href: '#' },
      { id: 'leg-sitemap', label: 'Sitemap', href: '#' },
    ],
  },
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
