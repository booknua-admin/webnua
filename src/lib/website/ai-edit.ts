'use client';

// =============================================================================
// ai-edit — browser half of the Bolt/Lovable-style AI edit bar.
//
// `requestSectionEdit` POSTs the editor's current sections + the operator's
// natural-language instruction to /api/edit-sections and gets back a
// validated operation list + a one-line summary. `applyEditOperations` then
// applies those operations LOCALLY — application lives here (not the route)
// because added sections must seed from the section registry's
// `defaultData()`, which lives in the 'use client' section modules the
// server bundle cannot execute (see the section metadata server/client
// boundary in CLAUDE.md).
//
// The result is held by SectionEditor as a PROPOSAL (preview swaps to the
// proposed sections with Apply / Discard) — nothing touches the autosaved
// section state until the operator applies.
// =============================================================================

import { AppError } from '@/lib/errors';
import { getSectionDefinition } from '@/lib/website/sections';
import type { BrandObject, Section, SectionType } from '@/lib/website/types';

export type AIEditOperation =
  | { op: 'update'; sectionId: string; fields: Record<string, unknown> }
  | {
      op: 'add';
      type: SectionType;
      afterSectionId: string | null;
      fields: Record<string, unknown>;
    }
  | { op: 'remove'; sectionId: string }
  | { op: 'move'; sectionId: string; toIndex: number }
  | { op: 'toggle'; sectionId: string; enabled: boolean };

export type AIEditResponse = {
  operations: AIEditOperation[];
  summary: string;
};

export type RequestSectionEditInput = {
  instruction: string;
  container: 'page' | 'funnelStep';
  sections: Section[];
  selectedSectionId?: string | null;
  brand?: BrandObject | null;
  businessName?: string;
};

type ErrorBody = {
  error?: string;
  name?: string;
  status?: number;
  detail?: string;
};

export async function requestSectionEdit(
  input: RequestSectionEditInput,
  options?: { signal?: AbortSignal },
): Promise<AIEditResponse> {
  let response: Response;
  try {
    response = await fetch('/api/edit-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: input.instruction,
        container: input.container,
        selectedSectionId: input.selectedSectionId ?? null,
        // Strip the form/popup envelopes + ai meta — the model is told they
        // are out of scope, so don't spend tokens shipping them.
        sections: input.sections.map((s) => ({
          id: s.id,
          type: s.type,
          enabled: s.enabled,
          data: s.data,
        })),
        brand: input.brand
          ? {
              businessName: input.businessName ?? '',
              industryCategory: input.brand.industryCategory,
              audienceLine: input.brand.audienceLine,
              voice: input.brand.voice,
              // The route maps any model-emitted `surface` pick to contrast-
              // safe theme overrides built from this accent.
              accentColor: input.brand.accentColor,
            }
          : undefined,
      }),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw AppError.unexpected(
      error,
      'AI edit failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as Partial<AIEditResponse>;
    if (!Array.isArray(body.operations)) {
      throw AppError.unexpected(body, 'AI edit returned no operations.');
    }
    return {
      operations: body.operations,
      summary:
        typeof body.summary === 'string' && body.summary.trim()
          ? body.summary.trim()
          : 'AI edit proposal.',
    };
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { edit: 'AI editing is not configured (ANTHROPIC_API_KEY missing).' },
      'AI editing is not configured on this environment.',
    );
  }
  if (response.status === 429) {
    throw AppError.validation(
      { edit: body.detail ?? 'rate-limited' },
      body.detail?.trim() ||
        'You have hit the AI edit limit for now — try again in a little while.',
    );
  }
  const upstream = body.status ? ` ${body.status}` : '';
  const name = body.name ?? 'Error';
  const detail = body.detail?.trim() || body.error || `HTTP ${response.status}`;
  throw AppError.unexpected(body, `AI edit failed — ${name}${upstream}: ${detail}`);
}

export type AppliedEdit = {
  sections: Section[];
  /** Updated + added + moved section ids — the preview rings these. */
  changedIds: Set<string>;
};

/** Apply a validated operation list to the editor's sections. Pure — returns
 *  a new array; the caller decides whether to commit (Apply) or drop it
 *  (Discard). Unknown section ids are skipped defensively (the route already
 *  validated against the same snapshot, but the editor may have moved on). */
export function applyEditOperations(
  sections: Section[],
  operations: AIEditOperation[],
): AppliedEdit {
  let next = sections.map((s) => ({ ...s, data: { ...s.data } }));
  const changedIds = new Set<string>();

  for (const op of operations) {
    if (op.op === 'update') {
      const target = next.find((s) => s.id === op.sectionId);
      if (!target) continue;
      target.data = { ...target.data, ...op.fields };
      changedIds.add(target.id);
    } else if (op.op === 'add') {
      const definition = getSectionDefinition(op.type);
      if (!definition) continue;
      const section: Section = {
        id: `sec-${Math.random().toString(36).slice(2, 9)}`,
        type: op.type,
        enabled: true,
        data: {
          ...(definition.defaultData() as Record<string, unknown>),
          ...op.fields,
        },
      };
      const at = op.afterSectionId ? next.findIndex((s) => s.id === op.afterSectionId) : -1;
      if (at >= 0) next.splice(at + 1, 0, section);
      else next.push(section);
      changedIds.add(section.id);
    } else if (op.op === 'remove') {
      next = next.filter((s) => s.id !== op.sectionId);
      changedIds.delete(op.sectionId);
    } else if (op.op === 'move') {
      const from = next.findIndex((s) => s.id === op.sectionId);
      if (from < 0) continue;
      const [moved] = next.splice(from, 1);
      const to = Math.max(0, Math.min(op.toIndex, next.length));
      next.splice(to, 0, moved);
      changedIds.add(moved.id);
    } else if (op.op === 'toggle') {
      const target = next.find((s) => s.id === op.sectionId);
      if (!target) continue;
      target.enabled = op.enabled;
      changedIds.add(target.id);
    }
  }

  return { sections: next, changedIds };
}

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}
