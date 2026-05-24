// =============================================================================
// POST /api/integrations/[provider]/disconnect — revoke a per-tenant OAuth
// connection.
//
// Auth mirrors the connect route — client-or-operator for every per-tenant
// OAuth provider. The customer owns the third-party account, so they may
// disconnect it themselves OR the operator may do it on their behalf.
// Revokes access at the provider, deletes the Vault secret, and marks the
// connection row revoked.
// =============================================================================

import { NextResponse } from 'next/server';

import { isOAuthProviderId } from '@/lib/integrations/connections';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
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

  const auth = await requireClientAccess(request, clientId);
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
