// =============================================================================
// site-generation-stub — the multi-page website generator.
//
// Parallel to lib/funnel/generation-stub.ts. Where `generatePageStub`
// produces ONE page, this produces a small site (home / services / about /
// contact) by running the page generator per page type. Each page already
// carries the design-variety layer, so a generated site has a coherent but
// non-repetitive set of pages.
//
// `generateSiteStub` calls the real Claude-backed /api/generate-site route.
// Fallback policy (see CLAUDE.md "Phase 6 generation fallback policy"):
//   - 503 (key not configured) → silently fall back to the deterministic
//     `generateSiteSync` so dev / local flows still work without a key;
//   - 500 (real generation failure) → throw `AppError` carrying the server's
//     { name, status, detail } body so the modal surfaces it;
//   - fetch throw (network / abort propagated) → fall back, console.warn.
// The ClientBrief → SiteGenerationResult contract is the same either way.
// =============================================================================

import { AppError } from '@/lib/errors';

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

/** The site generator. Calls the real Claude-backed /api/generate-site route;
 *  falls back to the deterministic generator if that route is unconfigured
 *  (no ANTHROPIC_API_KEY) or fails. Async so the call site can show a progress
 *  card. `instantForDev` skips straight to the deterministic path. */
export async function generateSiteStub(
  brief: ClientBrief,
  options?: { signal?: AbortSignal; instantForDev?: boolean },
): Promise<SiteGenerationResult> {
  if (options?.instantForDev) {
    return generateSiteSync(brief);
  }

  // Try the real Claude-backed generator first.
  let response: Response;
  try {
    response = await fetch('/api/generate-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief),
      signal: options?.signal,
    });
  } catch (error) {
    // A user-initiated abort must propagate; a network failure falls back so
    // the create flow doesn't hard-fail on transient connectivity issues.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    console.warn('[generate-site] fetch failed, falling back to stub generator', error);
    await delayWithAbort(randomDelayMs(), options?.signal);
    return generateSiteSync(brief);
  }

  if (response.ok) {
    return (await response.json()) as SiteGenerationResult;
  }

  // 503 = generation-not-configured (no ANTHROPIC_API_KEY). Intentional
  // graceful degrade for dev — fall back to the deterministic generator.
  if (response.status === 503) {
    console.warn(
      '[generate-site] /api/generate-site returned 503 (not configured), using stub generator',
    );
    await delayWithAbort(randomDelayMs(), options?.signal);
    return generateSiteSync(brief);
  }

  // Any other non-OK status → real failure. Surface the server's
  // { error, name, status, detail } body via AppError so the modal can show
  // the actual Claude error instead of silently degrading to the stub.
  const body = await readErrorBody(response);
  throw AppError.unexpected(body, formatGenerationErrorMessage(response.status, body));
}

type GenerationErrorBody = {
  error?: string;
  name?: string;
  status?: number;
  detail?: string;
};

async function readErrorBody(response: Response): Promise<GenerationErrorBody> {
  try {
    return (await response.json()) as GenerationErrorBody;
  } catch {
    return {};
  }
}

function formatGenerationErrorMessage(httpStatus: number, body: GenerationErrorBody): string {
  // Server contract: { error, name, status, detail } — `detail` is the
  // upstream Anthropic message; `status` is the Anthropic HTTP status.
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${httpStatus}`;
  return `Generation failed — ${name}${upstream}: ${detail}`;
}

function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
