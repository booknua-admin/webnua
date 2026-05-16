// =============================================================================
// Seat accounting — the bridge between the seat limit (a contract axis) and
// the client invite flow (which enforces it).
//
// A client's seat usage is derived, never stored: existing client users +
// pending invites. Pending invites count so the limit can't be gamed by
// bulk-inviting before anyone accepts.
//
// `canInviteToClient` backs both the modal's Continue gate (disable + show
// reason) and the send handler (final guard before committing the record).
// =============================================================================

import { getUserDefsForClient } from '@/lib/auth/user-stub';
import { getSeatLimit } from '@/lib/clients/seat-limit-stub';
import { getInvitesForClient } from './client-invite-stub';

export type SeatUsage = {
  /** Accepted client users belonging to this client business. */
  usedByUsers: number;
  /** Pending invites — count against the limit until accepted/expired. */
  usedByInvites: number;
  /** usedByUsers + usedByInvites. */
  total: number;
  /** Effective seat limit, or null when unconfigured (uncapped). */
  limit: number | null;
};

// Reasons an invite can be blocked. Union kept open for future contract gates
// (client suspended, plan downgraded, …) — only seat_limit_reached today.
export type InviteBlockReason = 'seat_limit_reached';

export type InviteEligibility = {
  allowed: boolean;
  reason?: InviteBlockReason;
};

/** Current seat usage for a client business. */
export function getClientSeatUsage(clientId: string): SeatUsage {
  const usedByUsers = getUserDefsForClient(clientId).length;
  const usedByInvites = getInvitesForClient(clientId).length;
  return {
    usedByUsers,
    usedByInvites,
    total: usedByUsers + usedByInvites,
    limit: getSeatLimit(clientId),
  };
}

/** Whether the client may issue another invite right now. */
export function canInviteToClient(clientId: string): InviteEligibility {
  const { total, limit } = getClientSeatUsage(clientId);
  // null limit = unconfigured = uncapped.
  if (limit !== null && total >= limit) {
    return { allowed: false, reason: 'seat_limit_reached' };
  }
  return { allowed: true };
}
