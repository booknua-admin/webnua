// =============================================================================
// team-invite store — in-memory cache hydrated from Supabase + a fetch-based
// writer.
//
// Writes now go through POST /api/invites/team (the server route inserts the
// row + sends the email + fans the team_invite_clients joins). The previous
// direct Supabase INSERT here had no way to send the real magic-link email,
// so it shipped a fabricated link the customer could never use. The
// component-side path is unchanged: `await addTeamInvite(draft)` returns the
// real persisted invite (with token + magic link); the cache is updated
// optimistically.
//
// Snapshot discipline (CLAUDE.md): getAllTeamInvites() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientUuidBySlug, getClientSlugByUuid } from '@/lib/clients/clients-store';
import type { TeamInvite, TeamInviteDraft } from './types';

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
    .select(
      'id, email, full_name, role, invited_by, invited_at, expires_at, magic_link, status, personal_note',
    );

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

export type AddTeamInviteResult =
  | { ok: true; invite: TeamInvite; emailOutcome: 'sent' | 'failed' | 'skipped' }
  | { ok: false; error: string; status: number };

/**
 * Persist a new team invite via POST /api/invites/team. Updates the cache
 * optimistically on success. The caller awaits and renders the success
 * step using the returned `invite` (which carries the real magic link).
 */
export async function addTeamInvite(
  draft: TeamInviteDraft,
): Promise<AddTeamInviteResult> {
  const token = await currentAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated', status: 401 };

  // Junior assignments are passed as SLUGS in the UI; the API takes UUIDs.
  const uuidAssignments = (draft.assignedClientIds ?? [])
    .map((slug) => getClientUuidBySlug(slug))
    .filter((u): u is string => Boolean(u));

  const response = await fetch('/api/invites/team', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: draft.email.trim(),
      fullName: draft.fullName.trim(),
      role: draft.role,
      assignedClientIds: uuidAssignments,
      personalNote: draft.personalNote.trim(),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    invite?: ServerInvite;
    emailOutcome?: 'sent' | 'failed' | 'skipped';
    error?: string;
  };
  if (!response.ok || !body.ok || !body.invite) {
    return {
      ok: false,
      error: body.error ?? 'invite-failed',
      status: response.status,
    };
  }

  const invite = serverInviteToTeam(body.invite);
  cache = [invite, ...cache];
  dispatch();
  return { ok: true, invite, emailOutcome: body.emailOutcome ?? 'sent' };
}

// --- resend / cancel --------------------------------------------------------

export async function resendTeamInvite(
  id: string,
): Promise<{ ok: true; invite: TeamInvite } | { ok: false; error: string; status: number }> {
  const token = await currentAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated', status: 401 };
  const response = await fetch(`/api/invites/${encodeURIComponent(id)}/resend`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    invite?: ServerInvite;
    error?: string;
  };
  if (!response.ok || !body.ok || !body.invite) {
    return { ok: false, error: body.error ?? 'resend-failed', status: response.status };
  }
  const invite = serverInviteToTeam(body.invite);
  cache = cache.map((i) => (i.id === invite.id ? invite : i));
  dispatch();
  return { ok: true, invite };
}

export async function cancelTeamInvite(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const token = await currentAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated', status: 401 };
  const response = await fetch(`/api/invites/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    return { ok: false, error: body.error ?? 'cancel-failed', status: response.status };
  }
  // Update local cache — flip the row to revoked.
  cache = cache.map((i) => (i.id === id ? { ...i, status: 'revoked' as const } : i));
  dispatch();
  return { ok: true };
}

// --- subscribe + helpers ----------------------------------------------------

export function subscribeTeamInvites(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type ServerInvite = {
  id: string;
  email: string;
  fullName: string;
  role: TeamInvite['role'];
  assignedClientIds: string[]; // UUIDs from the server
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token: string;
  magicLink: string;
  status: TeamInvite['status'];
  personalNote: string | null;
};

function serverInviteToTeam(server: ServerInvite): TeamInvite {
  return {
    id: server.id,
    email: server.email,
    fullName: server.fullName,
    role: server.role,
    assignedClientIds: server.assignedClientIds
      .map((uuid) => getClientSlugByUuid(uuid) ?? uuid),
    personalNote: server.personalNote ?? '',
    invitedBy: server.invitedBy,
    invitedAt: server.invitedAt,
    expiresAt: server.expiresAt,
    magicLink: server.magicLink,
    status: server.status,
  };
}
