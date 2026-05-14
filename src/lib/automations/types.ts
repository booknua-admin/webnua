import type { ReactNode } from 'react';

/**
 * Client-tone vocabulary for automation rows. Matches the same slugs used
 * across leads / tickets / calendar so a workspace-wide tone map can be
 * applied later. Solid-tone background colours come from
 * `lib/automations/tones.ts` (mirrors the prototype's per-client swatches).
 */
export type AutomationClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'neatworks'
  | 'flowline'
  | 'generic';

export type AutomationStatTone = 'default' | 'accent';

export type AutomationStat = {
  label: string;
  /** ReactNode so `<em>` can render rust on the value. */
  value: ReactNode;
  tone?: AutomationStatTone;
};

/**
 * The client-screen-5 card. Header + 4-tile stats (when enabled) + toggle.
 * Disabled state hides the stats grid entirely.
 */
export type AutomationStatsCard = {
  id: string;
  tag: string;
  title: string;
  description: ReactNode;
  enabled: boolean;
  /** Optional href — currently unused on client view (read-only). */
  href?: string;
  /** 4 stat tiles. Omitted when `enabled === false`. */
  stats?: AutomationStat[];
};

/**
 * The admin-screen-10 mini-row. A single client's flow within a group.
 */
export type AutomationFlowMini = {
  id: string;
  clientInitial: string;
  clientName: string;
  /** e.g. "3 steps · SMS / email / SMS · click to edit" */
  flowName: string;
  clientTone?: AutomationClientTone;
  enabled: boolean;
  /** 3 stat tiles. When `enabled === false`, render "—" placeholders so the columns line up. */
  stats: AutomationStat[];
  /** Set on rows that click through to the editor (admin Screen 17). */
  href?: string;
};

/**
 * The admin-screen-10 grouped view. One group per automation type.
 */
export type AutomationGroup = {
  id: string;
  /** The display title, e.g. "24-hour follow-up sequence". */
  title: string;
  /** e.g. "3 / 4" — active count over total configured. */
  countBadge: string;
  /** e.g. "3 active · 34% reply rate". `<strong>` renders ink-bold. */
  meta: ReactNode;
  flows: AutomationFlowMini[];
};

/**
 * Top-level hero copy. Both roles share the shape; admin adds workspace stats.
 */
export type AutomationsHero = {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
};

/**
 * Workspace-stat row on the admin list. Reuses the existing `StatCard` shape.
 */
export type AutomationsWorkspaceStat = {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: 'good' | 'quiet';
};

export type ClientAutomations = {
  hero: AutomationsHero;
  banner: ReactNode;
  cards: AutomationStatsCard[];
};

export type AdminAutomations = {
  hero: AutomationsHero;
  /** Filter chip set, shape-compatible with `shared/FilterChips`. */
  filters: { id: string; label: string; count?: number }[];
  defaultFilterId: string;
  stats: AutomationsWorkspaceStat[];
  groups: AutomationGroup[];
};
