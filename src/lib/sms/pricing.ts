// =============================================================================
// SMS pricing — the per-segment cost used for estimates and the cost_eur
// column on sms_messages.
//
// V1 is a single flat per-segment rate. Twilio's real per-segment price varies
// by destination country and carrier; €0.05 is a representative Ireland /
// UK transactional-SMS rate and is good enough for the operator-facing
// estimate ("~€0.05/send") and the recorded cost. It is intentionally a code
// constant, not env config or a table — when real per-country pricing matters
// (volume, multiple destination countries), replace this with a rate lookup;
// until then a single honest estimate beats a fake-precise model.
//
// SERVER + CLIENT safe — pure, no imports.
// =============================================================================

/** Estimated cost of one SMS segment, in EUR. */
export const SMS_SEGMENT_COST_EUR = 0.05;

/** The cost of a message with `segments` segments, in EUR. */
export function segmentCost(segments: number): number {
  return Math.round(segments * SMS_SEGMENT_COST_EUR * 10000) / 10000;
}

/** Format an EUR amount as a "~€0.05" estimate label. */
export function formatSmsCost(eur: number): string {
  return `~€${eur.toFixed(2)}`;
}
