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

import type { FunnelOffer } from './offer-generate';
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

/** AI-generated per-industry knowledge — flows from the conversational
 *  onboarding's industry-knowledge route into every downstream prompt
 *  (offer / site / funnel). Optional on the brief — the operator
 *  concierge path doesn't fetch it; the wizard skipped it; both still
 *  generate cleanly. Shape kept in lockstep with the conversation-types
 *  `IndustryKnowledge` (Pattern B — sibling shapes per CLAUDE.md "siblings
 *  beat conditional optional fields"; the conversation type carries the
 *  jsonb-storage shape, this one carries the prompt-input shape; the
 *  field names are identical so a typed copy is trivial). */
export type IndustryKnowledge = {
  services: string[];
  trustSignals: string[];
  customerPainPoints: string[];
  desiredOutcomes: string[];
  voiceRecommendation: string;
  source: 'ai' | 'template' | 'fallback';
};

/** One testimonial captured by the wizard for the AI funnel offer.
 *  Empty list → the funnel renders placeholder social proof, never an
 *  AI-invented quote (see CLAUDE.md "Open decisions / parked"). */
export type FunnelTestimonial = {
  quote: string;
  author: string;
  context: string;
};

/** Funnel-specific brief inputs. Required when funnel generation is
 *  requested; safe to leave at their empty defaults otherwise. The AI
 *  funnel generator (wired in a later session) reads these to build one
 *  offer that becomes the spine of the funnel. */
export type FunnelBrief = {
  /** Which one service the funnel sells. */
  service: string;
  /** The moment that makes a customer urgently search. */
  customerPain: string;
  /** Risk-reversal the business is willing to promise. */
  guarantee: string;
  /** 0–3 entries. Empty = placeholder social proof in the funnel. */
  testimonials: FunnelTestimonial[];
  /** AI-generated, operator-edited four-field offer. NULL when the wizard
   *  did not run the offer generator (e.g. key unset, user skipped). */
  offer: FunnelOffer | null;
};

/** The brief captured by the create-client modal. */
export type ClientBrief = {
  business: BusinessDetails;
  industry: string;
  brand: BrandObject;
  primaryIntent: PrimaryIntent;
  audience: Audience;
  funnel: FunnelBrief;
  /** Optional — present when conversational onboarding fetched it.
   *  Absent on the operator concierge path (brief is built directly).
   *  When present, the prompts thread customer-pain + desired-outcome +
   *  voice into the per-message industry context block. */
  industryKnowledge?: IndustryKnowledge;
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
    industryKnowledge: brief.industryKnowledge,
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
 *  card. `instantForDev` skips straight to the deterministic path.
 *
 *  `clientId` is forwarded to the route so it can attribute generation_log
 *  rows to the client this run belongs to (optional — dev preview surfaces
 *  may run without a created client). */
export async function generateSiteStub(
  brief: ClientBrief,
  options?: { signal?: AbortSignal; instantForDev?: boolean; clientId?: string },
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
      body: JSON.stringify({ ...brief, clientId: options?.clientId }),
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
