// =============================================================================
// site-generation-stub — the multi-page website generator (stub).
//
// Parallel to lib/funnel/generation-stub.ts. Where `generatePageStub`
// produces ONE page, this produces a small site (home / services / about /
// contact) by running the page generator per page type. Each page already
// carries the design-variety layer, so a generated site has a coherent but
// non-repetitive set of pages.
//
// Replace with a real backend call when the LLM lands; the ClientBrief →
// SiteGenerationResult contract stays identical.
// =============================================================================

import type {
  Audience,
  BusinessDetails,
  GenerationContext,
  PrimaryIntent,
} from './generation-context';
import {
  fillFooterSection,
  fillHeaderSection,
  generateSync,
  randomDelayMs,
} from './generation-stub';
import type { BrandObject, Page, PageType, Section } from './types';

/** The brief captured by the create-client modal. */
export type ClientBrief = {
  business: BusinessDetails;
  industry: string;
  brand: BrandObject;
  primaryIntent: PrimaryIntent;
  audience: Audience;
};

export type SiteGenerationResult = {
  generationId: string;
  pages: Page[];
  header: Section;
  footer: Section;
};

/** The page set a generated site ships with. */
const SITE_PAGE_TYPES: readonly PageType[] = ['home', 'services', 'about', 'contact'];

export function briefToGenerationContext(brief: ClientBrief, pageType: PageType): GenerationContext {
  return {
    flavour: 'first-page',
    pageType,
    primaryIntent: brief.primaryIntent,
    audience: brief.audience,
    specifics: brief.business.offer || null,
    avoid: null,
    brand: brief.brand,
    existingPages: [],
    business: brief.business,
  };
}

/** Synchronous variant — used by dev surfaces and tests. */
export function generateSiteSync(brief: ClientBrief): SiteGenerationResult {
  const generationId = `site-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const pages = SITE_PAGE_TYPES.map(
    (pageType) => generateSync(briefToGenerationContext(brief, pageType)).page,
  );
  const chrome = briefToGenerationContext(brief, 'home');
  return {
    generationId,
    pages,
    header: fillHeaderSection(chrome),
    footer: fillFooterSection(chrome),
  };
}

/** The stub site generator. Async (synthetic delay) so the call site can
 *  show a progress card; the real backend implements the same shape. */
export async function generateSiteStub(
  brief: ClientBrief,
  options?: { signal?: AbortSignal; instantForDev?: boolean },
): Promise<SiteGenerationResult> {
  if (!options?.instantForDev) {
    await new Promise<void>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const t = setTimeout(resolve, randomDelayMs());
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }
  return generateSiteSync(brief);
}
