// =============================================================================
// client-invite store — in-memory cache hydrated from Supabase.
//
// Reads pending `client_user_invites` rows; writes INSERT new rows.
// Snapshot discipline (CLAUDE.md): getAllClientInvites() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientSlugByUuid, getClientUuidBySlug } from '@/lib/clients/clients-store';
import type { ClientUserInvite } from './client-invite';

const CHANGE_EVENT = 'webnua:client-invites-change';

// --- In-memory cache ---------------------------------------------------------

let cache: ClientUserInvite[] = [];
let version = 0;
let snapshotVersion = -1;
let snapshotValue: ClientUserInvite[] = [];

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydrateClientInvites(): Promise<void> {
  const { data, error } = await supabase
    .from('client_user_invites')
    .select('id, email, full_name, client_id, invited_by, invited_at, expires_at, magic_link, status, personal_note')
    .eq('status', 'pending');

  if (error) {
    console.error('[client-invites] hydrate failed:', normalizeError(error).message);
    return;
  }

  cache = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    email: row.email as string,
    fullName: row.full_name as string,
    // Translate UUID → slug for the public clientId surface.
    clientId: getClientSlugByUuid(row.client_id as string) ?? (row.client_id as string),
    invitedBy: row.invited_by as string,
    invitedAt: row.invited_at as string,
    expiresAt: row.expires_at as string,
    magicLink: row.magic_link as string,
    status: row.status as ClientUserInvite['status'],
    personalNote: row.personal_note as string | null,
  }));

  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** All client invites in the store, newest-first. Reference-stable. */
export function getAllClientInvites(): ClientUserInvite[] {
  if (version === snapshotVersion) return snapshotValue;
  snapshotVersion = version;
  snapshotValue = [...cache];
  return snapshotValue;
}

/** Pending invites for one client business (clientId = slug). */
export function getInvitesForClient(clientId: string): ClientUserInvite[] {
  return getAllClientInvites().filter(
    (inv) => inv.clientId === clientId && inv.status === 'pending',
  );
}

// --- Writes ------------------------------------------------------------------

/** Append one invite record and notify subscribers. Optimistic + Supabase INSERT. */
export function addClientInvite(invite: ClientUserInvite): void {
  cache = [invite, ...cache];
  dispatch();

  const clientUuid = getClientUuidBySlug(invite.clientId);
  if (!clientUuid) {
    console.error('[client-invites] addClientInvite: unknown slug', invite.clientId);
    return;
  }

  void supabase
    .from('client_user_invites')
    .insert({
      id: invite.id,
      email: invite.email,
      full_name: invite.fullName,
      client_id: clientUuid,
      invited_by: invite.invitedBy,
      invited_at: invite.invitedAt,
      expires_at: invite.expiresAt,
      magic_link: invite.magicLink,
      status: invite.status,
      personal_note: invite.personalNote,
    })
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[client-invites] addClientInvite INSERT failed:', normalizeError(result.error).message);
      }
    });
}

export function subscribeClientInvites(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
