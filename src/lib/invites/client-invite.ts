// =============================================================================
// Client-side teammate invite — the record a client (business owner) creates
// when adding a user into their own client account.
//
// Sibling of lib/team/types.ts `TeamInvite`, NOT a generalization of it. The
// dimensions genuinely differ:
//   - no Webnua-org role (operator/owner/junior) — every client invitee gets
//     the flat CLIENT_DEFAULTS floor; per-website edit grants stay an operator
//     concern via /settings/access
//   - a single fixed `clientId`, not an `assignedClientIds[]` list
//   - the inviter is a client user, not an operator
//   - different RLS / lifecycle when the backend lands
// Two clean siblings beat one record with conditional optional fields.
//
// Vision §7: each invite is a discrete, attributable record. The stub shape
// here is the schema contract the backend pass inherits — every field must be
// producible from real DB rows + lookups with no narrative interpretation.
// =============================================================================

import type { InviteStatus, IsoTimestamp, MagicLink } from './shared-types';

// Mutable form state while the client owner fills out the invite modal.
// Not a persisted record — `ClientUserInvite` is what gets committed on send.
export type ClientUserInviteDraft = {
  email: string;
  /** Optional — the invitee can set their own name on first login. */
  fullName: string;
  /** Optional welcome note shown in the invite email + first login. Free text
   *  is fine — it is captured user input, not generated prose. */
  personalNote: string;
};

// The committed invite record. One discrete event per send.
export type ClientUserInvite = {
  id: string;
  email: string;
  fullName: string;
  /** The client business the invitee joins. References AdminClient.id. Fixed
   *  to the inviter's own client — a client owner cannot invite elsewhere. */
  clientId: string;
  /** Client user id who issued the invite. An invite without this is
   *  unattributable — non-negotiable per vision §7. */
  invitedBy: string;
  invitedAt: IsoTimestamp;
  /** When the magic link stops working. */
  expiresAt: IsoTimestamp;
  magicLink: MagicLink;
  status: InviteStatus;
  /** Verbatim inviter-written note, or null when none was given. */
  personalNote: string | null;
};
