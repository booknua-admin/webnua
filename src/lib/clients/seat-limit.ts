// =============================================================================
// Seat-limit decision data — the per-client cap on how many users the client's
// plan permits.
//
// A seat limit is a contract/plan axis (how many users), distinct from the
// capability axis (what users can do — /settings/access). Every CHANGE to the
// limit is itself an attributable event, not just an overwritten current value
// (vision §7) — `SeatLimitChange` is that event, history is an array of them.
//
// Stub-becomes-schema-contract: every field is producible from real DB rows
// + lookups with no narrative interpretation.
// =============================================================================

// One discrete seat-limit change. `null` on either side means "unconfigured /
// uncapped" — a client can go from uncapped → capped, capped → uncapped, or
// capped → a different number.
export type SeatLimitChange = {
  /** Operator user id who changed the limit. */
  changedBy: string;
  /** ISO 8601 timestamp of the change. */
  changedAt: string;
  /** The client business this change applies to. References AdminClient.id. */
  clientId: string;
  previousLimit: number | null;
  newLimit: number | null;
};
