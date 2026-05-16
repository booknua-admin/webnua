// =============================================================================
// Team-invite data shapes — the org-structure decisions an operator makes when
// adding a teammate to the workspace.
//
// Vision §7: each invite is a discrete, attributable record. The stub shape
// committed here is the schema contract the backend pass inherits — every
// field must be producible from real DB rows + lookups with no narrative
// interpretation. (Same discipline as lib/dashboard/client-hub.ts.)
// =============================================================================

import type { TeamRole } from './roles';

// Full machine union. Only `pending` is reachable in the stub layer — the
// other three are declared now so the backend doesn't have to widen the type
// later. accepted: magic link used. expired: 7-day window elapsed.
// revoked: operator cancelled before acceptance.
export type TeamInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// The mutable form state while the operator fills out the 3-step modal.
// Not a persisted record — `TeamInvite` is what gets committed on send.
export type TeamInviteDraft = {
  email: string;
  fullName: string;
  role: TeamRole;
  /** Client business ids this invitee may access. References AdminClient.id.
   *  Operators/owners see every client; junior operators are scoped to this
   *  explicit list. Empty for owner/operator roles. */
  assignedClientIds: string[];
  /** Verbatim operator-written note shown in the invite email + first login.
   *  Free text is fine here — it is captured user input, not generated prose. */
  personalNote: string;
};

// The committed invite record. One discrete event per send.
export type TeamInvite = TeamInviteDraft & {
  id: string;
  /** Operator user id who issued the invite. An invite without this is
   *  unattributable — non-negotiable per vision §7. */
  invitedBy: string;
  /** ISO 8601 timestamp the invite was issued. */
  invitedAt: string;
  /** ISO 8601 timestamp the magic link stops working. */
  expiresAt: string;
  /** The magic-link URL emailed to the invitee. */
  magicLink: string;
  status: TeamInviteStatus;
};
