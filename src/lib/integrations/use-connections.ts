'use client';

// =============================================================================
// Per-tenant OAuth connections — operator UI data layer.
//
// Phase 7 Session 2. Reads + mutations behind the "Connected accounts"
// section on the integrations surface.
//
//   • useClientConnections — lists a client's redacted connection-status
//     view through /api/integrations/connections. The raw table stays
//     operator-private at RLS level, while the route allows the client to
//     see only the fields needed to manage their own connect state.
//   • connectIntegration   — POSTs the connect route, then navigates the
//     browser to the provider's consent page.
//   • useDisconnectIntegration — POSTs the disconnect route, then refetches.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

function connectionKey(clientId: string | null) {
  return ['integration-connections', clientId] as const;
}

async function fetchConnections(clientId: string): Promise<ConnectionView[]> {
  const token = await accessToken();
  const response = await fetch('/api/integrations/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    connections?: ConnectionView[];
  };
  if (!response.ok) {
    throw new Error(connectionListErrorMessage(body.error, response.status));
  }
  return body.connections ?? [];
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

function connectionListErrorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'unauthenticated':
      return 'You are signed out — sign in again to manage integrations.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You do not have access to this client.';
    case 'missing-clientId':
    case 'invalid-body':
      return 'Could not load integrations because the request was invalid.';
    case 'list-failed':
      return 'Could not load connected accounts right now.';
    default:
      return `Could not load connected accounts (${code ?? status}).`;
  }
}

/**
 * Start an OAuth connect flow. POSTs the connect route for an authorization
 * URL, then navigates the browser to the provider's consent page. Resolves
 * only on a failure (on success the page has already navigated away).
 *
 * `options.returnTo` lets the caller redirect to a specific internal path
 * after the OAuth round-trip (default: '/settings/integrations'). Used by
 * the onboarding screen to land the user back on '/dashboard' after a
 * successful connect, where the picker auto-open hook is also mounted.
 */
export async function connectIntegration(
  provider: OAuthProviderId,
  clientId: string,
  options?: { returnTo?: string },
): Promise<void> {
  const token = await accessToken();
  const response = await fetch(`/api/integrations/${provider}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
    }),
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
