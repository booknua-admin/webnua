import type { ReactNode } from 'react';

/** A single stat tile on the agency dashboard. */
export type DashboardStat = {
  label: string;
  value: ReactNode;
  trend?: string;
  trendTone?: 'good' | 'quiet';
};

/** Colour-keyed tone for attention rows + client status. */
export type AgencyTone = 'rust' | 'good' | 'quiet';

/** The single most pressing cross-client signal — rendered as the ink banner
 *  atop the agency dashboard. Null when nothing needs the operator now. */
export type AgencyUrgent = {
  tag: string;
  title: ReactNode;
  description: ReactNode;
  cta: { label: string; href: string };
};

/** One row inside an attention panel. */
export type AttentionRow = {
  id: string;
  initial: string;
  title: string;
  meta: string;
  metaTone?: AgencyTone;
  href?: string;
};

/** One of the three triage panels. When `placeholder` is set the panel shows
 *  an honest "awaiting integration" notice in place of rows. */
export type AttentionPanelData = {
  heading: string;
  count: number | null;
  link?: { label: string; href: string };
  rows: AttentionRow[];
  placeholder?: string;
};

/** A horizontally-scrolling client-performance card. */
export type ClientPerformanceCardData = {
  slug: string;
  initial: string;
  name: string;
  meta: string;
  leads7d: number | null;
  booked7d: number | null;
  spend: string;
  statusLabel: string;
  statusTone: AgencyTone;
  note: string;
  /** Sort rank — 0 at-risk live, 1 healthy live, 2 onboarding. */
  rank: number;
};
