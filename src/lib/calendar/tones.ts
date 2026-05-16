// =============================================================================
// Calendar client tones — per-client identity colours for calendar surfaces:
// booking pills, the today panel, the admin booking-hero border, the legend
// swatches.
//
// These are solid hex values (not Webnua palette tokens) because they are
// per-client brand identities, not design-system colours — `voltline` is the
// one exception, it rides the brand rust. The hex lives here once; every
// calendar/booking surface imports from this file rather than re-declaring
// the map (the trigger the `CalendarClientTone` parked decision called out).
//
// Pre-composed per Tailwind utility (`bg-*` vs `border-l-*`) because Tailwind
// arbitrary-value classes can't be built from runtime strings — the literal
// class names must appear in source for the JIT to generate them.
// =============================================================================

import type { CalendarClientTone } from './types';

export const CALENDAR_TONE_BG: Record<CalendarClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#4a7ba6]',
  keyhero: 'bg-[#8a5cb8]',
  neatworks: 'bg-[#2d8a4e]',
  generic: 'bg-ink',
};

export const CALENDAR_TONE_BORDER_L: Record<CalendarClientTone, string> = {
  voltline: 'border-l-rust',
  freshhome: 'border-l-[#4a7ba6]',
  keyhero: 'border-l-[#8a5cb8]',
  neatworks: 'border-l-[#2d8a4e]',
  generic: 'border-l-ink',
};
