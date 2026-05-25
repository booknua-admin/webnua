// =============================================================================
// onboarding/industry-knowledge — browser-side caller for the per-industry
// AI knowledge route.
//
// Fires once per signup, between the business-name turn and the services
// picker. The result is cached on conversation_state.capturedFacts so
// downstream consumers (offer + site + funnel generation) read from there.
//
// Fallback policy is gentler than the offer route: this call MUST NOT
// block the signup, so a route failure does NOT throw `AppError`. The
// route itself returns the template/generic fallback as a 200 in any
// error path; this helper only has to handle network failures and the
// 429 rate-limit case, both of which degrade to a client-side fallback.
// =============================================================================

import type { IndustryKnowledge } from './conversation-types';

/** Input the route accepts. Industry is required; the rest are hints that
 *  sharpen the AI knowledge (services for a "destination wedding
 *  photographer" differ from a generic "wedding photographer"). */
export type IndustryKnowledgeInput = {
  industry: string;
  location?: string;
  specialty?: string;
  businessName?: string;
};

type RouteResponse = {
  knowledge?: {
    services?: unknown;
    trustSignals?: unknown;
    customerPainPoints?: unknown;
    desiredOutcomes?: unknown;
    voiceRecommendation?: unknown;
    source?: unknown;
  };
  source?: unknown;
  error?: string;
};

/** Resolve industry knowledge for a signup. Always returns a usable
 *  `IndustryKnowledge` — the route itself synthesises a fallback on every
 *  hard-failure path. When the browser can't reach the route at all
 *  (offline / 5xx propagated through), the caller still receives a
 *  generic-safe shape with `source: 'fallback'` so the conversation
 *  proceeds without exception handling at the call site. */
export async function resolveIndustryKnowledge(
  input: IndustryKnowledgeInput,
  options?: { signal?: AbortSignal },
): Promise<IndustryKnowledge> {
  try {
    const response = await fetch('/api/onboarding/industry-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
    if (response.ok) {
      const body = (await response.json()) as RouteResponse;
      const coerced = coerceKnowledge(body.knowledge);
      if (coerced) return coerced;
      console.warn(
        '[industry-knowledge] route response missing/malformed knowledge — using client fallback',
      );
      return clientSideGenericFallback();
    }
    // 429 / non-200 — surface the failure quietly and fall back. The
    // signup MUST NOT block on this call (the brief's locked timeout
    // shape: 10s server-side, fallback always; the same discipline
    // applies on the caller).
    console.warn(
      `[industry-knowledge] route returned ${response.status} — using client fallback`,
    );
    return clientSideGenericFallback();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    console.warn('[industry-knowledge] network error — using client fallback', error);
    return clientSideGenericFallback();
  }
}

function coerceKnowledge(value: unknown): IndustryKnowledge | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as RouteResponse['knowledge'];
  if (!v) return null;
  const services = readStringArray(v.services);
  const trustSignals = readStringArray(v.trustSignals);
  const customerPainPoints = readStringArray(v.customerPainPoints);
  const desiredOutcomes = readStringArray(v.desiredOutcomes);
  const voiceRecommendation =
    typeof v.voiceRecommendation === 'string' ? v.voiceRecommendation.trim() : '';
  if (
    services.length === 0 ||
    trustSignals.length === 0 ||
    customerPainPoints.length === 0 ||
    desiredOutcomes.length === 0 ||
    !voiceRecommendation
  ) {
    return null;
  }
  const source = readSource(v.source);
  return {
    services,
    trustSignals,
    customerPainPoints,
    desiredOutcomes,
    voiceRecommendation,
    source,
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
}

function readSource(value: unknown): IndustryKnowledge['source'] {
  if (value === 'ai' || value === 'template' || value === 'fallback') return value;
  return 'fallback';
}

/** Client-side generic shape, used only when the route is completely
 *  unreachable (offline, total network failure). Aligned with the route's
 *  genericSafeKnowledge so downstream consumers see the same fallback
 *  shape either way. */
function clientSideGenericFallback(): IndustryKnowledge {
  return {
    services: [
      'Initial Consultation',
      'Standard Service',
      'Premium Service',
      'Emergency / Urgent Service',
      'Maintenance',
      'Custom Project',
      'Follow-up Visit',
      'Annual Check',
    ],
    trustSignals: ['Local', 'Insured', 'Experienced', 'Trusted by customers'],
    customerPainPoints: [
      'Need it done right',
      'Need it done quickly',
      'Want someone reliable they can call back',
    ],
    desiredOutcomes: [
      'The job complete and done well',
      'A problem solved without follow-up calls',
      'Peace of mind that they hired the right person',
    ],
    voiceRecommendation: 'warm and professional',
    source: 'fallback',
  };
}
