// =============================================================================
// Placeholder-testimonial detection (B16).
//
// The website generator emits `reviews` sections with AI-invented testimonials
// — plausible-looking quotes + author names that are NOT real customers.
// Shipping them live is a credibility risk. At generation time `toSection`
// (generation-stub.ts) snapshots the drafted items onto
// `section.ai.placeholderSnapshot.reviews`.
//
// A live review item is an "unedited placeholder" when it still EXACTLY
// matches a snapshot entry on every text field a human would edit (quote +
// authorName + authorRole). The moment the operator changes any of that text
// the item no longer matches and is treated as a real review.
//
// Why exact-content comparison and not a per-item dirty flag:
//   - it survives the operator editing a field then reverting it,
//   - it needs no per-keystroke bookkeeping in the section editor, and
//   - it is agnostic to which strings the AI generator emits — the snapshot
//     is whatever was generated for THIS section, so changing the generator's
//     wording can never break detection.
// Future edits to the AI generation prompts therefore require no change here.
// =============================================================================

import type { Section, VersionSnapshot } from './types';

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Number of review items in a section that still exactly match their
 *  AI-drafted placeholder snapshot (i.e. the operator has not edited them).
 *  Returns 0 for any non-`reviews` section, or a reviews section that was not
 *  AI-generated (no snapshot — e.g. a hand-seeded or manually-added one). */
export function uneditedPlaceholderCount(section: Section): number {
  if (section.type !== 'reviews') return 0;
  const snapshot = section.ai?.placeholderSnapshot?.reviews ?? [];
  if (snapshot.length === 0) return 0;

  const items = Array.isArray(section.data.items)
    ? (section.data.items as Array<Record<string, unknown>>)
    : [];

  let count = 0;
  for (const item of items) {
    const quote = asString(item.quote);
    const authorName = asString(item.authorName);
    const authorRole = asString(item.authorRole);
    const stillPlaceholder = snapshot.some(
      (orig) =>
        orig.quote === quote && orig.authorName === authorName && orig.authorRole === authorRole,
    );
    if (stillPlaceholder) count += 1;
  }
  return count;
}

/** Total unedited AI placeholder testimonials across a whole draft snapshot —
 *  drives the pre-publish preflight warning. Disabled sections are excluded:
 *  they will not publish, so their placeholders are not a live credibility
 *  risk. */
export function countUneditedPlaceholderTestimonials(snapshot: VersionSnapshot): number {
  let total = 0;
  for (const page of snapshot.pages) {
    for (const section of page.sections) {
      if (section.enabled) total += uneditedPlaceholderCount(section);
    }
  }
  return total;
}
