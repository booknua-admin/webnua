'use client';

// =============================================================================
// ClientSeatLimitCard — operator control for a single client's seat limit.
//
// Mounted on /settings/access in sub-account mode (the operator has drilled
// into one client). Rendered as a visually-distinct SettingsSection, separate
// from the capability grid: the seat limit is a CONTRACT/PLAN axis (how many
// users the plan permits), not the CAPABILITY axis (what users can do).
//
// Cluster 8 · Session 4b: the limit resolves through the agency policy layer.
// A client either INHERITS the agency default (/settings/seats) or carries a
// per-account OVERRIDE. The card shows which, and "Revert to agency" drops the
// override. Every change is an attributable SeatLimitChange event.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';

import { SeatUsageMeter } from '@/components/client/team/SeatUsageMeter';
import { PolicySourceBadge } from '@/components/shared/settings/PolicyOverrideRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getInheritedSeatLimit,
  getSeatLimitHistory,
  inheritSeatLimit,
  isSeatLimitOverridden,
  setSeatLimit,
  subscribeSeatLimitHistory,
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

const EMPTY_HISTORY: readonly SeatLimitChange[] = [];

function formatLimit(limit: number | null): string {
  return limit === null ? 'no limit' : String(limit);
}

export function ClientSeatLimitCard({
  clientId,
  clientName,
  actorId,
}: ClientSeatLimitCardProps) {
  const usage = useClientSeatUsage(clientId);
  const overridden = useSyncExternalStore(
    subscribeSeatLimits,
    () => isSeatLimitOverridden(clientId),
    () => false,
  );
  // Two primitive reads rather than the {limit, source} object — a fresh
  // object each call would break useSyncExternalStore's reference check.
  const inheritedLimit = useSyncExternalStore(
    subscribeSeatLimits,
    () => getInheritedSeatLimit(clientId).limit,
    () => null,
  );
  const inheritedSource = useSyncExternalStore(
    subscribeSeatLimits,
    () => getInheritedSeatLimit(clientId).source,
    () => 'agency' as const,
  );
  const history = useSyncExternalStore(
    subscribeSeatLimitHistory,
    () => getSeatLimitHistory(clientId),
    () => EMPTY_HISTORY,
  );

  const currentLimit = usage.limit;
  const [uncapped, setUncapped] = useState(currentLimit === null);
  const [limitText, setLimitText] = useState(
    currentLimit === null ? '' : String(currentLimit),
  );

  // Re-sync the draft to the effective limit when it changes from outside
  // this component — hydration, an agency-default change, or another tab.
  // React's "store info from a previous render" pattern.
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
    if (draftInvalid || !dirty) return;
    setSeatLimit(clientId, draftLimit, actorId);
  }

  function handleRevert() {
    inheritSeatLimit(clientId, actorId);
  }

  return (
    <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            Seat limit
          </span>
          <PolicySourceBadge source={overridden ? 'overridden' : 'inherited'} />
          {!overridden ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              from {inheritedSource} · {formatLimit(inheritedLimit)}
            </span>
          ) : null}
        </div>
        {overridden ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevert}
            className="-my-1 h-auto shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust hover:bg-rust/10"
          >
            Revert to agency
          </Button>
        ) : null}
      </div>

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
            {overridden
              ? `${clientName} has a per-account limit. `
              : `${clientName} inherits the ${
                  inheritedSource === 'plan' ? 'assigned plan' : 'agency default'
                }. Saving a different value sets a per-account override. `}
            Existing users and pending invites both count toward the limit.
          </p>
        )}
        <LastChange change={history[0]} />
      </div>
    </div>
  );
}

function LastChange({ change }: { change: SeatLimitChange | undefined }) {
  if (!change) return null;
  const when = new Date(change.changedAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return (
    <p className="mt-2.5 border-t border-paper-2 pt-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-quiet">
      {'// Last changed '}
      {when} · {formatLimit(change.previousLimit)} → {formatLimit(change.newLimit)}
    </p>
  );
}

export type { ClientSeatLimitCardProps };
