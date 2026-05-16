'use client';

// =============================================================================
// ClientSeatLimitCard — operator control for a single client's seat limit.
//
// Mounted on /settings/access in sub-account mode (the operator has drilled
// into one client). Rendered as a visually-distinct SettingsSection, separate
// from the capability grid: the seat limit is a CONTRACT/PLAN axis (how many
// users the plan permits), not the CAPABILITY axis (what users can do). Same
// page, different concern.
//
// Admin-only — placed in shared/settings/ following the CapabilityToggleGrid
// precedent. Every limit change is recorded as an attributable SeatLimitChange
// event (vision §7), surfaced here as the "last changed" line.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';

import { SeatUsageMeter } from '@/components/client/team/SeatUsageMeter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getSeatLimitHistory,
  setSeatLimit,
  subscribeSeatLimits,
} from '@/lib/clients/seat-limit-stub';
import type { SeatLimitChange } from '@/lib/clients/seat-limit';
import { useClientSeatUsage } from '@/lib/invites/use-seat-usage';

type ClientSeatLimitCardProps = {
  clientId: string;
  clientName: string;
  /** Operator user id — attribution for the change event. */
  actorId: string;
};

export function ClientSeatLimitCard({
  clientId,
  clientName,
  actorId,
}: ClientSeatLimitCardProps) {
  const usage = useClientSeatUsage(clientId);
  const history = useSyncExternalStore(
    subscribeSeatLimits,
    () => getSeatLimitHistory(clientId),
    () => EMPTY_HISTORY,
  );

  const currentLimit = usage.limit;
  const [uncapped, setUncapped] = useState(currentLimit === null);
  const [limitText, setLimitText] = useState(
    currentLimit === null ? '' : String(currentLimit),
  );

  // Re-sync the draft to the stored limit when it changes from outside this
  // component — hydration (the SSR fallback resolves to the real limit) or a
  // change in another tab. React's "store info from previous render" pattern
  // (https://react.dev/reference/react/useState#storing-information-from-
  // previous-renders) — preferred over an effect.
  const [syncedLimit, setSyncedLimit] = useState(currentLimit);
  if (syncedLimit !== currentLimit) {
    setSyncedLimit(currentLimit);
    setUncapped(currentLimit === null);
    setLimitText(currentLimit === null ? '' : String(currentLimit));
  }

  const parsed = Number.parseInt(limitText, 10);
  const draftLimit = uncapped
    ? null
    : Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  const draftInvalid = !uncapped && draftLimit === null;
  const dirty = draftLimit !== currentLimit;

  function handleSave() {
    if (draftInvalid) return;
    setSeatLimit(clientId, draftLimit, actorId);
  }

  return (
    <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
      <SeatUsageMeter usage={usage} />

      <div className="mt-4 border-t border-paper-2 pt-4">
        <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          Maximum users
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            className="h-9 w-24 bg-card"
            value={uncapped ? '' : limitText}
            disabled={uncapped}
            placeholder="—"
            onChange={(e) => setLimitText(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 font-sans text-[13px] text-ink-soft">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-rust"
              checked={uncapped}
              onChange={(e) => setUncapped(e.target.checked)}
            />
            No limit
          </label>
          <Button
            size="sm"
            className="h-9"
            disabled={!dirty || draftInvalid}
            onClick={handleSave}
          >
            Save limit
          </Button>
        </div>
        {draftInvalid ? (
          <p className="mt-2 font-sans text-[12px] text-warn">
            Enter a number of 1 or more, or tick &ldquo;No limit&rdquo;.
          </p>
        ) : (
          <p className="mt-2 font-sans text-[12px] leading-[1.5] text-ink-quiet">
            Caps how many users {clientName} can have. Existing users and
            pending invites both count toward the limit.
          </p>
        )}
        <LastChange change={history[0]} />
      </div>
    </div>
  );
}

const EMPTY_HISTORY: readonly SeatLimitChange[] = [];

function LastChange({ change }: { change: SeatLimitChange | undefined }) {
  if (!change) return null;
  const when = new Date(change.changedAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const fmt = (n: number | null) => (n === null ? 'no limit' : String(n));
  return (
    <p className="mt-2.5 border-t border-paper-2 pt-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-quiet">
      {'// Last changed '}
      {when} · {fmt(change.previousLimit)} → {fmt(change.newLimit)}
    </p>
  );
}

export type { ClientSeatLimitCardProps };
