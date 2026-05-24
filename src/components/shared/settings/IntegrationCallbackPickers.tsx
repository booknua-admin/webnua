'use client';

// =============================================================================
// IntegrationCallbackPickers — the post-OAuth picker auto-open pattern.
//
// Watches `window.location.search` for `?integration=<provider>&integration_status=connected`
// and auto-opens the matching follow-on picker modal (GBP → location picker;
// Meta Ads → ad-account picker). The OAuth callback writes these query params
// onto whichever internal path it redirects to (default `/settings/integrations`;
// or `state.returnTo` when the connect caller supplied one — e.g. `/dashboard`
// from the onboarding screen).
//
// Extracted from `IntegrationConnectionsSection` so both that section and the
// `IntegrationOnboarding` screen can mount it — same picker behaviour either
// surface the client initiated the connect from. Stateless about the
// connection state itself; pure UX glue.
//
// Implementation note. The auto-open state is a DERIVED value (useMemo)
// rather than a `setState`-inside-`useEffect`, so it satisfies the
// react-hooks/set-state-in-effect rule. A separate `dismissed` flag per
// provider keeps the modal closed once the user closes it — without that
// the URL params would re-open it on every render.
// =============================================================================

import { useMemo, useState, useSyncExternalStore } from 'react';

import { GbpLocationPickerModal } from './GbpLocationPickerModal';
import { MetaAdAccountPickerModal } from './MetaAdAccountPickerModal';

function useLocationSearch(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => '',
  );
}

function matches(search: string, providerSlug: string): boolean {
  const params = new URLSearchParams(search);
  return (
    params.get('integration') === providerSlug &&
    params.get('integration_status') === 'connected'
  );
}

type IntegrationCallbackPickersProps = {
  /** The client UUID. Pickers stay closed until this resolves. */
  clientId: string | null;
};

export function IntegrationCallbackPickers({ clientId }: IntegrationCallbackPickersProps) {
  const search = useLocationSearch();
  const [gbpDismissed, setGbpDismissed] = useState(false);
  const [metaDismissed, setMetaDismissed] = useState(false);

  const gbpOpen = useMemo(
    () => Boolean(clientId) && !gbpDismissed && matches(search, 'google_business_profile'),
    [clientId, gbpDismissed, search],
  );
  const metaOpen = useMemo(
    () => Boolean(clientId) && !metaDismissed && matches(search, 'meta_ads'),
    [clientId, metaDismissed, search],
  );

  return (
    <>
      <GbpLocationPickerModal
        open={gbpOpen}
        onOpenChange={(open) => {
          if (!open) setGbpDismissed(true);
        }}
        clientId={clientId}
      />
      <MetaAdAccountPickerModal
        open={metaOpen}
        onOpenChange={(open) => {
          if (!open) setMetaDismissed(true);
        }}
        clientId={clientId}
      />
    </>
  );
}
