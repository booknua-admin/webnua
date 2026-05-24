// =============================================================================
// generateFunnelStub — the funnel generator.
//
// Wired to real Claude via /api/generate-funnel — ONE Opus call produces the
// seven-section funnel landing step (hero → offer → reviews → features →
// trust → reviews → form) in the Suby / Sultanic shape. The schedule + thanks
// steps stay deterministic — they are chrome-only and the wizard captures
// none of the inputs an LLM would need to differentiate them.
//
// Fallback policy (mirrors site-generation-stub.ts):
//   - 503 (key not configured) → silently fall back to the deterministic
//     `generateFunnelSync` so dev / local flows still work without a key;
//   - 500 (real generation failure) → throw `AppError` carrying the server's
//     { name, status, detail } body so the modal surfaces it (PR #58 pattern);
//   - fetch throw (network / abort propagated) → fall back, console.warn.
//
// Called without a brief it still falls back to the registry-backed Voltline
// funnel (back-compat for any legacy caller).
// =============================================================================

import { AppError } from '@/lib/errors';

import { generateSync, randomDelayMs } from '@/lib/website/generation-stub';
import { getSectionMeta } from '@/lib/website/sections/registry-meta';
import {
  briefToGenerationContext,
  type ClientBrief,
} from '@/lib/website/site-generation-stub';
import type { Section } from '@/lib/website/types';

// NOTE: section .tsx modules are NOT imported at the top level (e.g.
// `schedulePickerSection`, `thanksConfirmationSection`). Those are 'use client'
// modules — top-level imports here pull client-reference stubs into the server
// bundle for /api/generate-funnel, and any call to `.defaultData()` on a stub
// throws "is not a function" at runtime. The thanks-step builder reads its
// defaults from registry-meta's `defaultDataValues` snapshot instead — same
// pattern as `fillHeaderSection` / `fillFooterSection`. The schedule picker is
// no longer used at all (Step 2 is a qualification form, not a picker).

// NOTE: `./data-stub` is NOT imported at the top level. data-stub.tsx calls
// section modules' `defaultData()` at module load (see voltlineLandingHero
// et al.), and section modules are 'use client' — so a top-level import here
// pulls client-reference stubs into the server bundle for `/api/generate-funnel`
// and crashes the build with "heroSection.defaultData is not a function" at
// module evaluation. See CLAUDE.md parked decision "Section metadata
// server/client boundary". The no-brief legacy passthrough lazy-imports it
// instead so the server bundle never evaluates data-stub.tsx.
import type { Funnel, FunnelStep } from './types';

export type FunnelGenerationResult = {
  funnel: Funnel;
  steps: FunnelStep[];
};

const STUB_FUNNEL_ID = 'emergency-call-out';

// -- public entry point -----------------------------------------------------

/** Generate a funnel. Calls the real Claude-backed /api/generate-funnel route;
 *  falls back to the deterministic `generateFunnelSync` if that route is
 *  unconfigured (no ANTHROPIC_API_KEY) or fails. */
