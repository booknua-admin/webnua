// =============================================================================
// Client identity tones — per-client solid identity colours used wherever a
// surface needs to colour-key a client: calendar booking pills, the calendar
// legend swatches, the today-panel left borders, the admin booking-hero
// border, the automations cross-client mini-rows.
//
// These are SOLID hex values (not Webnua palette tokens) because they are
// per-client brand identities, not design-system colours — `voltline` is the
// one exception, it rides the brand rust. The hex lives here once; every
// consuming surface imports from this file rather than re-declaring the map.
//
// `ClientTone` is the superset vocabulary. Feature modules keep their own
// narrower tone unions (`CalendarClientTone`, `AutomationClientTone`) — a
// narrower value still indexes this wider record fine. Same shape as the
// shared-types-with-aliases pattern in lib/invites. The muted pill-tint
// vocabularies (`LeadClientTone`, `AdminTicketClientTone`) are deliberately
// NOT folded in here — same family, different vocabulary (background-tint
// vs solid identity).
//
// Pre-composed per Tailwind utility (`bg-*` vs `border-l-*`) because Tailwind
// arbitrary-value classes can't be built from runtime strings — the literal
// class names must appear in source for the JIT to generate them.
// =============================================================================

export type ClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'neatworks'
  | 'flowline'
  | 'generic';

export const CLIENT_TONE_BG: Record<ClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#4a7ba6]',
  keyhero: 'bg-[#8a5cb8]',
  neatworks: 'bg-[#2d8a4e]',
  flowline: 'bg-rust-light',
  generic: 'bg-ink',
};

export const CLIENT_TONE_BORDER_L: Record<ClientTone, string> = {
  voltline: 'border-l-rust',
  freshhome: 'border-l-[#4a7ba6]',
  keyhero: 'border-l-[#8a5cb8]',
  neatworks: 'border-l-[#2d8a4e]',
  flowline: 'border-l-rust-light',
  generic: 'border-l-ink',
};
