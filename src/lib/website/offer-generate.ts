// =============================================================================
// offer-generate — the funnel-offer generator (browser-side caller).
//
// Calls the Sonnet-backed /api/generate-offer route. Same fallback contract
// as site-generation-stub.ts:
//   - 503 (key not configured) → throw AppError.validation so the wizard
//     surfaces "configure ANTHROPIC_API_KEY" rather than degrading silently
//     to a generic stub offer (a stub offer here would be misleading — the
//     whole point of this step is to produce a real Sonnet draft);
//   - 500 (real failure) → throw AppError.unexpected with the server's
//     { name, status, detail } body so the wizard surfaces the actual error
//     (PR #58 pattern);
//   - network throw (non-abort) → throw AppError.unexpected.
//
// The user then edits any field, so the generation quality is recoverable
// in-flow even if Sonnet drifts.
// =============================================================================

import { AppError } from '@/lib/errors';

/** The four-field offer the wizard generates from the funnel brief. */
export type FunnelOffer = {
  headline: string;
  promise: string;
  riskReversal: string;
  ctaText: string;
};

/** Inputs the offer generator reads — already captured by the brief step. */
export type OfferGenerationInput = {
  industry: string;
  serviceArea: string;
  funnelService: string;
  funnelCustomerPain: string;
  funnelGuarantee: string;
};

type GenerationErrorBody = {
  error?: string;
  name?: string;
  status?: number;
  detail?: string;
};

export async function generateFunnelOffer(
  input: OfferGenerationInput,
  options?: { signal?: AbortSignal },
): Promise<FunnelOffer> {
  let response: Response;
  try {
    response = await fetch('/api/generate-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw AppError.unexpected(
      error,
      'Offer generation failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as { offer?: unknown };
    return coerceOffer(body.offer);
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { offer: 'AI offer generation is not configured (ANTHROPIC_API_KEY missing).' },
      'Offer generation is not configured on this environment.',
    );
  }
  throw AppError.unexpected(body, formatGenerationErrorMessage(response.status, body));
}

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
  return `Offer generation failed — ${name}${upstream}: ${detail}`;
}

function coerceOffer(value: unknown): FunnelOffer {
  if (!value || typeof value !== 'object') {
    throw AppError.unexpected(value, 'Offer generation returned no offer.');
  }
  const v = value as Record<string, unknown>;
  // Accept both camelCase (route response) and snake_case (raw model output).
  const headline = pickString(v, 'headline');
  const promise = pickString(v, 'promise');
  const riskReversal = pickString(v, 'riskReversal', 'risk_reversal');
  const ctaText = pickString(v, 'ctaText', 'cta_text');
  if (!headline || !promise || !riskReversal || !ctaText) {
    throw AppError.unexpected(
      value,
      'Offer generation returned an incomplete offer — try again.',
    );
  }
  return { headline, promise, riskReversal, ctaText };
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Polish a rough offer paragraph the operator typed on the wizard's brief
 *  step into something tighter and more concrete. Sonnet-backed via
 *  /api/enhance-offer. Same fallback shape as generateFunnelOffer:
 *    - 503 (key unset) → throw AppError.validation so the wizard surfaces
 *      "configure ANTHROPIC_API_KEY" rather than silently no-op'ing;
 *    - 500 (real failure) → throw AppError.unexpected with the server's
 *      { name, status, detail } body so the wizard's error pane shows it. */
export async function enhanceFunnelOfferText(
  input: { rawText: string; industry: string; businessName?: string; serviceArea?: string },
  options?: { signal?: AbortSignal },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/enhance-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw AppError.unexpected(
      error,
      'Offer enhancement failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as { text?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim()) {
      throw AppError.unexpected(body, 'Offer enhancement returned no text.');
    }
    return body.text.trim();
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { offer: 'AI offer enhancement is not configured (ANTHROPIC_API_KEY missing).' },
      'Offer enhancement is not configured on this environment.',
    );
  }
  throw AppError.unexpected(body, formatEnhanceErrorMessage(response.status, body));
}

function formatEnhanceErrorMessage(httpStatus: number, body: GenerationErrorBody): string {
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${httpStatus}`;
  return `Offer enhancement failed — ${name}${upstream}: ${detail}`;
}

/** The shape persisted to funnels.funnel_offer (snake_case to match the DB). */
export type FunnelOfferRow = {
  headline: string;
  promise: string;
  risk_reversal: string;
  cta_text: string;
};

export function offerToRow(offer: FunnelOffer): FunnelOfferRow {
  return {
    headline: offer.headline,
    promise: offer.promise,
    risk_reversal: offer.riskReversal,
    cta_text: offer.ctaText,
  };
}

/** Coerce a jsonb row read (typically from brands.offer or
 *  funnels.funnel_offer) into the camelCase `FunnelOffer` shape callers
 *  consume. Returns null when the input is missing, malformed, or has
 *  any of the four fields empty/non-string — readers should treat that
 *  as "no offer present" and fall back through the resolution chain. */
export function rowToOffer(value: unknown): FunnelOffer | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  // Accept both snake_case (DB row) and camelCase (defensive — the same
  // jsonb might be written from either side in transition).
  const headline = pickString(v, 'headline');
  const promise = pickString(v, 'promise');
  const riskReversal = pickString(v, 'riskReversal', 'risk_reversal');
  const ctaText = pickString(v, 'ctaText', 'cta_text');
  if (!headline || !promise || !riskReversal || !ctaText) return null;
  return { headline, promise, riskReversal, ctaText };
}
