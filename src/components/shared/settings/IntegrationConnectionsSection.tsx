'use client';

// =============================================================================
// IntegrationConnectionsSection — the operator's per-tenant OAuth connections
// panel on sub-account /settings/integrations.
//
// Phase 7 Session 2. One row per OAuth provider (GBP, Meta Ads) showing the
// connection state for the drilled-into client + a Connect / Disconnect /
// Reconnect affordance. Operator-only — mounted only inside the operator's
// sub-account integrations content.
//
// Distinct from the policy panel below it: that is the inherit-vs-override
// decision (does this client use agency-supplied keys); THIS is the real
// OAuth connection — has the customer actually granted access.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import {
  OAUTH_PROVIDER_DISPLAY,
  type OAuthProviderDisplay,
  type OAuthProviderId,
} from '@/lib/integrations/connections';
import {
  connectIntegration,
  useClientConnections,
  useDisconnectIntegration,
  type ConnectionView,
} from '@/lib/integrations/use-connections';

const LOGO_TONE: Record<OAuthProviderDisplay['logoTone'], string> = {
  gbp: 'bg-[#4285F4] text-white',
  meta: 'bg-[#1877F2] text-white',
};

type ConnectionState = 'connected' | 'attention' | 'disconnected';

/** A revoked connection — or no row at all — reads as "not connected". */
function connectionState(connection: ConnectionView | undefined): ConnectionState {
  if (!connection || connection.status === 'revoked') return 'disconnected';
  if (connection.status === 'active') return 'connected';
  return 'attention'; // refresh_failed | expired
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

export function IntegrationConnectionsSection({
  clientSlug,
  clientName,
}: {
  clientSlug: string;
  clientName: string;
}) {
  const { data: clientId } = useClientId(clientSlug);
  const connections = useClientConnections(clientId ?? null);

  const byProvider = new Map<OAuthProviderId, ConnectionView>();
  for (const connection of connections.data ?? []) {
    byProvider.set(connection.provider, connection);
  }

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Connected <em>accounts</em>
          </>
        }
        description={
          <>
            <strong>{clientName}&apos;s own third-party accounts.</strong> The
            customer grants Webnua access once; tokens are stored encrypted and
            refreshed automatically.
          </>
        }
      >
        <OAuthResultBanner />
        <div className="flex flex-col gap-4">
          {Object.values(OAUTH_PROVIDER_DISPLAY).map((provider) => (
            <ConnectionRow
              key={provider.id}
              provider={provider}
              connection={byProvider.get(provider.id)}
              clientId={clientId ?? null}
              loading={connections.isLoading}
            />
          ))}
        </div>
      </SettingsSection>
    </SettingsPanel>
  );
}

// --- one provider row --------------------------------------------------------

function ConnectionRow({
  provider,
  connection,
  clientId,
  loading,
}: {
  provider: OAuthProviderDisplay;
  connection: ConnectionView | undefined;
  clientId: string | null;
  loading: boolean;
}) {
  const state = connectionState(connection);
  const disconnect = useDisconnectIntegration(clientId ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      // Resolves only on failure — on success the browser navigates away.
      await connectIntegration(provider.id, clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the connection.');
      setBusy(false);
    }
  }

  const expiryDays =
    provider.tokenModel === 'long_lived' && connection
      ? daysUntil(connection.accessTokenExpiresAt)
      : null;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-dotted border-rule-soft pb-4 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 gap-3.5">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-[17px] font-bold ${LOGO_TONE[provider.logoTone]}`}
          aria-hidden
        >
          {provider.logoInitial}
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[15px] font-bold text-ink">{provider.name}</span>
            <StatusPill state={state} />
          </div>
          <div className="text-[13px] leading-[1.45] text-ink-quiet">{provider.blurb}</div>

          {state === 'connected' && connection ? (
            <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              <span className="text-ink-mid">{connection.providerAccountId}</span>
              {' · '}
              {connection.scopes.length} scope{connection.scopes.length === 1 ? '' : 's'}
              {expiryDays !== null
                ? ` · token valid ${expiryDays > 0 ? `${expiryDays}d` : 'expired'}`
                : ''}
              {connection.lastUsedAt
                ? ` · last used ${new Date(connection.lastUsedAt).toLocaleDateString()}`
                : ' · not used yet'}
            </div>
          ) : null}

          {state === 'attention' && connection ? (
            <div className="mt-1.5 text-[12px] leading-[1.45] text-warn">
              Webnua lost access to this account — the customer may have changed
              their password or revoked access.
              {connection.lastError ? (
                <span className="mt-0.5 block font-mono text-[10px] text-ink-quiet">
                  {connection.lastError}
                </span>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mt-1.5 text-[12px] leading-[1.45] text-warn">{error}</div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {state === 'connected' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={disconnect.isPending || !clientId}
            onClick={() => setConfirmOpen(true)}
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : (
          <Button
            variant={state === 'attention' ? 'destructive' : 'default'}
            size="sm"
            disabled={busy || loading || !clientId}
            onClick={handleConnect}
          >
            {busy
              ? 'Starting…'
              : state === 'attention'
                ? 'Reconnect'
                : 'Connect'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Disconnect ${provider.name}?`}
        description={
          <>
            Webnua will revoke its access and delete the stored tokens. Any
            automation that relies on this connection stops until it is
            reconnected.
          </>
        }
        confirmLabel="Disconnect"
        tone="destructive"
        onConfirm={() => disconnect.mutate(provider.id)}
      />
    </div>
  );
}

// --- status pill -------------------------------------------------------------

function StatusPill({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { label: string; className: string }> = {
    connected: { label: 'Connected', className: 'bg-good/12 text-good' },
    attention: { label: 'Reconnection needed', className: 'bg-warn/12 text-warn' },
    disconnected: { label: 'Not connected', className: 'bg-ink/[0.06] text-ink-quiet' },
  };
  const { label, className } = config[state];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}

// --- OAuth round-trip result banner ------------------------------------------

/** Read window.location.search through useSyncExternalStore — the server
 *  snapshot is '' so SSR is clean, and the snapshot is a string (a primitive,
 *  reference-stable). No effect, no setState-in-effect, no hydration mismatch. */
function useLocationSearch(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => '',
  );
}

/** Surfaces the ?integration_status= the callback redirect lands with. */
function OAuthResultBanner() {
  const search = useLocationSearch();
  const [dismissed, setDismissed] = useState(false);

  const params = new URLSearchParams(search);
  const status = params.get('integration_status');
  const integration = params.get('integration');
  if (!status || dismissed) return null;

  const name = integration
    ? (OAUTH_PROVIDER_DISPLAY[integration as OAuthProviderId]?.name ?? integration)
    : 'The integration';
  const message: { tone: 'good' | 'warn'; text: string } | null =
    status === 'connected'
      ? { tone: 'good', text: `${name} connected.` }
      : status === 'denied'
        ? { tone: 'warn', text: `${name} connection was cancelled — consent was not granted.` }
        : status === 'error'
          ? { tone: 'warn', text: `${name} could not be connected. Try again, or check the OAuth setup.` }
          : null;
  if (!message) return null;

  function dismiss() {
    setDismissed(true);
    // Drop the params so a manual refresh does not re-show the banner.
    const url = new URL(window.location.href);
    url.searchParams.delete('integration_status');
    url.searchParams.delete('integration');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }

  return (
    <div
      className={
        'mb-4 flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 ' +
        'text-[13px] font-medium ' +
        (message.tone === 'good' ? 'bg-good/10 text-good' : 'bg-warn/10 text-warn')
      }
    >
      <span>{message.text}</span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}
