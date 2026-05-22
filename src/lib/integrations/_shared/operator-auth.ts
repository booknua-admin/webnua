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
