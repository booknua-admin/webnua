'use client';

// =============================================================================
// GbpLocationPickerModal — post-OAuth location selection.
//
// After the customer grants consent (via the OAuth flow on
// /settings/integrations), this modal calls the locations 'list' action to
// fetch every GBP location the connected Google user can manage, lets the
// operator pick one, and saves the choice with the locations 'select'
// action. Triggers an initial review sync via the same route.
// =============================================================================

import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useListGbpLocations,
  useSelectGbpLocation,
  type GbpLocationListBucket,
  type GbpLocationOption,
} from '@/lib/integrations/gbp/use-gbp';

export function GbpLocationPickerModal({
  open,
  onOpenChange,
  clientId,
  onSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  onSelected?: () => void;
}) {
  const listMutation = useListGbpLocations(clientId);
  const selectMutation = useSelectGbpLocation(clientId);
  const [picked, setPicked] = useState<{
    accountName: string;
    locationName: string;
    title: string;
  } | null>(null);

  // Auto-list on open so the operator doesn't see an empty modal first.
  useEffect(() => {
    if (open && !listMutation.data && !listMutation.isPending) {
      listMutation.mutate();
    }
    if (!open) {
      setPicked(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    if (!picked) return;
    await selectMutation.mutateAsync(picked);
    onSelected?.();
    onOpenChange(false);
  }

  const buckets: GbpLocationListBucket[] = listMutation.data ?? [];
  const flatCount = buckets.reduce((acc, b) => acc + b.locations.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Choose a Google Business Profile location</DialogTitle>
          <DialogDescription>
            Pick which of this customer&apos;s locations Webnua should manage. We&apos;ll
            sync reviews from this location daily, and outbound review requests
            will point customers to its &ldquo;leave a review&rdquo; link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
          {listMutation.isPending ? (
            <div className="rounded-md border border-rule bg-paper px-4 py-6 text-center text-[13px] text-ink-quiet">
              Loading locations from Google…
            </div>
          ) : listMutation.error ? (
            <div className="rounded-md border border-warn/30 bg-warn/8 px-4 py-3 text-[13px] text-warn">
              {(listMutation.error as Error).message}
            </div>
          ) : flatCount === 0 ? (
            <div className="rounded-md border border-rule bg-paper px-4 py-6 text-center text-[13px] text-ink-quiet">
              No Business Profile locations were found for this Google account.
              Verify the customer has at least one verified listing at
              business.google.com.
            </div>
          ) : (
            buckets.map((bucket) => (
              <div key={bucket.account.name} className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                  {bucket.account.accountName || bucket.account.name}
                </div>
                {bucket.error ? (
                  <div className="rounded-md border border-warn/30 bg-warn/8 px-3 py-2 text-[12px] text-warn">
                    {bucket.error}
                  </div>
                ) : (
                  bucket.locations.map((loc) => (
                    <LocationOption
                      key={loc.locationName}
                      account={bucket.account.name}
                      location={loc}
                      selected={picked?.locationName === loc.locationName}
                      onSelect={() =>
                        setPicked({
                          accountName: bucket.account.name,
                          locationName: loc.locationName,
                          title: loc.title,
                        })
                      }
                    />
                  ))
                )}
              </div>
            ))
          )}
          {selectMutation.error ? (
            <div className="rounded-md border border-warn/30 bg-warn/8 px-3 py-2 text-[12px] text-warn">
              {(selectMutation.error as Error).message}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={selectMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked || selectMutation.isPending}
            onClick={handleSave}
          >
            {selectMutation.isPending ? 'Saving…' : 'Use this location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationOption({
  account: _account,
  location,
  selected,
  onSelect,
}: {
  account: string;
  location: GbpLocationOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'w-full rounded-md border bg-card px-3.5 py-3 text-left transition-colors ' +
        (selected
          ? 'border-rust shadow-[0_0_0_3px_rgba(210,67,23,0.12)]'
          : 'border-rule hover:border-ink')
      }
    >
      <div className="text-[14px] font-bold text-ink">{location.title}</div>
      {location.address ? (
        <div className="mt-0.5 text-[12px] text-ink-quiet">{location.address}</div>
      ) : null}
      {location.placeId ? (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          place id · {location.placeId}
        </div>
      ) : null}
    </button>
  );
}
