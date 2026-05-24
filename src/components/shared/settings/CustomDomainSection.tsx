'use client';

// =============================================================================
// CustomDomainSection — the per-client domain panel.
//
// Phase 9 custom-domain attachment. Reused by:
//   • client /settings/domains/_client-content
//   • operator sub-account /settings/domains/_sub-account-content
//
// State branches:
//   • No domain yet → AddDomainForm.
//   • One or more domains → a stack of DomainStatusCard rows + AddDomainForm
//     below for adding another.
//
// The operator UI surfaces the same chrome the client sees — drilling into
// a client puts the operator in the same view, with the (operator-only)
// "Set primary" affordance available on every row by virtue of the
// authorise check at the API layer (`requireClientAccess` shape — operator
// or own-client). No role-conditional UI here.
// =============================================================================

import { useState } from 'react';

import { AddDomainForm } from './AddDomainForm';
import { DomainStatusCard } from './DomainStatusCard';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { useClientDomains } from '@/lib/domains/queries';

export function CustomDomainSection({
  clientId,
  clientName,
  conciergeCalendarUrl,
}: {
  clientId: string | null;
  clientName: string;
  conciergeCalendarUrl: string | null;
}) {
  const { data: domains, isLoading } = useClientDomains(clientId);
  const [adding, setAdding] = useState(false);

  if (!clientId) {
    return (
      <SettingsPanel>
        <SettingsSection
          heading={<>Custom domain</>}
          description="Pick a client from the sidebar to manage their custom domain."
        >
          <div />
        </SettingsSection>
      </SettingsPanel>
    );
  }

  const rows = domains ?? [];
  const hasAny = rows.length > 0;

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Custom <em>domain</em>
          </>
        }
        description={
          <>
            Point your own domain at <strong>{clientName}</strong>&apos;s site. Add the DNS
            records at your domain provider and the connection goes live within an hour.
          </>
        }
      >
        {isLoading ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
            {'// Loading domains…'}
          </div>
        ) : null}

        {hasAny ? (
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <DomainStatusCard
                key={row.id}
                domain={row}
                conciergeCalendarUrl={conciergeCalendarUrl}
              />
            ))}
          </div>
        ) : null}

        {!hasAny && !adding && !isLoading ? (
          <AddDomainForm clientId={clientId} onCancel={null} />
        ) : null}

        {hasAny && adding ? (
          <div className="mt-5">
            <AddDomainForm clientId={clientId} onCancel={() => setAdding(false)} />
          </div>
        ) : null}

        {hasAny && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-1.5 self-start font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
          >
            + Add another domain
          </button>
        ) : null}
      </SettingsSection>
    </SettingsPanel>
  );
}
