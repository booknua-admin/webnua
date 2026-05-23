'use client';

// =============================================================================
// GbpLocationSection — the "which Google location is this client" panel.
//
// Shown on /settings/google-business as the first section. Three states:
//
//   1. No location row yet — primary CTA "Choose location" opens the picker
//      modal. Falls back with "Connect on /settings/integrations first" copy
//      when the underlying OAuth connection is missing.
//   2. Location row exists — shows the title, address, current rating, and
//      review count from the last sync. "Sync now" + "Change location"
//      affordances.
//
// =============================================================================

import { useState } from 'react';

import { GbpLocationPickerModal } from '@/components/shared/settings/GbpLocationPickerModal';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import {
  useClientGbpLocation,
  useSyncGbpReviews,
} from '@/lib/integrations/gbp/use-gbp';

export function GbpLocationSection({
  clientId,
  clientName,
}: {
  clientId: string | null;
  clientName: string;
}) {
  const location = useClientGbpLocation(clientId);
  const sync = useSyncGbpReviews(clientId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const row = location.data ?? null;

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Google Business <em>location</em>
          </>
        }
        description={
          <>
            <strong>The listing Webnua manages for {clientName}.</strong> Reviews
            and ratings here populate the dashboard widget; outbound review
            requests link customers to this location&apos;s &ldquo;leave a
            review&rdquo; URL.
          </>
        }
      >
        {location.isLoading ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
            Loading location…
          </div>
        ) : row ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[16px] font-bold text-ink">
                {row.location_title || 'Untitled location'}
              </span>
              <span className="rounded-full bg-good/12 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-good">
                Connected
              </span>
            </div>
            <div className="space-y-0.5 text-[12px] text-ink-quiet">
              {row.address ? <div>{row.address}</div> : null}
              {row.phone ? <div>{row.phone}</div> : null}
              {row.website ? (
                <div>
                  <a
                    href={row.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rust hover:underline"
                  >
                    {row.website}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-dotted border-rule-soft pt-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                  Rating
                </div>
                <div className="font-mono text-[18px] font-bold text-ink">
                  {row.current_rating != null ? row.current_rating.toFixed(1) : '—'}
                  <span className="ml-1 text-[11px] font-medium text-ink-quiet">/ 5</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                  Reviews
                </div>
                <div className="font-mono text-[18px] font-bold text-ink">{row.review_count}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                  Last synced
                </div>
                <div className="font-mono text-[12px] text-ink">
                  {row.last_synced_at
                    ? new Date(row.last_synced_at).toLocaleString()
                    : 'never'}
                </div>
              </div>
            </div>
            {row.review_link ? (
              <div className="mt-3 border-t border-dotted border-rule-soft pt-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                  Review link
                </div>
                <a
                  href={row.review_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-[11px] text-rust hover:underline"
                >
                  {row.review_link}
                </a>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending || !clientId}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={!clientId}
              >
                Change location
              </Button>
              {sync.isSuccess ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-good">
                  Queued — refresh shortly
                </span>
              ) : null}
              {sync.error ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">
                  {(sync.error as Error).message}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-6 text-center">
            <div className="text-[14px] font-bold text-ink">
              No location selected yet.
            </div>
            <div className="mt-1.5 text-[12px] leading-[1.5] text-ink-quiet">
              Connect Google Business Profile on the Integrations tab first,
              then pick which of this customer&apos;s locations Webnua should
              manage.
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                size="sm"
                disabled={!clientId}
                onClick={() => setPickerOpen(true)}
              >
                Choose location
              </Button>
            </div>
          </div>
        )}
      </SettingsSection>

      <GbpLocationPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clientId={clientId}
      />
    </SettingsPanel>
  );
}
