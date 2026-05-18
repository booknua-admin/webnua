// =============================================================================
// team-invite store — in-memory cache hydrated from Supabase.
//
// Reads `team_invites` + `team_invite_clients` join; writes INSERT new rows.
// The TeamInviteModal previously console.log'd on send — it now calls
// addTeamInvite which persists to Supabase.
//
// Snapshot discipline (CLAUDE.md): getAllTeamInvites() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientUuidBySlug, getClientSlugByUuid } from '@/lib/clients/clients-store';
import type { TeamInvite } from './types';

const CHANGE_EVENT = 'webnua:team-invites-change';

// --- In-memory cache ---------------------------------------------------------

let cache: TeamInvite[] = [];
let version = 0;
let snapshotVersion = -1;
let snapshotValue: TeamInvite[] = [];

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydrateTeamInvites(): Promise<void> {
  const { data: invites, error: invError } = await supabase
    .from('team_invites')
    .select('id, email, full_name, role, invited_by, invited_at, expires_at, magic_link, status, personal_note');

  if (invError) {
    console.error('[team-invites] hydrate failed:', normalizeError(invError).message);
    return;
  }

  // Fetch client assignments.
  const { data: clientRows, error: clientError } = await supabase
    .from('team_invite_clients')
    .select('invite_id, client_id');

  if (clientError) {
    console.error('[team-invites] team_invite_clients hydrate failed:', normalizeError(clientError).message);
  }

  // Map invite_id → slug[].
  const inviteClients: Record<string, string[]> = {};
  for (const row of (clientRows ?? []) as Array<Record<string, unknown>>) {
    const inviteId = row.invite_id as string;
    if (!inviteClients[inviteId]) inviteClients[inviteId] = [];
    // We store UUIDs in DB; translate to slugs for the public surface.
    const slug = getClientSlugByUuid(row.client_id as string) ?? (row.client_id as string);
    inviteClients[inviteId].push(slug);
  }

  cache = (invites ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    email: row.email as string,
    fullName: row.full_name as string,
    role: row.role as TeamInvite['role'],
    assignedClientIds: inviteClients[row.id as string] ?? [],
    personalNote: (row.personal_note as string | null) ?? '',
    invitedBy: row.invited_by as string,
    invitedAt: row.invited_at as string,
    expiresAt: row.expires_at as string,
    magicLink: row.magic_link as string,
    status: row.status as TeamInvite['status'],
  }));

  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** All team invites. Reference-stable per version. */
export function getAllTeamInvites(): TeamInvite[] {
  if (version === snapshotVersion) return snapshotValue;
  snapshotVersion = version;
  snapshotValue = [...cache];
  return snapshotValue;
}

// --- Writes ------------------------------------------------------------------

/** Persist a new team invite (INSERT team_invites + team_invite_clients). */
export function addTeamInvite(invite: TeamInvite): void {
  cache = [invite, ...cache];
  dispatch();

  // INSERT the invite row.
  void supabase
    .from('team_invites')
    .insert({
      id: invite.id,
      email: invite.email,
      full_name: invite.fullName,
      role: invite.role,
      invited_by: invite.invitedBy,
      invited_at: invite.invitedAt,
      expires_at: invite.expiresAt,
      magic_link: invite.magicLink,
      status: invite.status,
      personal_note: invite.personalNote || '',
    })
    .then(async (result: { error: unknown }) => {
      if (result.error) {
        console.error('[team-invites] addTeamInvite INSERT failed:', normalizeError(result.error).message);
        return;
      }

      // INSERT the client assignments (for junior role).
      if (invite.assignedClientIds.length > 0) {
        const clientRows = invite.assignedClientIds
          .map((slug) => {
            const uuid = getClientUuidBySlug(slug);
            if (!uuid) {
              console.error('[team-invites] addTeamInvite: unknown client slug', slug);
              return null;
            }
            return { invite_id: invite.id, client_id: uuid };
          })
          .filter((r): r is { invite_id: string; client_id: string } => r !== null);

        if (clientRows.length > 0) {
          const { error: clientError } = await supabase
            .from('team_invite_clients')
            .insert(clientRows);
          if (clientError) {
            console.error('[team-invites] team_invite_clients INSERT failed:', normalizeError(clientError).message);
          }
        }
      }
    });
}

export function subscribeTeamInvites(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
