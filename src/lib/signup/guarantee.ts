// =============================================================================
// signup/guarantee — the lead-guarantee estimator behind the cold-traffic
// signup flow.
//
// The guarantee is a real contract: "N qualified leads/month, or we work free
// until you get them" — conditional on the prospect maintaining the
// recommended ad spend (€15–25 per guaranteed lead, paid to the ad platform).
//
// Two passes:
//   - 'base'      — shown after trade + area (the first splash).
//   - 'optimised' — shown after the business brief (the second splash). It is
//                   ALWAYS ≥ the base figure — the number can rise, never fall.
//
// Benchmarks are seeded from Webnua's own campaign figures and are meant to be
// tuned over time. They live here as one editable table.
// =============================================================================

export type TradeId =
  | 'electrician'
  | 'plumber'
  | 'hvac'
  | 'landscaping'
  | 'cleaning'
  | 'roofing'
  | 'painting'
  | 'pest-control'
  | 'locksmith'
  | 'general';

export type TradeBenchmark = {
  id: TradeId;
  label: string;
  /** Qualified leads/month guaranteed from a standard build. */
  leadsBase: number;
  /** Qualified leads/month once the business brief sharpens targeting. */
  leadsOptimised: number;
  /** Webnua campaigns this trade's benchmark draws from — used in splash copy. */
  sampleSize: number;
};

export const TRADE_BENCHMARKS: Record<TradeId, TradeBenchmark> = {
  electrician: {
    id: 'electrician',
    label: 'Electrician',
    leadsBase: 19,
    leadsOptimised: 28,
    sampleSize: 42,
  },
  plumber: {
    id: 'plumber',
    label: 'Plumber',
    leadsBase: 21,
    leadsOptimised: 31,
    sampleSize: 48,
  },
  hvac: {
    id: 'hvac',
    label: 'Heating & cooling',
    leadsBase: 17,
    leadsOptimised: 25,
    sampleSize: 33,
  },
  landscaping: {
    id: 'landscaping',
    label: 'Landscaping',
    leadsBase: 16,
    leadsOptimised: 24,
    sampleSize: 29,
  },
  cleaning: {
    id: 'cleaning',
    label: 'Cleaning',
    leadsBase: 23,
    leadsOptimised: 34,
    sampleSize: 51,
  },
  roofing: {
    id: 'roofing',
    label: 'Roofing',
    leadsBase: 14,
    leadsOptimised: 21,
    sampleSize: 26,
  },
  painting: {
    id: 'painting',
    label: 'Painting & decorating',
    leadsBase: 18,
    leadsOptimised: 27,
    sampleSize: 31,
  },
  'pest-control': {
    id: 'pest-control',
    label: 'Pest control',
    leadsBase: 20,
    leadsOptimised: 29,
    sampleSize: 24,
  },
  locksmith: {
    id: 'locksmith',
    label: 'Locksmith',
    leadsBase: 15,
    leadsOptimised: 22,
    sampleSize: 19,
  },
  general: {
    id: 'general',
    label: 'Other trade',
    leadsBase: 17,
    leadsOptimised: 25,
    sampleSize: 120,
  },
};

export const TRADE_OPTIONS: TradeBenchmark[] = Object.values(TRADE_BENCHMARKS);

/** Recommended ad spend per guaranteed lead — paid to the ad platform, not to
 *  Webnua. Tune these as real campaign data accumulates. */
export const LEAD_COST_MIN = 15;
export const LEAD_COST_MAX = 25;

export type GuaranteeEstimate = {
  /** Qualified leads/month guaranteed. */
  leads: number;
  /** Recommended monthly ad-spend floor (leads × min cost-per-lead). */
  adSpendMin: number;
  /** Recommended monthly ad-spend ceiling (leads × max cost-per-lead). */
  adSpendMax: number;
  /** Webnua campaign sample size for this trade — splash copy. */
  sampleSize: number;
};

export function estimateGuarantee(
  trade: TradeId,
  pass: 'base' | 'optimised',
): GuaranteeEstimate {
  const benchmark = TRADE_BENCHMARKS[trade] ?? TRADE_BENCHMARKS.general;
  const leads =
    pass === 'optimised' ? benchmark.leadsOptimised : benchmark.leadsBase;

  return {
    leads,
    adSpendMin: leads * LEAD_COST_MIN,
    adSpendMax: leads * LEAD_COST_MAX,
    sampleSize: benchmark.sampleSize,
  };
}

export function tradeLabel(trade: TradeId | ''): string {
  if (!trade) return 'your trade';
  return (TRADE_BENCHMARKS[trade] ?? TRADE_BENCHMARKS.general).label;
}
