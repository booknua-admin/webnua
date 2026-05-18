// =============================================================================
// Responsive grid-column classes for grid sections (features / trust / gallery
// / reviews). Container-query based — a section is an `@container`, so columns
// track the device-preview width, not the browser viewport.
//
// Every count collapses gracefully: 1 column on a phone → 2 → 3 → the full
// count on a wide canvas. Class strings are static literals so Tailwind's
// scanner picks them up; the runtime lookup just selects one.
// =============================================================================

export const GRID_COLUMNS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @lg:grid-cols-2',
  3: 'grid-cols-1 @sm:grid-cols-2 @2xl:grid-cols-3',
  4: 'grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4',
  5: 'grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5',
  6: 'grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-6',
};

/** Resolve a column count (1–6) to its responsive grid class string. */
export function gridColumnsClass(n: number): string {
  return GRID_COLUMNS_CLASS[n] ?? GRID_COLUMNS_CLASS[3];
}
