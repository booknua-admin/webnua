// =============================================================================
// signup/offer — the offer terms shown on the final signup screen.
//
// One place for the numbers so the splash, guarantee card and offer stack
// can't drift apart. Tune freely — these are deliberately not env vars.
// =============================================================================

export const CURRENCY = '€';

/** Flat monthly price after the build goes live. */
export const MONTHLY_PRICE = 347;

/** Setup fee — waived while the countdown runs. */
export const SETUP_FEE = 997;

/** Final-screen urgency window, in seconds. */
export const COUNTDOWN_SECONDS = 180;

export function formatMoney(amount: number): string {
  return `${CURRENCY}${Math.round(amount).toLocaleString('en-IE')}`;
}
