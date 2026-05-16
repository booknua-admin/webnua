import { cn } from '@/lib/utils';

// =============================================================================
// Ink-hero styling recipe — CLAUDE.md parked decision, resolved Cluster 6 · 1a.
//
// Six ink-bg hero components exist (IntegrationProgressHero, BillingPlanCard,
// TicketsHero, LeadsHero, IntegrationMatrixHero, FunnelHero). Only three share
// the canonical `[tag][headline][subtitle] | [side]` structure — the other
// three diverge (progress bar / plan-meta / back-link + agg card). A unified
// `InkHero` component would be an optional-slot grab-bag, so the verdict is:
// consolidate the shared *chrome* as a styling recipe, not a component.
//
// New ink heroes compose these helpers; existing ones adopt them opportunis-
// tically when next touched (no churn-migration of shipped surfaces).
// =============================================================================

/** The ink-bg hero surface — rounded ink panel, paper text, standard padding. */
export function inkHeroSurface(className?: string): string {
  return cn('rounded-2xl bg-ink px-7 py-6 text-paper', className);
}

/** The rust mono-pill tag that sits in an ink hero's top-left corner. */
export const INK_HERO_TAG_CLASS =
  'inline-block rounded-full border border-rust/40 bg-rust/[0.18] ' +
  'px-2.5 py-1 font-mono text-[10px] font-semibold uppercase ' +
  'tracking-[0.1em] text-rust-light';
