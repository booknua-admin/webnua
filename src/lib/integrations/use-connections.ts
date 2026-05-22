'use client';

// =============================================================================
// Per-tenant OAuth connections — operator UI data layer.
//
// Phase 7 Session 2. Reads + mutations behind the "Connected accounts" section
// on the sub-account /settings/integrations surface.
//
//   • useClientConnections — lists a client's integration_connections. Read
//     straight from the browser Supabase client; the integration_connections
//     RLS scopes it to operators + their accessible clients, so no API route
//     is needed for the read.
//   • connectIntegration   — POSTs the connect route, then navigates the
//     browser to the provider's consent page.
//   • useDisconnectIntegration — POSTs the disconnect route, then refetches.
//
// integration_connections is not yet in the generated Database type (the
// migrations ship in this PR; database.ts regenerates post-deploy) — the
// browser client is cast to untyped for this one table, same rationale as
// _shared/db-types.ts on the server.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import type {
  IntegrationConnectionStatus,
  OAuthProviderId,
} from '@/lib/integrations/connections';
import { supabase } from '@/lib/supabase/client';

/** A connection as the operator UI consumes it. */
export type ConnectionView = {
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

type ConnectionRowSelect = {
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

/** The browser client, untyped for the not-yet-generated table. */
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function connectionKey(clientId: string | null) {
  return ['integration-connections', clientId] as const;
}

async function fetchConnections(clientId: string): Promise<ConnectionView[]> {
  const { data, error } = await db()
    .from('integration_connections')
    .select(
      'provider, status, provider_account_id, scopes, connected_at, ' +
        'last_used_at, last_refreshed_at, last_error, access_token_expires_at',
    )
    .eq('client_id', clientId);
  if (error) throw normalizeError(error);
  return ((data as unknown as ConnectionRowSelect[] | null) ?? []).map((row) => ({
    provider: row.provider,
    status: row.status,
    providerAccountId: row.provider_account_id,
    scopes: row.scopes ?? [],
    connectedAt: row.connected_at,
    lastUsedAt: row.last_used_at,
    lastRefreshedAt: row.last_refreshed_at,
    lastError: row.last_error,
    accessTokenExpiresAt: row.access_token_expires_at,
  }));
}

/** A client's OAuth connections. Disabled (idle) until a client UUID is set. */
export function useClientConnections(clientId: string | null) {
  return useQuery({
    queryKey: connectionKey(clientId),
    queryFn: () => fetchConnections(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again to manage integrations.');
  return token;
}

/**
 * Start an OAuth connect flow. POSTs the connect route for an authorization
 * URL, then navigates the browser to the provider's consent page. Resolves
 * only on a failure (on success the page has already navigated away).
 */
export async function connectIntegration(
  provider: OAuthProviderId,
  clientId: string,
): Promise<void> {
  const token = await accessToken();
  const response = await fetch(`/api/integrations/${provider}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      body.error === 'provider-not-configured'
        ? 'This integration is not configured yet — its OAuth app credentials are missing.'
        : `Could not start the connection (${body.error ?? response.status}).`,
    );
  }
  const { authorizationUrl } = (await response.json()) as { authorizationUrl: string };
  window.location.assign(authorizationUrl);
}

/** Disconnect (revoke) a client's connection for a provider. */
export function useDisconnectIntegration(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: OAuthProviderId) => {
      const token = await accessToken();
      const response = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(`Could not disconnect (${body.error ?? response.status}).`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKey(clientId) });
    },
  });
}
