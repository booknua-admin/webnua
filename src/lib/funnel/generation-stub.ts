// =============================================================================
// generateFunnelStub — the funnel generator (stub).
//
// Brief-aware: given a ClientBrief it composes a three-step funnel — a
// generated landing sequence (the page generator's `generic` output, so the
// design-variety + brief-aware copy layers apply), a schedule step, and a
// thanks step. The schedule / thanks steps carry the funnel-only sections
// (`schedulePicker` / `thanksConfirmation`) the page generator cannot emit.
//
// Called without a brief it falls back to the registry-backed Voltline
// funnel (back-compat for the legacy onboarding draft route).
//
// Replace with a real backend call when the LLM lands; the contract stays.
// =============================================================================

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

export async function generateFunnelStub(
  brief?: ClientBrief,
  options?: { signal?: AbortSignal; instantForDev?: boolean },
): Promise<FunnelGenerationResult> {
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
  return brief ? generateFunnelSync(brief) : voltlinePassthrough();
}

/** Synchronous brief-aware funnel generation (no delay). */
export function generateFunnelSync(brief: ClientBrief): FunnelGenerationResult {
  const now = new Date().toISOString();
  const funnelId = `funnel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const business = brief.business;

  // Landing step — a generated `generic` landing sequence (design variety +
  // brief-aware copy already applied by the page generator).
  const landingPage = generateSync(briefToGenerationContext(brief, 'generic'));

  const steps: FunnelStep[] = [
    mkStep(funnelId, 'landing', 'landing', 'Landing', landingPage.page.sections, now),
    mkStep(funnelId, 'schedule', 'schedule', 'Book a time', [scheduleSection(brief)], now),
    mkStep(funnelId, 'thanks', 'thanks', 'Confirmed', [thanksSection(brief)], now),
  ];

  const funnel: Funnel = {
    id: funnelId,
    clientId: '__pending__',
    name: `${business.name || brief.industry} · ${intentLabel(brief)}`,
    domain: { primary: '', aliases: [], sslStatus: 'pending' },
    draftVersionId: `${funnelId}-draft`,
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
  };

  return { funnel, steps };
}

// -- step / section builders ------------------------------------------------

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
