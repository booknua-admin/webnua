'use client';

// =============================================================================
// CampaignEditModal — campaign-root knobs (name + daily ad spend + country).
//
// Phase 7.5 · Session 2.3 (v2). Opens when the operator clicks the
// campaign root card on CampaignBlueprint. The other launch-payload
// fields (objective, run-until-stopped, age range, in-Meta lead form)
// stay at Webnua defaults — operators who need finer control pick
// "Open classic builder →".
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import type { LaunchSettings } from './CampaignBlueprint';

const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; label: string; currency: string }> = [
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'IE', label: 'Ireland', currency: 'EUR' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
];

export type CampaignEditModalProps = {
  open: boolean;
  settings: LaunchSettings;
  onChange: (next: LaunchSettings) => void;
  onClose: () => void;
};

export function CampaignEditModal({
  open,
  settings,
  onChange,
  onClose,
}: CampaignEditModalProps) {
  // Local working copy — apply on Save, discard on Cancel. Avoids
  // partial state polluting the blueprint while the operator is mid-
  // edit.
  const [draft, setDraft] = useState<LaunchSettings>(settings);
  // Re-seed the working draft whenever the modal is reopened (or the
  // upstream settings reference changes between opens). Intentional
  // setState-in-effect — disabling the rule with a note rather than
  // hoisting the seed inline because the prop is structurally
  // refreshed by the parent on every render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(settings);
  }, [settings, open]);

  const currency =
    COUNTRY_OPTIONS.find((c) => c.code === draft.country)?.currency ?? '';
  const dailyMajor = draft.dailyBudgetCents / 100;
  const budgetTooLow = draft.dailyBudgetCents < 500;

  function handleBudgetChange(major: number) {
    if (!Number.isFinite(major)) return;
    setDraft((d) => ({
      ...d,
      dailyBudgetCents: Math.max(0, Math.round(major * 100)),
    }));
  }

  function handleSave() {
    onChange(draft);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        size="default"
        className="max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>
            Webnua picks sensible defaults for the rest — change them in the
            classic builder if you need finer control.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Campaign name
            </span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              What you&rsquo;ll see in Meta Ads Manager.
            </span>
            <Input
              type="text"
              value={draft.campaignName}
              onChange={(e) =>
                setDraft({ ...draft, campaignName: e.target.value })
              }
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Daily ad spend
            </span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              Meta caps each day at this amount{currency ? ` (${currency})` : ''}.
            </span>
            <div className="flex items-stretch overflow-hidden rounded-md border border-rule bg-paper/40 focus-within:border-rust focus-within:ring-1 focus-within:ring-rust">
              <span className="flex items-center justify-center bg-paper-2 px-3 font-mono text-[12px] font-semibold text-ink-quiet">
                {currency || '$'}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={Number.isFinite(dailyMajor) ? dailyMajor : ''}
                onChange={(e) => handleBudgetChange(Number(e.target.value))}
                className="w-full bg-transparent px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-quiet"
              />
              <span className="flex items-center bg-paper-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                / day
              </span>
            </div>
            {budgetTooLow ? (
              <span className="text-[12px] leading-snug text-warn">
                Meta needs at least {currency || '$'}5/day to deliver any
                meaningful impressions.
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Country</span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              Meta&rsquo;s geo target + your billing currency.
            </span>
            <select
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.currency})
                </option>
              ))}
            </select>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={budgetTooLow}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
