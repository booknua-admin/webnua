// =============================================================================
// field-enhance — browser-side caller for /api/enhance-field.
//
// Generic freeform-field enhancer. Distinct from offer-generate.ts's
// `enhanceFunnelOfferText` — that one polishes offer copy with direct-response
// framing; this one draws out specificity with a research-grade interviewer
// framing. Both are Sonnet-backed and surface failures via AppError.
// =============================================================================

import { AppError } from '@/lib/errors';

export type EnhanceFieldBriefContext = {
  businessName?: string;
  industry?: string;
  serviceArea?: string;
  funnelService?: string;
};

export type EnhanceFieldInput = {
  fieldName: string;
  currentValue: string;
  briefContext?: EnhanceFieldBriefContext;
};

type ErrorBody = {
  error?: string;
  name?: string;
  status?: number;
  detail?: string;
};

export async function enhanceField(
  input: EnhanceFieldInput,
  options?: { signal?: AbortSignal },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/enhance-field', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw AppError.unexpected(
      error,
      'Enhancement failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as { enhanced?: unknown };
    if (typeof body.enhanced !== 'string' || !body.enhanced.trim()) {
      throw AppError.unexpected(body, 'Enhancement returned no text.');
    }
    return body.enhanced.trim();
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { enhance: 'AI field enhancement is not configured (ANTHROPIC_API_KEY missing).' },
      'Field enhancement is not configured on this environment.',
    );
  }
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${response.status}`;
  throw AppError.unexpected(body, `Enhancement failed — ${name}${upstream}: ${detail}`);
}

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}
