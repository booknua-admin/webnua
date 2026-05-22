// =============================================================================
// POST /api/integrations/[provider]/disconnect — revoke a per-tenant OAuth
// connection.
//
// Phase 7 Session 2. Operator-only (same auth as the connect route). Revokes
// access at the provider, deletes the Vault secret, and marks the connection
// row revoked. Reached by fetch() with the operator's Supabase access token.
// =============================================================================

import { NextResponse } from 'next/server';

import { isOAuthProviderId } from '@/lib/integrations/connections';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { revokeConnection } from '@/lib/integrations/_shared/tokens';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: rawProvider } = await params;
  if (!isOAuthProviderId(rawProvider)) {
    return NextResponse.json({ error: 'unknown-provider' }, { status: 404 });
  }
  const provider = rawProvider;

  let clientId: unknown;
  try {
    ({ clientId } = (await request.json()) as { clientId?: unknown });
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await revokeConnection(clientId, provider);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[oauth/disconnect] revoke failed', error);
    return NextResponse.json({ ok: false, error: 'revoke-failed' }, { status: 500 });
  }
}
