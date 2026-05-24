// =============================================================================
// Auth helpers shared by every /api/invites route.
//
// Patterns:
//   - `requireOperator()`              — operator-only routes (team invites).
//   - `requireOperatorOrClient(clientId)` — either an operator with access to
//                                          the client, or the client-role user
//                                          for that client (client-user invites).
//   - `currentUserId()`                — read the auth user from a Bearer token.
//
// Mirrors `lib/integrations/_shared/operator-auth.ts` (used by the OAuth +
// SMS / domain routes). Reused here instead of inlining so the access-control
// shape stays consistent across the platform.
// =============================================================================

import { getServiceClient } from '@/lib/supabase/server';
import { requireClientAccess, requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';

export type AuthSuccess = { ok: true; userId: string; isOperator: boolean };
export type AuthFailure = { ok: false; status: number; error: string };
export type AuthResult = AuthSuccess | AuthFailure;

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

/** Validate the caller's bearer token and require the operator role.
 *  Returns the operator user id on success. */
export async function requireOperator(request: Request): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };

  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const userId = userData.user.id;

  const { data: profile } = await svc.from('users').select('role').eq('id', userId).single();
  if (profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, userId, isOperator: true };
}

/** Validate the caller and require either operator-access to the client OR
 *  the client-role user for that client. Returns the calling user id and
 *  a flag for which path matched. */
export async function requireOperatorOrClient(
  request: Request,
  clientId: string,
): Promise<AuthResult> {
  const result = await requireClientAccess(request, clientId);
  if (!result.ok) return result;
  // Determine whether this matched the operator path or the client path —
  // resolve role via service client (same token, single source of truth).
  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('users')
    .select('role')
    .eq('id', result.userId)
    .maybeSingle();
  return { ok: true, userId: result.userId, isOperator: profile?.role === 'admin' };
}

export { requireOperatorForClient };
