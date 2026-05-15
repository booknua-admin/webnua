// =============================================================================
// Preflight rule engine (design doc §7) — declarative rules that read a
// VersionSnapshot and return per-rule results. Hard-fail rules block
// publish; warnings allow publish with confirmation. The result list is
// the data behind the review surface (Screen 43-equivalent).
//
// Rules are pure functions over a snapshot — no I/O. Integration prerequisites
// (GBP for reviews section, calendar for schedule pages) are flagged in the
// design but deferred until the integrations data layer can answer "is this
// integration connected for this client?" — when that lands, add a separate
// integration-aware rule set that the run() call composes onto the basic set.
//
// Each rule produces zero-or-more results so a single rule can flag multiple
// pages (e.g. "SEO title missing" yields one result per page that's missing it).
// Each result carries a target (`pageId` / `sectionId`) when the offending
// content is per-page or per-section, so the review surface can deep-link to
// the right editor.
// =============================================================================

import type { CTAData } from './sections/cta';
import type { FAQData } from './sections/faq';
import type { FooterData } from './sections/footer';
import type { HeaderData } from './sections/header';
import type { HeroData } from './sections/hero';
import type { OfferData } from './sections/offer';
import type { ReviewsData } from './sections/reviews';
import type { TrustData } from './sections/trust';
import type { Page, Section, VersionSnapshot } from './types';

// ---- Result + rule types --------------------------------------------------

export type PreflightStatus = 'pass' | 'warn' | 'fail';

export type PreflightResult = {
  ruleId: string;
  status: PreflightStatus;
  title: string;
  message: string;
  /** Page the result belongs to, if any. Drives the per-page card grouping. */
  pageId?: string;
  /** Section inside the page, if any. Drives the section deep-link affordance. */
  sectionId?: string;
  /** Deep-link to where the user can fix the issue (e.g. an editor route). */
  fixHref?: string;
};

export type PreflightRule = {
  id: string;
  title: string;
  /** A rule may produce zero (silent pass), one, or many results — one per
   *  affected page / section. The review surface keeps every result so the
   *  user can see "Home is fine but Services is missing a SEO description." */
  run(snapshot: VersionSnapshot, context: PreflightContext): PreflightResult[];
};

export type PreflightContext = {
  websiteId: string;
};

// ---- Section-data helpers -------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function nonEmpty(v: unknown): boolean {
  return isString(v) && v.trim().length > 0;
}

function pageEditorHref(websiteId: string, pageId: string): string {
  return `/website/${pageId}`;
}

function enabledSectionsByType<T extends Section['type']>(
  page: Page,
  type: T,
): Section[] {
  return page.sections.filter((s) => s.enabled && s.type === type);
}

// ---- Rules ----------------------------------------------------------------

const seoTitleRule: PreflightRule = {
  id: 'seo-title',
  title: 'Every page has an SEO title',
  run(snapshot, { websiteId }) {
    return snapshot.pages.flatMap((page): PreflightResult[] => {
      if (nonEmpty(page.seo.title)) return [];
      return [
        {
          ruleId: 'seo-title',
          status: 'fail',
          title: 'SEO title missing',
          message: `${page.title || page.slug} doesn't have an SEO title set. Search engines will use a fallback that you don't control.`,
          pageId: page.id,
          fixHref: pageEditorHref(websiteId, page.id),
        },
      ];
    });
  },
};

const seoDescriptionRule: PreflightRule = {
  id: 'seo-description',
  title: 'Pages have an SEO description',
  run(snapshot, { websiteId }) {
    return snapshot.pages.flatMap((page): PreflightResult[] => {
      if (nonEmpty(page.seo.description)) return [];
      return [
        {
          ruleId: 'seo-description',
          status: 'warn',
          title: 'SEO description missing',
          message: `${page.title || page.slug} has no description meta. Search engines will auto-summarise — clarity drops.`,
          pageId: page.id,
          fixHref: pageEditorHref(websiteId, page.id),
        },
      ];
    });
  },
};

