// =============================================================================
// signup/splash-copy — the rotating analysis lines for the two splash screens.
//
// The splashes are paced theatre, but every line maps to something the flow
// genuinely uses (the trade benchmark, the area, the brief). Keep them honest.
// =============================================================================

/** Splash 1 — runs after trade + area, before the first guarantee. */
export function splashOneLines(
  tradeLabel: string,
  area: string,
  sampleSize: number,
): string[] {
  return [
    `Analysing cost-per-lead across ${sampleSize} ${tradeLabel.toLowerCase()} campaigns…`,
    `Checking customer demand in ${area}…`,
    `Building your lead-capture system…`,
    `Calculating your guaranteed lead volume…`,
  ];
}

/** Splash 2 — runs after the business brief, before the bigger guarantee. */
export function splashTwoLines(business: string, area: string): string[] {
  return [
    `Analysing ${business || 'your business'}…`,
    `Matching your offer to demand in ${area}…`,
    `Putting the finishing touches on your lead system…`,
    `Finalising your guarantee…`,
  ];
}
