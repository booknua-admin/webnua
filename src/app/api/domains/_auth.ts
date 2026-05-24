// =============================================================================
// Domain-route authorisation — Phase 9.
//
// `authoriseDomainAction(request, clientId)` checks that the bearer-token user
// can act on `clientId`. Two acceptance paths:
//
//   1. Operator role — must have the client in accessible_client_ids().
//   2. Client-role user — their own `client_id` must equal `clientId`.
//
// Returns the user id for attribution (`added_by` on attach). Mirrors the
// `requireClientAccess` shape from lib/integrations/_shared/operator-auth.ts
// but lives next to the route — domains are RLS-scoped on a single table, so
// duplicating the four-line check beats wrapping another adapter layer.
// =============================================================================

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';

export type DomainAuth =
  | { ok: true; userId: string; role: 'admin' | 'client' }
  | { ok: false; reason: 'unauthenticated' | 'forbidden'; userId: null };

export async function authoriseDomainAction(
  request: Request,
  clientId: string,
): Promise<DomainAuth> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, reason: 'unauthenticated', userId: null };

  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return { ok: false, reason: 'unauthenticated', userId: null };

  const { data: profile } = await svc
    .from('users')
    .select('id, role, client_id')
    .eq('id', data.user.id)
    .single();
  if (!profile) return { ok: false, reason: 'unauthenticated', userId: null };

  // Operator path — must hold the client in their accessible set. The set
  // comes through the SECURITY-DEFINER helper; we evaluate it with the
  // service-role client (RLS-bypassing) by reading clients via a join on the
  // helper function. Cheaper to just hit user_client_access + the role.
  if (profile.role === 'admin') {
    // Senior operators see every client; juniors are limited via
    // user_client_access. Mirror is_senior_operator() + accessible_client_ids().
    const { data: team } = await svc
      .from('users')
      .select('team_role')
      .eq('id', profile.id)
      .single();
    const teamRole = team?.team_role as string | undefined;
    if (teamRole === 'owner' || teamRole === 'operator') {
      return { ok: true, userId: profile.id, role: 'admin' };
    }
    // Junior — must have an explicit access grant.
    const { data: access } = await svc
      .from('user_client_access')
      .select('client_id')
      .eq('user_id', profile.id)
      .eq('client_id', clientId)
      .maybeSingle();
    if (access) return { ok: true, userId: profile.id, role: 'admin' };
    return { ok: false, reason: 'forbidden', userId: null };
  }

  // Client-role user — their own client only.
  if (profile.client_id === clientId) {
    return { ok: true, userId: profile.id, role: 'client' };
  }
  return { ok: false, reason: 'forbidden', userId: null };
}

export function unauthorisedResponse(auth: DomainAuth): Response {
  if (auth.ok) throw new Error('unauthorisedResponse called on ok auth');
  const status = auth.reason === 'unauthenticated' ? 401 : 403;
  return NextResponse.json({ error: auth.reason }, { status });
}
