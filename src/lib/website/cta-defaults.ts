// =============================================================================
// Smart CTA defaults — when a section is added, point its call-to-action at a
// sensible destination based on the pages the site actually has (a contact
// page if there is one, an about page for a secondary "learn more" action).
//
// It is only a starting point: the operator can repoint any CTA through the
// link picker (LinkField). Sections without a contact/about page to point at
// keep their built-in defaults.
// =============================================================================

import type { Page, PageType, Section } from './types';

/** The public href of the first page of a given type, or null. */
function pageHref(pages: readonly Page[], type: PageType): string | null {
  const page = pages.find((p) => p.type === type);
  if (!page) return null;
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

/**
 * Returns the section with its CTA destination(s) pointed at real pages.
 * Recognises the four section types that carry a primary CTA; anything else
 * is returned unchanged.
 */
export function applyCtaDefaults(section: Section, pages: readonly Page[]): Section {
  const primary = pageHref(pages, 'contact') ?? pageHref(pages, 'services');
  const about = pageHref(pages, 'about');
  if (!primary && !about) return section;

  const data = { ...section.data };
  switch (section.type) {
    case 'header':
    case 'offer':
      if (primary) data.ctaHref = primary;
      break;
    case 'hero':
      // The secondary CTA stays a `tel:` "call" link from defaultData.
      if (primary) data.ctaPrimaryHref = primary;
      break;
    case 'cta':
      if (primary) data.primaryHref = primary;
      if (about) data.secondaryHref = about;
      break;
    default:
      return section;
  }
  return { ...section, data };
}