export async function generateFunnelStub(
  brief?: ClientBrief,
  options?: { signal?: AbortSignal; instantForDev?: boolean; clientId?: string },
): Promise<FunnelGenerationResult> {
  if (!brief) {
    // No brief = legacy passthrough; never hits the route. Lazy-imports
    // data-stub to keep its 'use client' section-module reach out of the
    // server bundle — see the import comment above.
    if (!options?.instantForDev) await delayWithAbort(randomDelayMs(), options?.signal);
    return voltlinePassthrough();
  }
  if (options?.instantForDev) {
    return generateFunnelSync(brief);
  }

  let response: Response;
  try {
    response = await fetch('/api/generate-funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...brief, clientId: options?.clientId }),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.warn('[generate-funnel] fetch failed, falling back to stub generator', error);
    await delayWithAbort(randomDelayMs(), options?.signal);
    return generateFunnelSync(brief);
  }

  if (response.ok) {
    return (await response.json()) as FunnelGenerationResult;
  }

  // 503 = generation-not-configured (no ANTHROPIC_API_KEY). Graceful degrade.
  if (response.status === 503) {
    console.warn(
      '[generate-funnel] /api/generate-funnel returned 503 (not configured), using stub generator',
    );
    await delayWithAbort(randomDelayMs(), options?.signal);
    return generateFunnelSync(brief);
  }

  // Any other non-OK → real failure. Surface via AppError so the modal shows
  // the actual Claude error instead of silently degrading to the stub.
  const body = await readErrorBody(response);
  throw AppError.unexpected(body, formatGenerationErrorMessage(response.status, body));
}

/** Synchronous brief-aware funnel generation (no delay) — deterministic
 *  fallback path for dev surfaces, the no-key environment, and tests.
 *  Overlays real testimonials (from `brief.funnel.testimonials`) onto every
 *  reviews section the underlying page generator produced — closes the
 *  long-standing bug where a tradie who entered testimonials saw them on
 *  the Claude path but lost them on the deterministic path. */
export function generateFunnelSync(brief: ClientBrief): FunnelGenerationResult {
  // Landing step — a generated `generic` landing sequence (design variety +
  // brief-aware copy already applied by the website page generator). The
  // deterministic fallback reuses the landing copy for the qualification
  // step too — the real Claude path generates a dedicated qualification page.
  const landingPage = generateSync(briefToGenerationContext(brief, 'generic'));
  const sections = applyBriefTestimonialsToSections(
    landingPage.page.sections,
    brief.funnel.testimonials,
  );
  return buildFunnelSkeleton(brief, {
    landing: sections,
    qualification: sections,
    thanks: thanksStepSections(),
  });
}

/** Overlay operator-entered testimonials onto every reviews section. The
 *  funnel-brief carries 0–3 testimonials; when present we replace the
 *  generator's stub items so the funnel preview shows the tradie's actual
 *  customer voices. Empty list → no change (keep the generated placeholder
 *  reviews — they're flagged via `placeholderSnapshot` for the preflight
 *  banner). */
function applyBriefTestimonialsToSections(
  sections: Section[],
  testimonials: ReadonlyArray<{ quote: string; author: string; context: string }>,
): Section[] {
  if (testimonials.length === 0) return sections;
  const items = testimonials.map((t, i) => ({
    id: `rev-real-${i}-${Math.random().toString(36).slice(2, 8)}`,
    quote: t.quote,
    authorName: t.author,
    authorRole: t.context,
    avatarUrl: '',
    rating: 5,
  }));
  return sections.map((section) => {
    if (section.type !== 'reviews') return section;
    // Keep section.data.items keyed on the data shape — we don't import
    // ReviewsData here to avoid pulling 'use client' section modules into
    // the server bundle. The data shape is established (see reviews.tsx).
    return {
      ...section,
      data: { ...(section.data as Record<string, unknown>), items },
      // Drop the placeholder snapshot — these aren't AI-invented anymore.
      ai: section.ai
        ? {
            ...section.ai,
            placeholderSnapshot: section.ai.placeholderSnapshot
              ? { ...section.ai.placeholderSnapshot, reviews: undefined }
              : undefined,
          }
        : section.ai,
    };
  });
}

// -- skeleton + step builders -----------------------------------------------
// Exported because the /api/generate-funnel route assembles its own result
// from the AI-generated landing + qualification sections + deterministic thanks.

/** Wrap pre-built section arrays into a complete FunnelGenerationResult.
 *  Three-step funnel: lead-capture landing → qualification → thanks. */
export function buildFunnelSkeleton(
  brief: ClientBrief,
  steps: { landing: Section[]; qualification: Section[]; thanks: Section[] },
): FunnelGenerationResult {
  const now = new Date().toISOString();
  const funnelId = `funnel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  // `type: 'schedule'` is the closest match in the FunnelStepType union for
  // the qualification slot — kept so the existing FunnelStepThumbnail
  // dispatcher still renders something sensible. Display title is the
  // qualification-step framing.
  const stepList: FunnelStep[] = [
    mkStep(funnelId, 'landing', 'landing', 'Landing', steps.landing, now),
    mkStep(funnelId, 'book', 'schedule', 'Book your callout', steps.qualification, now),
    mkStep(funnelId, 'thanks', 'thanks', 'Confirmed', steps.thanks, now),
  ];
  const funnel: Funnel = {
    id: funnelId,
    clientId: '__pending__',
    name: `${brief.business.name || brief.industry} · ${intentLabel(brief)}`,
    domain: { primary: '', aliases: [], sslStatus: 'pending' },
    draftVersionId: `${funnelId}-draft`,
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
  return { funnel, steps: stepList };
}

export function thanksStepSections(): Section[] {
  return [thanksSection()];
}

// -- internals --------------------------------------------------------------

function mkStep(
  funnelId: string,
  slug: string,
  type: FunnelStep['type'],
  title: string,
  sections: Section[],
  now: string,
): FunnelStep {
  return {
    id: `step-${slug}-${Math.random().toString(36).slice(2, 8)}`,
    funnelId,
    slug,
    title,
    type,
    sections,
    seo: { title },
    createdAt: now,
    updatedAt: now,
  };
}

function mkSection(type: Section['type'], data: Record<string, unknown>): Section {
  return {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    type,
    enabled: true,
    data,
    ai: { draftedFields: Object.keys(data), lastRegenAt: new Date().toISOString() },
  };
}

function intentLabel(brief: ClientBrief): string {
  switch (brief.primaryIntent.kind) {
    case 'book':
      return 'Booking funnel';
    case 'call':
      return 'Call funnel';
    case 'quote':
      return 'Quote funnel';
    case 'signup':
      return 'Sign-up funnel';
    default:
      return 'Funnel';
  }
}

/** Deterministic thanks-step section. Reads its defaults from registry-meta
 *  rather than calling `thanksConfirmationSection.defaultData()` — that section
 *  module is 'use client' and becomes a stub on the server bundle of the
 *  /api/generate-funnel route. Same pattern as fillHeaderSection. */
function thanksSection(): Section {
  const defaults = getSectionMeta('thanksConfirmation')?.defaultDataValues ?? {};
  return mkSection('thanksConfirmation', { ...defaults });
}

// -- legacy passthrough -----------------------------------------------------

/** No-brief fallback — the registry-backed Voltline funnel. Dynamic import
 *  to keep `data-stub.tsx` (which calls `'use client'` section modules at
 *  module load) out of the server bundle. Only client-side callers reach
 *  this path; the server-side `/api/generate-funnel` route always supplies
 *  a brief, so this dynamic import is never evaluated on the server. */
async function voltlinePassthrough(): Promise<FunnelGenerationResult> {
  const { findFunnel, getDraftForFunnel } = await import('./data-stub');
  const funnel = findFunnel(STUB_FUNNEL_ID);
  const draft = funnel ? getDraftForFunnel(STUB_FUNNEL_ID) : null;
  if (!funnel || !draft) {
    throw new Error(`generateFunnelStub: no funnel resolves to "${STUB_FUNNEL_ID}".`);
  }
  return { funnel, steps: draft.snapshot.steps };
}

// -- shared fetch helpers ---------------------------------------------------

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
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${httpStatus}`;
  return `Funnel generation failed — ${name}${upstream}: ${detail}`;
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
