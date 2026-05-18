'use client';

// =============================================================================
// StarRow — a row of filled rating stars, shared by sections that show a
// star rating (trust stats, reviews). Renders nothing at count 0.
// =============================================================================

import { Star } from 'lucide-react';

/** The shared gold used for rating stars across the section library. */
export const STAR_COLOR = '#e6a619';

export type StarRowProps = {
  /** Number of filled stars (clamped 0–5). */
  count: number;
  size?: number;
  color?: string;
};

export function StarRow({ count, size = 16, color = STAR_COLOR }: StarRowProps) {
  const n = Math.max(0, Math.min(5, Math.round(count)));
  if (n === 0) return null;
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`${n} out of 5 stars`}
    >
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={size} color={color} fill={color} aria-hidden />
      ))}
    </span>
  );
}
