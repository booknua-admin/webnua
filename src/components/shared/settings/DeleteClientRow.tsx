'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DangerRow } from '@/components/shared/settings/DangerRow';
import { deleteClient } from '@/lib/clients/clients-store';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

// =============================================================================
// DeleteClientRow — operator-only "permanently delete this client" action on
// the Danger zone tab. Acts on the active sub-account; disabled in agency mode
// (no client selected). On success it clears the workspace context and routes
// back to the dashboard. Admin-only — placed in shared/settings/ following the
// CapabilityToggleGrid / ClientSeatLimitCard precedent.
// =============================================================================

function DeleteClientRow() {
  const { activeClient, clearActiveClient } = useWorkspace();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!activeClient) return;
    setError(null);
    void deleteClient(activeClient.id).then((result) => {
      if (result.ok) {
        clearActiveClient();
        router.push('/dashboard');
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div>
      <DangerRow
        heading={
          activeClient
            ? `Delete ${activeClient.name} permanently`
            : 'Delete a client permanently'
        }
        description={
          activeClient ? (
            <>
              Permanently removes <strong>{activeClient.name}</strong> and all of its data —
              websites, funnels, leads, bookings, reviews, and automations.{' '}
              <strong>This cannot be undone.</strong>
            </>
          ) : (
            <>
              Select a client from the sidebar picker first. Deleting a client permanently
              removes all of its data. <strong>This cannot be undone.</strong>
            </>
          )
        }
        action={{ label: 'Delete client', solid: true }}
        disabled={!activeClient}
        onConfirm={handleConfirm}
      />
      {error ? (
        <p className="mt-1 mb-3 text-[13px] font-semibold text-warn">{error}</p>
      ) : null}
    </div>
  );
}

export { DeleteClientRow };
