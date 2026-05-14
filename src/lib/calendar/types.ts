type CalendarClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'neatworks'
  | 'generic';

type CalendarBookingStatus = 'scheduled' | 'in_progress' | 'completed';

const CALENDAR_BOOKING_STATUS_LABEL: Record<CalendarBookingStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
};

type CalendarBooking = {
  id: string;
  /** Display label like "9:00 — 10:30" */
  time: string;
  title: string;
  customer: string;
  /** Vertical px offset inside the day column. 7am = 0, each hour = 50px */
  top: number;
  /** Height in px. 1 hour = 50px */
  height: number;
  /** Admin variant uses this to tint the pill. Client variant ignores. */
  tone?: CalendarClientTone;
  /** Where clicking the pill should navigate (booking detail) */
  href?: string;
};

type CalendarDay = {
  id: string;
  /** "MON" / "WED · TODAY" */
  name: string;
  /** "11" */
  num: string;
  isToday?: boolean;
  bookings: CalendarBooking[];
  /** Optional "now" line position in px from top of day column */
  nowTopPx?: number;
  /** Label for the now line, e.g. "NOW · 10:35" */
  nowLabel?: string;
};

type CalendarWeek = {
  /** "// PERTH" / "// LOCAL" — shown in the day-headers corner */
  cornerLabel: string;
  /** "Week of May 11 — May 16, 2026" where the date can be highlighted */
  periodLabel: React.ReactNode;
  /** 7am, 8am, … 18:00 */
  timeSlots: string[];
  days: CalendarDay[];
};

type CalendarClientFilter = {
  id: string;
  label: string;
  count?: number;
};

type CalendarLegendItem = {
  label: string;
  tone: CalendarClientTone;
};

type CalendarTodayJob = {
  id: string;
  time: string;
  /** Single-letter client logo (F / K / V / N) */
  logoInitial: string;
  /** Bold title segment, e.g. "Fortnightly · 3-bed" */
  title: string;
  /** Customer · suburb */
  customer: string;
  status: CalendarBookingStatus;
  tone: CalendarClientTone;
  href?: string;
};

type CalendarTodayPanel = {
  /** "Today · Wednesday May 13" */
  heading: string;
  /** "4 jobs · 3 done · 1 pending" — strong segments render rust */
  meta: React.ReactNode;
  jobs: CalendarTodayJob[];
};

type CalendarHero = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
};

type ClientCalendar = {
  hero: CalendarHero;
  week: CalendarWeek;
};

type AdminCalendar = {
  hero: CalendarHero;
  filters: CalendarClientFilter[];
  legend: CalendarLegendItem[];
  /** Right-aligned summary text on the legend row, e.g. "28 bookings · 11 today" */
  legendMeta: React.ReactNode;
  week: CalendarWeek;
  today: CalendarTodayPanel;
};

export { CALENDAR_BOOKING_STATUS_LABEL };
export type {
  AdminCalendar,
  CalendarBooking,
  CalendarBookingStatus,
  CalendarClientFilter,
  CalendarClientTone,
  CalendarDay,
  CalendarHero,
  CalendarLegendItem,
  CalendarTodayJob,
  CalendarTodayPanel,
  CalendarWeek,
  ClientCalendar,
};
