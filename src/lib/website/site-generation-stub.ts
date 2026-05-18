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

import type { Audience, GenerationContext, PrimaryIntent } from './generation-context';
import { generateSync, randomDelayMs } from './generation-stub';
import type { BrandObject, Page, PageType } from './types';

/** The brief captured by the create-client modal. */
export type ClientBrief = {
  businessName: string;
  industry: string;
  serviceArea: string;
  brand: BrandObject;
  primaryIntent: PrimaryIntent;
  audience: Audience;
};

export type SiteGenerationResult = {
  generationId: string;
  pages: Page[];
};

/** The page set a generated site ships with. */
const SITE_PAGE_TYPES: readonly PageType[] = ['home', 'services', 'about', 'contact'];

function briefToContext(brief: ClientBrief, pageType: PageType): GenerationContext {
  return {
    flavour: 'first-page',
    pageType,
    primaryIntent: brief.primaryIntent,
    audience: brief.audience,
    specifics: null,
    avoid: null,
    brand: brief.brand,
    existingPages: [],
  };
}

/** Synchronous variant — used by dev surfaces and tests. */
export function generateSiteSync(brief: ClientBrief): SiteGenerationResult {
  const generationId = `site-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const pages = SITE_PAGE_TYPES.map(
    (pageType) => generateSync(briefToContext(brief, pageType)).page,
  );
  return { generationId, pages };
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
