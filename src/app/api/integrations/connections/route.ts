// =============================================================================
// POST /api/integrations/connections — list a client's OAuth connections.
//
// Client-or-operator. This is the read-side companion to the per-provider
// connect / disconnect routes. The browser must NOT read integration_
// connections directly because the table stays operator-private at the RLS
// layer; clients only get a redacted status view through this route.
//
// Request:  { clientId }
// Response: { connections: ConnectionStatusView[] }
// =============================================================================

import { NextResponse } from 'next/server';

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import type {
  IntegrationConnectionStatus,
  OAuthProviderId,
} from '@/lib/integrations/connections';

type ConnectionStatusView = {
  provider: OAuthProviderId;
  status: IntegrationConnectionStatus;
  providerAccountId: string;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
  accessTokenExpiresAt: string | null;
};

type ConnectionRow = {
  provider: OAuthProviderId;
  status: IntegrationConnectionStatus;
  provider_account_id: string;
  scopes: string[] | null;
  connected_at: string;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  access_token_expires_at: string | null;
};

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as { clientId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await getIntegrationDb()
    .from('integration_connections')
    .select(
      'provider, status, provider_account_id, scopes, connected_at, ' +
        'last_used_at, last_refreshed_at, last_error, access_token_expires_at',
    )
    .eq('client_id', clientId);

  if (error) {
    console.error('[integrations/connections] list failed', error);
    return NextResponse.json({ error: 'list-failed' }, { status: 500 });
  }

  const connections = ((data as unknown as ConnectionRow[] | null) ?? []).map<ConnectionStatusView>(
    (row) => ({
      provider: row.provider,
      status: row.status,
      providerAccountId: row.provider_account_id,
      scopes: row.scopes ?? [],
      connectedAt: row.connected_at,
      lastUsedAt: row.last_used_at,
      lastRefreshedAt: row.last_refreshed_at,
      lastError: row.last_error,
      accessTokenExpiresAt: row.access_token_expires_at,
    }),
  );

  return NextResponse.json({ connections });
}
