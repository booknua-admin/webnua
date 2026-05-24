// =============================================================================
// client-invite store — in-memory cache hydrated from Supabase + a
// fetch-based writer.
//
// Writes now go through POST /api/invites/client (the server route inserts
// the row + sends the email + enforces the seat limit + auths the caller as
// operator-or-client). The previous direct Supabase INSERT here shipped a
// fabricated magic link the customer could never use. The component-side
// path stays: `await addClientInvite(draft)` returns the real persisted
// invite (with token + magic link); the cache updates optimistically.
//
// Snapshot discipline (CLAUDE.md): getAllClientInvites() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientSlugByUuid, getClientUuidBySlug } from '@/lib/clients/clients-store';
import type { ClientUserInvite, ClientUserInviteDraft } from './client-invite';

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
    .select(
      'id, email, full_name, client_id, invited_by, invited_at, expires_at, magic_link, status, personal_note',
    )
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

export type AddClientInviteResult =
  | { ok: true; invite: ClientUserInvite; emailOutcome: 'sent' | 'failed' | 'skipped' }
  | { ok: false; error: string; status: number };

export async function addClientInvite(
  draft: ClientUserInviteDraft & { clientId: string },
): Promise<AddClientInviteResult> {
  const token = await currentAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated', status: 401 };

  // The component passes clientId as a SLUG (the public-surface format);
  // the API takes the UUID.
  const clientUuid = getClientUuidBySlug(draft.clientId);
  if (!clientUuid) {
    return { ok: false, error: 'unknown-client', status: 400 };
  }

  const response = await fetch('/api/invites/client', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: draft.email.trim(),
      fullName: draft.fullName.trim(),
      clientId: clientUuid,
      personalNote: draft.personalNote.trim(),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    invite?: ServerClientInvite;
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

  const invite = serverInviteToClient(body.invite);
  cache = [invite, ...cache];
  dispatch();
  return { ok: true, invite, emailOutcome: body.emailOutcome ?? 'sent' };
}

// --- resend / cancel --------------------------------------------------------

export async function resendClientInvite(
  id: string,
): Promise<{ ok: true; invite: ClientUserInvite } | { ok: false; error: string; status: number }> {
  const token = await currentAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated', status: 401 };
  const response = await fetch(`/api/invites/${encodeURIComponent(id)}/resend`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    invite?: ServerClientInvite;
    error?: string;
  };
  if (!response.ok || !body.ok || !body.invite) {
    return { ok: false, error: body.error ?? 'resend-failed', status: response.status };
  }
  const invite = serverInviteToClient(body.invite);
  cache = cache.map((i) => (i.id === invite.id ? invite : i));
  dispatch();
  return { ok: true, invite };
}

export async function cancelClientInvite(
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
  cache = cache.map((i) => (i.id === id ? { ...i, status: 'revoked' as const } : i));
  dispatch();
  return { ok: true };
}

// --- subscribe + helpers ----------------------------------------------------

export function subscribeClientInvites(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type ServerClientInvite = {
  id: string;
  email: string;
  fullName: string;
  clientId: string; // UUID
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token: string;
  magicLink: string;
  status: ClientUserInvite['status'];
  personalNote: string | null;
};

function serverInviteToClient(server: ServerClientInvite): ClientUserInvite {
  return {
    id: server.id,
    email: server.email,
    fullName: server.fullName,
    clientId: getClientSlugByUuid(server.clientId) ?? server.clientId,
    invitedBy: server.invitedBy,
    invitedAt: server.invitedAt,
    expiresAt: server.expiresAt,
    magicLink: server.magicLink,
    status: server.status,
    personalNote: server.personalNote,
  };
}
