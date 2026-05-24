'use client';

// =============================================================================
// AutomationGbpGuard — toggle-time GBP prerequisite check.
//
// The job_completed → review-request automation needs a connected Google
// Business Profile listing to substitute {{review.link}} against. Without one
// the runtime engine would either skip the action or surface an empty link to
// the customer — both bad. We block the toggle UP-front at every surface that
// can enable the flow (the operator roster, the client toggle list, the
// editor footer) and prompt the user to connect GBP first.
//
// Usage: a page mounts <AutomationGbpGuard /> once near the root and pulls the
// `useAutomationGbpGuard()` hook for `guardEnable`. Call sites that toggle
// pass a row's { id, clientId, requiresGbpLocation, enabled } and a callback
// to fire when (a) GBP is not required, or (b) the row is being DISABLED
// (the guard only fires when ENABLING a GBP-requiring row).
// =============================================================================

import type { ReactElement } from 'react';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';

type GuardRow = {
  clientId: string;
  requiresGbpLocation: boolean;
};

/**
 * Cheap RLS-scoped "does this client have a GBP location row?" probe. Same
 * shape `use-gbp.ts#useClientGbpLocation` uses, but `head:true` so we never
 * pull the row payload — we only need the count.
 */
async function fetchHasGbpLocation(clientId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('client_gbp_locations')
    // Untyped cast — `client_gbp_locations` is not in the generated Database
    // type yet (same pattern as use-gbp.ts).
    .select('client_id' as never, { count: 'exact', head: true })
    .eq('client_id', clientId);
  // Missing table (deployment without the GBP migrations applied) → treat as
  // "no location" so the guard fires its prompt; surfacing a raw error on the
  // toggle path would be worse.
  if (error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'PGRST205') return false;
    throw error;
  }
  return (count ?? 0) > 0;
}

/** Per-clientId cache key. The hook batches multiple toggles that target the
 *  same client through the React Query cache. */
function gbpLocationKey(clientId: string) {
  return ['gbp-location-has', clientId] as const;
}

type PendingPrompt = {
  clientId: string;
};

type UseAutomationGbpGuardReturn = {
  /** Call this before flipping an automation to ENABLED. Receives the row's
   *  prereq metadata and the action to run once the gate passes. */
  guardEnable: (row: GuardRow, runEnable: () => void) => void;
  /** Mount this once on the host page — renders the prompt dialog. */
  GbpGuardDialog: () => ReactElement | null;
};

function useAutomationGbpGuard(): UseAutomationGbpGuardReturn {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  // Eager prefetch — once a toggle is about to fire we have the result.
  // `enabled:false` until needed.
  const probeClientId = pending?.clientId ?? null;
  useQuery({
    queryKey: gbpLocationKey(probeClientId ?? 'idle'),
    queryFn: () => fetchHasGbpLocation(probeClientId as string),
    enabled: !!probeClientId,
    staleTime: 30_000,
  });

  const guardEnable = useCallback(
    (row: GuardRow, runEnable: () => void) => {
      if (!row.requiresGbpLocation) {
        runEnable();
        return;
      }
      // Synchronously consult the QueryCache via a one-off promise. We want
      // a blocking-feel decision (open dialog vs proceed), so do the read
      // inline; the underlying anon-role read is fast (count, head:true).
      void fetchHasGbpLocation(row.clientId)
        .then((has) => {
          if (has) {
            runEnable();
          } else {
            setPending({ clientId: row.clientId });
          }
        })
        .catch(() => {
          // Probe error — fall through to the prompt rather than silently
          // enabling. Surfaces "connect GBP" which is the right next step
          // when we genuinely can't tell.
          setPending({ clientId: row.clientId });
        });
    },
    [],
  );

  const GbpGuardDialog = useCallback(() => {
    return (
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              Connect Google Business Profile to enable this automation
            </DialogTitle>
            <DialogDescription>
              This automation sends review-request prompts to customers and
              needs a connected GBP listing so the link points to the right
              business.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPending(null)}
              type="button"
            >
              Not now
            </Button>
            <Button asChild>
              <Link href="/settings/integrations" onClick={() => setPending(null)}>
                Connect Google Business Profile →
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [pending]);

  return { guardEnable, GbpGuardDialog };
}

export { useAutomationGbpGuard };
export type { GuardRow };