const heroContentRule: PreflightRule = {
  id: 'hero-content',
  title: 'Hero sections have a headline',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'hero')) {
        const data = section.data as Partial<HeroData>;
        if (!nonEmpty(data.headline)) {
          results.push({
            ruleId: 'hero-content',
            status: 'fail',
            title: 'Hero missing headline',
            message: `Hero section on ${page.title || page.slug} has no headline. The page leads with empty space.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const heroCtaRule: PreflightRule = {
  id: 'hero-cta',
  title: 'Hero sections have a primary CTA',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'hero')) {
        const data = section.data as Partial<HeroData>;
        const hasCta = nonEmpty(data.ctaPrimaryLabel) && nonEmpty(data.ctaPrimaryHref);
        if (!hasCta) {
          results.push({
            ruleId: 'hero-cta',
            status: 'warn',
            title: 'Hero missing primary CTA',
            message: `Hero on ${page.title || page.slug} has no primary CTA. Visitors don't know where to go next.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const offerContentRule: PreflightRule = {
  id: 'offer-content',
  title: 'Offer sections have a title + price',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'offer')) {
        const data = section.data as Partial<OfferData>;
        const missing: string[] = [];
        if (!nonEmpty(data.title)) missing.push('title');
        if (!nonEmpty(data.priceLabel)) missing.push('price label');
        if (missing.length > 0) {
          results.push({
            ruleId: 'offer-content',
            status: 'fail',
            title: 'Offer missing required content',
            message: `Offer section on ${page.title || page.slug} is missing ${missing.join(' + ')}.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const ctaSectionRule: PreflightRule = {
  id: 'cta-content',
  title: 'CTA sections have a headline + button',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'cta')) {
        const data = section.data as Partial<CTAData>;
        const missing: string[] = [];
        if (!nonEmpty(data.headline)) missing.push('headline');
        if (!nonEmpty(data.ctaLabel)) missing.push('button label');
        if (missing.length > 0) {
          results.push({
            ruleId: 'cta-content',
            status: 'fail',
            title: 'CTA section incomplete',
            message: `CTA section on ${page.title || page.slug} is missing ${missing.join(' + ')}.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const trustEvidenceRule: PreflightRule = {
  id: 'trust-evidence',
  title: 'Trust sections carry at least one trust signal',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'trust')) {
        const data = section.data as Partial<TrustData>;
        const signals = [
          data.ratingValue,
          data.yearsLabel,
          data.licenceLabel,
          data.guaranteeLabel,
        ].filter(nonEmpty);
        if (signals.length === 0) {
          results.push({
            ruleId: 'trust-evidence',
            status: 'warn',
            title: 'Trust section is empty',
            message: `Trust section on ${page.title || page.slug} has no rating, years, licence, or guarantee filled in.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const reviewsPopulatedRule: PreflightRule = {
  id: 'reviews-populated',
  title: 'Reviews sections have at least one review',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'reviews')) {
        const data = section.data as Partial<ReviewsData>;
        const reviews = data.reviews ?? [];
        if (reviews.length === 0) {
          results.push({
            ruleId: 'reviews-populated',
            status: 'warn',
            title: 'Reviews section is empty',
            message: `Reviews section on ${page.title || page.slug} has no reviews. When Google Business Profile is wired up this auto-pulls; until then add at least one manually.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const faqPopulatedRule: PreflightRule = {
  id: 'faq-populated',
  title: 'FAQ sections have at least one entry',
  run(snapshot, { websiteId }) {
    const results: PreflightResult[] = [];
    for (const page of snapshot.pages) {
      for (const section of enabledSectionsByType(page, 'faq')) {
        const data = section.data as Partial<FAQData>;
        const items = data.items ?? [];
        if (items.length === 0) {
          results.push({
            ruleId: 'faq-populated',
            status: 'warn',
            title: 'FAQ section is empty',
            message: `FAQ section on ${page.title || page.slug} has no questions. Either disable the section or add at least one Q/A.`,
            pageId: page.id,
            sectionId: section.id,
            fixHref: pageEditorHref(websiteId, page.id),
          });
        }
      }
    }
    return results;
  },
};

const pageHasSectionsRule: PreflightRule = {
  id: 'page-has-sections',
  title: 'Every page has at least one enabled section',
  run(snapshot, { websiteId }) {
    return snapshot.pages.flatMap((page): PreflightResult[] => {
      const enabledCount = page.sections.filter((s) => s.enabled).length;
      if (enabledCount > 0) return [];
      return [
        {
          ruleId: 'page-has-sections',
          status: 'fail',
          title: 'Page has no enabled sections',
          message: `${page.title || page.slug} would publish as a blank page. Either disable the page or add a section.`,
          pageId: page.id,
          fixHref: pageEditorHref(websiteId, page.id),
        },
      ];
    });
  },
};

const headerLogoRule: PreflightRule = {
  id: 'header-logo',
  title: 'Header has a logo',
  run(snapshot) {
    const data = snapshot.header.data as Partial<HeaderData>;
    if (nonEmpty(data.logoText) || nonEmpty(data.logoImageUrl)) return [];
    return [
      {
        ruleId: 'header-logo',
        status: 'warn',
        title: 'Header has no logo',
        message: 'Header has neither logo text nor logo image. Visitors will see a blank top bar.',
        sectionId: snapshot.header.id,
        fixHref: '/website/header',
      },
    ];
  },
};

const footerContactRule: PreflightRule = {
  id: 'footer-contact',
  title: 'Footer carries at least one contact channel',
  run(snapshot) {
    const data = snapshot.footer.data as Partial<FooterData>;
    if (nonEmpty(data.contactPhone) || nonEmpty(data.contactEmail)) return [];
    return [
      {
        ruleId: 'footer-contact',
        status: 'warn',
        title: 'Footer has no contact info',
        message: 'Footer needs at least a phone or email — local business pages without contact channels rank poorly.',
        sectionId: snapshot.footer.id,
        fixHref: '/website/footer',
      },
    ];
  },
};

const navTargetsRule: PreflightRule = {
  id: 'nav-targets',
  title: 'Nav links point at real pages',
  run(snapshot) {
    const pageIds = new Set(snapshot.pages.map((p) => p.id));
    const results: PreflightResult[] = [];
    for (const link of snapshot.nav) {
      if (link.target.kind === 'page' && !pageIds.has(link.target.pageId)) {
        results.push({
          ruleId: 'nav-targets',
          status: 'fail',
          title: 'Nav link points to a missing page',
          message: `Nav entry "${link.label}" targets a page that no longer exists on this website.`,
          fixHref: '/website/header',
        });
      }
    }
    return results;
  },
};

// ---- Runner ---------------------------------------------------------------

export const PREFLIGHT_RULES: readonly PreflightRule[] = [
  pageHasSectionsRule,
  seoTitleRule,
  seoDescriptionRule,
  heroContentRule,
  heroCtaRule,
  offerContentRule,
  ctaSectionRule,
  trustEvidenceRule,
  reviewsPopulatedRule,
  faqPopulatedRule,
  headerLogoRule,
  footerContactRule,
  navTargetsRule,
];

export type PreflightReport = {
  results: PreflightResult[];
  counts: Record<PreflightStatus, number>;
  /** True when there are no `fail`-status results. Publish is allowed. */
  canPublish: boolean;
  /** True when there are no fails AND no warnings. Eligible for "all clear". */
  allClear: boolean;
};

export function runPreflight(
  snapshot: VersionSnapshot,
  context: PreflightContext,
): PreflightReport {
  const results = PREFLIGHT_RULES.flatMap((r) => r.run(snapshot, context));
  const counts: Record<PreflightStatus, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
  };
  for (const r of results) counts[r.status]++;
  // Rules that emitted zero results count as silent passes — surface as
  // "N rules passed" so the user sees the green count.
  const passingRules = PREFLIGHT_RULES.filter(
    (rule) => results.every((r) => r.ruleId !== rule.id),
  ).length;
  counts.pass = passingRules;
  return {
    results,
    counts,
    canPublish: counts.fail === 0,
    allClear: counts.fail === 0 && counts.warn === 0,
  };
}

/** Group the result list by page (with an `__site` bucket for site-wide
 *  rules like header / footer / nav). Used by the review surface to render
 *  per-page review cards. */
export function groupResultsByPage(
  results: PreflightResult[],
): Record<string, PreflightResult[]> {
  const grouped: Record<string, PreflightResult[]> = {};
  for (const r of results) {
    const key = r.pageId ?? '__site';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return grouped;
}
