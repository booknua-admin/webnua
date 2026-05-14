import type { CalendarClientTone } from '@/lib/calendar/types';

type BookingHistoryStatus = 'done' | 'scheduled';

type BookingHistoryItemCompact = {
  /** "15 April 2026" */
  date: string;
  /** "Smoke alarm hardwire (4 units) · $145 · 5★ review" */
  body: React.ReactNode;
};

type BookingHistoryItemGrid = {
  /** "Apr 29" — mono short label */
  date: string;
  title: string;
  price: string;
  status: BookingHistoryStatus;
  /** "✓ Done · ★★★★★" — optional override so a single row can carry a star rating */
  statusLabel?: string;
};

type BookingJobCell = {
  /** "SERVICES" — mono uppercase */
  label: string;
  /** "$220" or "Card · auto-bill on completion" — em segments render rust */
  value: React.ReactNode;
};

type BookingRailRow = {
  label: string;
  /** ReactNode so callers can pass rust accent / good ticks / star ratings */
  value: React.ReactNode;
  /** Rust-accent value (typed alias so stubs can stay declarative) */
  accent?: boolean;
};

type ClientBookingActionTone = 'primary' | 'secondary' | 'danger';

type ClientBookingAction = {
  icon: string;
  label: string;
  tone?: ClientBookingActionTone;
  href?: string;
};

type ClientBookingActionGroup = {
  heading: string;
  actions: ClientBookingAction[];
};

type ClientBookingDetail = {
  /** "// CALENDAR · WED MAY 13 · 13:00 — 15:00" */
  tag: string;
  /** "Ceiling fan + RCD <em>replacement</em>" */
  title: React.ReactNode;
  meta: {
    customer: string;
    suburb: string;
    price: string;
    duration: string;
  };
  /** "Scheduled · 2.5h away" */
  statusLabel: string;
  customer: {
    initial: string;
    name: string;
    /** Full contact line — `<strong>` segments render ink-bold */
    contact: React.ReactNode;
  };
  job: BookingJobCell[];
  notes: React.ReactNode;
  history: BookingHistoryItemCompact[];
  actions: ClientBookingActionGroup[];
  /** "// NEXT" tail card — explanatory text instead of buttons */
  nextNote?: React.ReactNode;
};

type AdminBookingDetail = {
  hero: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: React.ReactNode;
  };
  /** Border-left tint matches the calendar client tone */
  tone: CalendarClientTone;
  /** "Wed May 13 · <strong>9:00 — 11:00 AM</strong> · 2 hours" */
  timeRow: React.ReactNode;
  jobTitle: string;
  customer: {
    name: string;
    phone: string;
    suburb: string;
    clientPill: string;
  };
  details: BookingJobCell[];
  /** Customer notes — paper-bg left-rule box */
  notes: React.ReactNode;
  /** Section heading with the count, e.g. "// JOB HISTORY · 6 PREVIOUS" */
  historyHeading: string;
  history: BookingHistoryItemGrid[];
  customerValue: BookingRailRow[];
  location: {
    /** "12 Wellington St · Subiaco" */
    address: string;
  };
  automations: BookingRailRow[];
};

export type {
  AdminBookingDetail,
  BookingHistoryItemCompact,
  BookingHistoryItemGrid,
  BookingHistoryStatus,
  BookingJobCell,
  BookingRailRow,
  ClientBookingAction,
  ClientBookingActionGroup,
  ClientBookingActionTone,
  ClientBookingDetail,
};
