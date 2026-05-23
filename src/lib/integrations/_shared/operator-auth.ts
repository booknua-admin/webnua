// =============================================================================
// Operator request auth for the OAuth integration routes.
//
// Phase 7 Session 2. The connect / disconnect routes are operator-only and
// act on a specific client. This verifies both: the caller is an operator,
// AND the caller may act on that client (a junior operator cannot connect an
// integration for a client outside their assignment).
//
// Integration management is operator governance, NOT one of the 13 builder
// capabilities (CLAUDE.md: workspace-governance actions are outside the
// capability model). So the check is operator role + client access — there is
// no `integrations:manage` capability to gate on; inventing one would be
// drift.
//
// Auth transport: the caller's Supabase access token on the Authorization
// header (the codebase has no cookie-based server auth — same pattern as
// /api/domains). The client-access check runs a token-scoped Supabase client
// so the `clients` RLS (accessible_client_ids) does the scoping for us.
//
// SERVER-ONLY.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/server';

export type OperatorAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

/**
 * Require the request to come from an operator who can act on `clientId`.
 * Returns the operator's user id on success, or an HTTP status + error code.
 */
export async function requireOperatorForClient(
  request: Request,
  clientId: string,
): Promise<OperatorAuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };

  // Validate the token + resolve the user against the service client.
  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const userId = userData.user.id;

  const { data: profile } = await svc
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  // The operator role is stored as `admin`.
  if (profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'forbidden' };
  }

  // Client-access check — run as the operator so the `clients` RLS
  // (accessible_client_ids) scopes a junior operator to their assignment.
  const asOperator = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: client } = await asOperator
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) {
    return { ok: false, status: 403, error: 'forbidden-client' };
  }

  return { ok: true, userId };
}

/**
 * Require the request to come from EITHER an operator who can act on
 * `clientId` (delegated path — the operator acts on behalf of the client)
 * OR the client themselves (the signed-in client-role user whose
 * `client_id` matches `clientId`). Use for tenant-scoped integrations
 * where the client owns the integration in question (eg. Google Business
 * Profile — the customer's own GBP listing).
 *
 * Returns the calling user's id on success, or an HTTP status + error
 * code.
 */
export async function requireClientAccess(
  request: Request,
  clientId: string,
): Promise<OperatorAuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };

  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const userId = userData.user.id;

  const { data: profile } = await svc
    .from('users')
    .select('role, client_id')
    .eq('id', userId)
    .single();
  if (!profile) {
    return { ok: false, status: 403, error: 'forbidden' };
  }

  // A client-role user may act on their OWN client only.
  if (profile.role === 'client') {
    if (profile.client_id !== clientId) {
      return { ok: false, status: 403, error: 'forbidden-client' };
    }
    return { ok: true, userId };
  }

  // The operator (`admin`) path mirrors requireOperatorForClient — verify
  // accessible_client_ids via a token-scoped Supabase client so RLS does
  // the scoping (junior operators stay bounded to their assignment).
  if (profile.role !== 'admin') {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  const asOperator = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: client } = await asOperator
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) {
    return { ok: false, status: 403, error: 'forbidden-client' };
  }
  return { ok: true, userId };
}
