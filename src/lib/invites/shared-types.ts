// =============================================================================
// Invite primitives shared between the operator-side team invite (lib/team)
// and the client-side teammate invite (lib/invites/client-invite).
//
// Deliberately just the genuinely-common pieces — the invite RECORDS diverge
// enough to stay clean siblings (no Webnua-org role on the client side; single
// clientId not assignedClientIds[]; client-user inviter not operator inviter).
// What IS common: the lifecycle status union and the timestamp/link
// conventions every invite record obeys.
// =============================================================================

// Full invite lifecycle. Only `pending` is reachable in the stub layer — the
// other three are declared now so the backend doesn't widen the type later.
//  accepted: magic link used. expired: TTL window elapsed.
//  revoked: the inviter cancelled before acceptance.
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// Shared invite conventions, documented as a type so both siblings reference
// the same contract:
//  - all timestamps are ISO 8601 strings (invitedAt, expiresAt, …)
//  - the magic link is a fully-qualified URL string emailed to the invitee
// These are not enforced at the type level (both are `string`) — the alias
// names carry the convention.
export type IsoTimestamp = string;
export type MagicLink = string;

// Standard invite time-to-live. The magic link stops working after this.
export const INVITE_TTL_DAYS = 7;
