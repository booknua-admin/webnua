import type { ReactNode } from 'react';

export type FunnelStepThumbVariant = 'landing' | 'schedule' | 'thanks';

export type FunnelStepTone = 'first' | 'middle' | 'last';

export type FunnelStepFootRow = { label: string; value: string };

export type FunnelStep = {
  id: string;
  position: number;
  positionLabel: string;
  tone: FunnelStepTone;
  thumb: FunnelStepThumbVariant;
  name: string;
  url: string;
  metricNum: ReactNode;
  metricLabel: string;
  foot: FunnelStepFootRow[];
};

export type FunnelArrow = {
  id: string;
  pct: string;
  dropLabel: ReactNode;
};

export type FunnelPeriod = '7d' | '14d' | '30d' | '90d';

export const FUNNEL_PERIOD_LABEL: Record<FunnelPeriod, string> = {
  '7d': '7D',
  '14d': '14D',
  '30d': '30D',
  '90d': '90D',
};

export type FunnelInsightTone = 'warn' | 'good' | 'info';

export type FunnelInsight = {
  id: string;
  tone: FunnelInsightTone;
  glyph: string;
  body: ReactNode;
  meta: string;
};

export type FunnelVersion = {
  id: string;
  label: string;
  current?: boolean;
  body: ReactNode;
  meta: string;
  when: string;
};

export type FunnelHeroMeta = { label: string; value: ReactNode };

export type FunnelAggMetric = {
  num: ReactNode;
  label: string;
  trend?: string;
};

export type FunnelAggBottom = { left: ReactNode; right: ReactNode };

export type FunnelDetail = {
  id: string;
  back: { label: string; href: string };
  hero: {
    tag: string;
    title: ReactNode;
    subtitle: ReactNode;
    meta: FunnelHeroMeta[];
    versionLabel: string;
    actions: {
      viewLiveLabel: string;
      viewLiveHref: string;
      requestChangeLabel: string;
      requestChangeHref: string;
    };
  };
  agg: {
    label: string;
    live: boolean;
    metrics: [FunnelAggMetric, FunnelAggMetric];
    bottom: FunnelAggBottom;
  };
  flow: {
    title: ReactNode;
    defaultPeriod: FunnelPeriod;
    periods: FunnelPeriod[];
  };
  steps: FunnelStep[];
  arrows: FunnelArrow[];
  insights: {
    title: ReactNode;
    subtitle: ReactNode;
    items: FunnelInsight[];
  };
  history: {
    title: ReactNode;
    subtitle: ReactNode;
    items: FunnelVersion[];
    ctaLabel: string;
    ctaHref: string;
  };
};
