// =============================================================================
// STUB — client teammate-invite store.
//
// localStorage-backed list of ClientUserInvite records, keyed under one blob.
// Pending invites count against the client's seat limit (see ./seats.ts), so
// this store is read by the seat-check helper as well as the Team tab.
//
// When real auth ships, replaced by a Supabase INSERT + reads against a
// `client_user_invites` table; the accessor surface (addClientInvite /
// getInvitesForClient / subscribeClientInvites) keeps its shape.
//
// Snapshot discipline (CLAUDE.md): getSnapshot must be reference-stable, so
// the parsed list is cached keyed on the raw localStorage string.
// =============================================================================

import type { ClientUserInvite } from './client-invite';

const STORE_KEY = 'webnua.dev.client-invites';
const CHANGE_EVENT = 'webnua:client-invites-change';

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

// Cache keyed on the raw string so repeated getSnapshot calls return the same
// array reference until the underlying store actually changes.
let cacheRaw: string | null = null;
let cacheValue: ClientUserInvite[] = [];

function parse(raw: string | null): ClientUserInvite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ClientUserInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** All client invites in the store, newest-first. Reference-stable per raw string. */
export function getAllClientInvites(): ClientUserInvite[] {
  const raw = safeRead();
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  cacheValue = parse(raw);
  return cacheValue;
}

/** Pending invites for one client business. */
export function getInvitesForClient(clientId: string): ClientUserInvite[] {
  return getAllClientInvites().filter(
    (inv) => inv.clientId === clientId && inv.status === 'pending',
  );
}

/** Append one invite record and notify subscribers. */
export function addClientInvite(invite: ClientUserInvite): void {
  try {
    const next = [invite, ...getAllClientInvites()];
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

export function subscribeClientInvites(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
