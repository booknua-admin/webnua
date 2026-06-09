// =============================================================================
// rewrite-field — browser-side caller for /api/rewrite-field.
//
// Builder-copy rewrite, distinct from the wizard's freeform brief enhancer.
// Used by in-editor `✦ Regen` so copy fields can request one alternate draft
// grounded in the current section / field / brand context.
// =============================================================================

import { AppError } from '@/lib/errors';

export type RewriteFieldContext = {
  sectionLabel?: string;
  industry?: string;
  audienceLine?: string;
};

export type RewriteFieldInput = {
  fieldName: string;
  currentValue: string;
  context?: RewriteFieldContext;
};

type ErrorBody = {
  error?: string;
  name?: string;
  status?: number;
  detail?: string;
};

export async function rewriteField(
  input: RewriteFieldInput,
  options?: { signal?: AbortSignal },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/rewrite-field', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw AppError.unexpected(
      error,
      'Rewrite failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as { rewritten?: unknown };
    if (typeof body.rewritten !== 'string' || !body.rewritten.trim()) {
      throw AppError.unexpected(body, 'Rewrite returned no text.');
    }
    return body.rewritten.trim();
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { rewrite: 'AI field rewrite is not configured (ANTHROPIC_API_KEY missing).' },
      'Field rewrite is not configured on this environment.',
    );
  }
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${response.status}`;
  throw AppError.unexpected(body, `Rewrite failed — ${name}${upstream}: ${detail}`);
}

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}
