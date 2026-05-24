// =============================================================================
// Shared lead-access auth helper (Phase 8 Session 1).
//
// Mirrors the requireLeadAccess pattern from /api/leads/[id]/reply (Phase 7
// Resend session). Verifies the bearer token, resolves the user, and checks
// the lead belongs to a client the user can see (RLS via accessible_client_ids).
//
// Used by every /api/leads/[id]/... route added in this session.
// =============================================================================

import { getServiceClient } from '@/lib/supabase/server';

export type LeadAccess =
  | { ok: true; userId: string; clientId: string; leadId: string }
  | { ok: false; status: number; error: string };

export async function requireLeadAccess(
  request: Request,
  leadId: string,
): Promise<LeadAccess> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };

  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const userId = userData.user.id;

  const { data: lead } = await svc
    .from('leads')
    .select('id, client_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, status: 404, error: 'lead-not-found' };
  const clientId = (lead as { client_id: string }).client_id;

  const { createClient } = await import('@supabase/supabase-js');
  const { env } = await import('@/lib/env');
  const asUser = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: clientCheck } = await asUser
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!clientCheck) {
    return { ok: false, status: 403, error: 'forbidden-lead' };
  }
  return { ok: true, userId, clientId, leadId };
}
