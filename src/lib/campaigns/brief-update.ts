// =============================================================================
// Brief update — write chat answers through to the canonical brand columns.
//
// Phase 7.5 · Session 2.2. The brief-completion chat captures one short
// answer per missing field; this module persists each answer to its
// canonical `brands` row column as it arrives. Same RLS path operators use
// from /settings/brand (capability_grants → editTheme + tenant scoping).
//
// One answer at a time — the chat fires `saveBriefAnswer` after each turn
// rather than batching at the end. Three reasons:
//   1. A network hiccup mid-chat doesn't lose answers the operator already
//      typed.
//   2. The next `useBriefCompleteness` refetch reflects the updated state,
//      so a refresh resumes correctly.
//   3. The design doc's parked-decision frames this as a brand-completion
//      tool — answers should be visible at /settings/brand immediately,
//      not after the launch finishes.
//
// Maps the four locked BriefField values to brand columns:
//   • offer        → brands.offer (jsonb { headline, promise })
//                   — we set both keys to the same text so
//                   `briefIsPresent`-style readers see it as complete.
//                   Operators can split it apart in /settings/brand.
//   • audience_line→ brands.audience_line (string)
//   • services     → brands.services (text[]) — comma-separated input
//                   split + trimmed
//   • accent_color → brands.accent_color (string hex)
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import type { BriefField } from './brief-completeness';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type BriefAnswerInput =
  | { field: 'offer'; text: string }
  | { field: 'audience_line'; text: string }
  | { field: 'services'; text: string }
  | { field: 'accent_color'; hex: string };

/** Apply one chat answer to the client's `brands` row. Throws on RLS /
 *  network failure — the chat surfaces it inline so the operator can
 *  retry. Idempotent: re-sending the same answer just overwrites the
 *  same column. */
export async function saveBriefAnswer(
  clientId: string,
  answer: BriefAnswerInput,
): Promise<void> {
  const patch = buildPatch(answer);
  const { error } = await db()
    .from('brands')
    .update(patch)
    .eq('client_id', clientId);
  if (error) {
    throw new Error(
      `Could not save your answer (${answer.field}): ${error.message}`,
    );
  }
}

/** Pure — converts a BriefAnswerInput into the partial `brands` row
 *  patch that `saveBriefAnswer` writes. Exported so the chat UI can
 *  preview what's about to be saved if a future iteration wants to. */
export function buildPatch(answer: BriefAnswerInput): Record<string, unknown> {
  switch (answer.field) {
    case 'offer': {
      const text = answer.text.trim();
      // Store on both keys so `offerIsPresent` (brief-completeness.ts)
      // counts the offer as present. A future polish session can split
      // the operator's billboard line into a proper headline + promise
      // via a second AI pass; until then, single-text-in-both is the
      // safe shape.
      return {
        offer: {
          headline: text,
          promise: text,
          risk_reversal: '',
          cta_text: '',
        },
      };
    }
    case 'audience_line': {
      return { audience_line: answer.text.trim() };
    }
    case 'services': {
      // Comma-separated input — split, trim, drop empties, cap at 8.
      const parts = answer.text
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 8);
      // Backfill `top_jobs_to_be_booked` with the same list when it's
      // empty — gives the AI generator the highlight subset for free.
      return {
        services: parts,
        top_jobs_to_be_booked: parts,
      };
    }
    case 'accent_color': {
      return { accent_color: answer.hex };
    }
  }
}

/** The set of fields the chat actually asks about — `BriefField` minus
 *  any future additions that aren't chat-flow-friendly. Today these are
 *  the same set, but isolating it keeps `BriefField` open to expansion
 *  for completeness checks without forcing every new field into the
 *  chat flow. */
export const CHAT_FIELDS: readonly BriefField[] = [
  'offer',
  'services',
  'audience_line',
  'accent_color',
] as const;

/** Order the missing-fields list into the canonical chat order. The
 *  chat asks `offer` first (most conversation-natural), then `services`
 *  (concrete, easy to answer), then `audience_line` (requires more
 *  thought), then `accent_color` (the picker UI). Skips any field that's
 *  not in CHAT_FIELDS — defensive, in case BriefField gains a value
 *  the chat doesn't handle. */
export function sortChatFields(
  missing: readonly BriefField[],
): BriefField[] {
  const wanted = new Set(missing);
  return CHAT_FIELDS.filter((f) => wanted.has(f));
}
