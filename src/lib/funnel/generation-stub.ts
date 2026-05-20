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
import { schedulePickerSection } from '@/lib/website/sections/schedulePicker';
import { thanksConfirmationSection } from '@/lib/website/sections/thanksConfirmation';
import {
  briefToGenerationContext,
  type ClientBrief,
} from '@/lib/website/site-generation-stub';
import type { Section } from '@/lib/website/types';

import { findFunnel, getDraftForFunnel } from './data-stub';
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
    // No brief = legacy passthrough; never hits the route.
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
 *  fallback path for dev surfaces, the no-key environment, and tests. */
export function generateFunnelSync(brief: ClientBrief): FunnelGenerationResult {
  // Landing step — a generated `generic` landing sequence (design variety +
  // brief-aware copy already applied by the website page generator).
  const landingPage = generateSync(briefToGenerationContext(brief, 'generic'));
  return buildFunnelSkeleton(brief, {
    landing: landingPage.page.sections,
    schedule: scheduleStepSections(brief),
    thanks: thanksStepSections(brief),
  });
}

// -- skeleton + step builders -----------------------------------------------
// Exported because the /api/generate-funnel route assembles its own result
// from the AI-generated landing sections + deterministic schedule + thanks.

/** Wrap pre-built section arrays into a complete FunnelGenerationResult.
 *  The Claude-backed route generates `landing` and reuses the deterministic
 *  `schedule` / `thanks`. The deterministic path uses this too. */
export function buildFunnelSkeleton(
  brief: ClientBrief,
  steps: { landing: Section[]; schedule: Section[]; thanks: Section[] },
): FunnelGenerationResult {
  const now = new Date().toISOString();
  const funnelId = `funnel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const stepList: FunnelStep[] = [
    mkStep(funnelId, 'landing', 'landing', 'Landing', steps.landing, now),
    mkStep(funnelId, 'schedule', 'schedule', 'Book a time', steps.schedule, now),
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

export function scheduleStepSections(brief: ClientBrief): Section[] {
  return [scheduleSection(brief)];
}

export function thanksStepSections(brief: ClientBrief): Section[] {
  return [thanksSection(brief)];
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

function scheduleSection(brief: ClientBrief): Section {
  const isCallOrQuote =
    brief.primaryIntent.kind === 'call' || brief.primaryIntent.kind === 'quote';
  const name = brief.business.name || 'We';
  return mkSection('schedulePicker', {
    ...schedulePickerSection.defaultData(),
    eyebrow: 'SCHEDULE',
    title: isCallOrQuote ? 'Request a callback' : 'Pick a time that suits you',
    intro: `${name} will SMS to confirm within minutes — choose a window below.`,
    durationLabel: '1-hour window',
    earliestSlotLabel: 'Earliest: today',
  });
}

function thanksSection(brief: ClientBrief): Section {
  const name = brief.business.name || 'We';
  return mkSection('thanksConfirmation', {
    ...thanksConfirmationSection.defaultData(),
    icon: 'check',
    title: "You're booked.",
    body: `${name} will be in touch shortly to confirm the details.`,
    detailLine: 'Look out for a text from a local number — that’s us.',
    showReferral: true,
    referralTag: 'REFER + EARN',
    referralTitle: 'Know someone who needs us?',
    referralBody:
      'Refer a friend — they get a discount on their first job, you get credit on your next.',
    referralCtaLabel: 'Send a referral',
    referralCtaHref: '/refer',
  });
}

// -- legacy passthrough -----------------------------------------------------

/** No-brief fallback — the registry-backed Voltline funnel. */
function voltlinePassthrough(): FunnelGenerationResult {
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
