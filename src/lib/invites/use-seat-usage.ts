'use client';

// =============================================================================
// useClientSeatUsage — reactive seat usage for a client business.
//
// Subscribes to both stores that feed seat accounting: pending client invites
// and the seat-limit overrides. Re-renders whenever an invite is sent or the
// operator changes the limit.
//
// Snapshot discipline (CLAUDE.md): getClientSeatUsage builds a fresh object
// each call, which would spin useSyncExternalStore into an infinite loop. The
// snapshot is cached against a derived key so the reference only changes when
// the underlying counts actually change.
// =============================================================================

import { useSyncExternalStore } from 'react';

import { subscribeSeatLimits } from '@/lib/clients/seat-limit-stub';
import { subscribeClientInvites } from './client-invite-stub';
import { getClientSeatUsage, type SeatUsage } from './seats';

const SERVER_FALLBACK: SeatUsage = {
  usedByUsers: 0,
  usedByInvites: 0,
  total: 0,
  limit: null,
};

let cacheKey = '';
let cacheValue: SeatUsage = SERVER_FALLBACK;

function snapshotFor(clientId: string): SeatUsage {
  const usage = getClientSeatUsage(clientId);
  const key = `${clientId}|${usage.usedByUsers}|${usage.usedByInvites}|${usage.limit}`;
  if (key === cacheKey) return cacheValue;
  cacheKey = key;
  cacheValue = usage;
  return usage;
}

function subscribe(callback: () => void): () => void {
  const offInvites = subscribeClientInvites(callback);
  const offLimits = subscribeSeatLimits(callback);
  return () => {
    offInvites();
    offLimits();
  };
}

export function useClientSeatUsage(clientId: string): SeatUsage {
  return useSyncExternalStore(
    subscribe,
    () => snapshotFor(clientId),
    () => SERVER_FALLBACK,
  );
}
