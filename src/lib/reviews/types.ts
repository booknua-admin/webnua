import type { ReactNode } from 'react';

/** Single Google review. `variant` switches between the client-screen-6 row
 *  (full avatar + job + quote + stars + age) and the admin-screen-12 compact
 *  recent-review list inside a per-client card. */
export type ReviewItem = {
  id: string;
  /** Used by both variants for the avatar + the strong-name prefix. */
  authorName: string;
  /** Initials shown on the avatar (full variant only). */
  authorInitials?: string;
  /** Optional job descriptor — e.g. "ceiling fan install". Full variant only. */
  job?: string;
  /** Quote body. The compact variant truncates to 2 lines via line-clamp. */
  text: string;
  /** 1–5. Rendered as N filled stars. */
  stars: number;
  /** "14m" / "2d" / "3 DAYS AGO" etc. Mono uppercase rhythm. */
  age: string;
};

/** Numeric distribution row for the 5★ → 1★ horizontal bar chart on
 *  client `/reviews`. `pct` is 0–100. */
export type ReviewDistributionRow = {
  stars: number;
  count: number;
  pct: number;
};

/** Big rating headline reused on client `/reviews` AND inside admin
 *  per-client cards (sized down via the component's `size` prop). */
export type ReviewSummaryData = {
  /** Inter Tight value, ReactNode so `<em>` can render rust on the star glyph. */
  rating: ReactNode;
  /** Pre-rendered star row, e.g. "★ ★ ★ ★ ★". */
  starsLabel: string;
  /** Mono uppercase meta line, e.g. "7 REVIEWS · 14 DAYS". */
  meta: string;
};

/** Single mini stat inside an admin per-client card. */
export type ReviewMiniStat = {
  label: string;
  value: string;
};

/** Either a real per-client card OR the "not yet connected" empty state. */
export type ReviewClientCardData =
  | {
      kind: 'connected';
      id: string;
      logoInitial: string;
      clientName: string;
      /** Mono uppercase meta, e.g. "PERTH · 268 TOTAL REVIEWS". */
      meta: string;
      summary: ReviewSummaryData;
      stats: ReviewMiniStat[];
      recentLabel: string;
      recent: ReviewItem[];
    }
  | {
      kind: 'empty';
      id: string;
      logoInitial: string;
      clientName: string;
      meta: string;
      emptyDescription: string;
      cta: { label: string; href: string };
    };

/** Ink-bg "Asked, not begged" callout on the right of the client summary row. */
export type ReviewCalloutData = {
  /** ReactNode — `<em>` renders rust-light on ink. */
  headline: ReactNode;
  sub: string;
  link: { label: string; href: string };
};

/** Top-level client `/reviews` stub. */
export type ClientReviewsPage = {
  hero: {
    eyebrow: string;
    title: ReactNode;
    subtitle: ReactNode;
  };
  summary: ReviewSummaryData;
  distribution: ReviewDistributionRow[];
  callout: ReviewCalloutData;
  listHeader: ReactNode;
  listAside: string;
  reviews: ReviewItem[];
};

/** Top-level admin `/reviews` stub. */
export type AdminReviewsPage = {
  hero: {
    eyebrow: string;
    title: ReactNode;
    subtitle: ReactNode;
  };
  filters: { id: string; label: string; count?: number }[];
  defaultFilterId: string;
  /** Drives 4-up `StatCard` row (reuses the existing primitive). */
  stats: {
    label: string;
    value: ReactNode;
    trend?: ReactNode;
    trendTone?: 'good' | 'quiet';
  }[];
  clientCards: ReviewClientCardData[];
};

/** Admin Screen 24 negative-review modal. */
export type NegativeReviewActionData = {
  id: string;
  num: string;
  title: string;
  sub: string;
  recommended?: boolean;
};

export type NegativeReviewQuoteData = {
  /** Pre-rendered, e.g. "★★ ☆ ☆ ☆ · 2 stars". */
  starsLabel: string;
  /** Quote body (no surrounding quotes — added by the component). */
  text: string;
  /** ReactNode meta, e.g. <>— <strong>Jamie K.</strong> · KeyHero · job #4821 · received <strong>4 minutes ago</strong></>. */
  meta: ReactNode;
};

export type NegativeReviewModalData = {
  /** Trigger button label (e.g. "Show alert"). Lives on admin /reviews. */
  triggerLabel: string;
  tag: string;
  title: ReactNode;
  subtitle: ReactNode;
  quote: NegativeReviewQuoteData;
  actionsLabel: string;
  actions: NegativeReviewActionData[];
  footerInfo: ReactNode;
  dismissLabel: string;
  callLabel: string;
};
