'use client';

// =============================================================================
// AdSetEditModal — per-ad-set TARGETING editor.
//
// Phase 7.5 · Session 2.3 (v3). Each ad set holds the audience the
// operator is testing the angle against. Inside a set, the IMAGE
// varies; between sets, the COPY varies. Audience is the third axis
// the operator can independently tune per set.
//
// V1 fields (only the ones that flow to Meta's targeting spec):
//   • Audience description (operator note + snapshot — Meta has no
//     freeform-string field, so this is for audit + ops, not delivery)
//   • Age min / max → spec.age_min / spec.age_max
//
// Country is set at the campaign root and applies to every ad set
// via spec.geo_locations.countries[].
//
// What's NOT in V1 (use the classic builder):
//   • Geo radius — needs a lat/lng centre we don't have without
//     geocoding the customer's address
//   • Interest IDs — needs Meta's targetingsearch autocomplete to
//     resolve free text → numeric ids
//
// V1 caveat: the launch orchestrator currently applies ONE targeting
// spec to the whole campaign — V1 uses the FIRST ad set's audience.
// Per-set audience splits land in V1.1 when the orchestrator accepts
// different specs per ad set.
//
// Copy editing for the ad set lives on AdEditModal (the "Copy (shared
// across this set)" panel) — the angle copy is the constant across
// every ad in the set, so it sits with the ads it controls.
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
import { Textarea } from '@/components/ui/textarea';

import type { AudienceSpec } from './CampaignBlueprint';

export type AdSetEditDraft = {
  angleId: string;
  label: string;
  audience: AudienceSpec;
  activeAdCount: number;
  totalAdCount: number;
};

export type AdSetEditModalProps = {
  open: boolean;
  draft: AdSetEditDraft;
  onChange: (next: AdSetEditDraft) => void;
  onClose: () => void;
};

const AGE_OPTIONS = [18, 21, 25, 30, 35, 40, 45, 50, 55, 60, 65];

export function AdSetEditModal({
  open,
  draft: initial,
  onChange,
  onClose,
}: AdSetEditModalProps) {
  const [draft, setDraft] = useState<AdSetEditDraft>(initial);
  // Re-seed on open — same pattern as the other modals.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
  }, [initial, open]);

  function patchAudience(patch: Partial<AudienceSpec>) {
    setDraft((d) => ({ ...d, audience: { ...d.audience, ...patch } }));
  }

  function handleSave() {
    onChange(draft);
    onClose();
  }

  const ageInvalid = draft.audience.ageMin > draft.audience.ageMax;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        size="lg"
        className="max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Targeting — {draft.label}</DialogTitle>
          <DialogDescription>
            Who sees this angle. {draft.activeAdCount} of {draft.totalAdCount}{' '}
            ad{draft.totalAdCount === 1 ? '' : 's'} in this set will publish to
            the audience below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <FieldRow
            label="Audience description"
            sub="The customer you're putting this angle in front of. One sentence."
          >
            <Textarea
              value={draft.audience.description}
              onChange={(e) => patchAudience({ description: e.target.value })}
              rows={2}
              placeholder="e.g. Cottesloe homeowners renovating their kitchens."
            />
          </FieldRow>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label="Age min" sub="Lower bound — flows to Meta as spec.age_min.">
              <select
                value={draft.audience.ageMin}
                onChange={(e) =>
                  patchAudience({ ageMin: Number(e.target.value) })
                }
                className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust"
              >
                {AGE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Age max" sub="Upper bound — flows to Meta as spec.age_max.">
              <select
                value={draft.audience.ageMax}
                onChange={(e) =>
                  patchAudience({ ageMax: Number(e.target.value) })
                }
                className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust"
              >
                {AGE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>

          {ageInvalid ? (
            <p className="text-[12px] leading-snug text-warn">
              Age min can&rsquo;t be greater than age max — swap them.
            </p>
          ) : null}

          <div className="rounded-md border border-rule bg-paper/40 px-3 py-2 text-[11px] leading-snug text-ink-quiet">
            <strong className="font-semibold text-ink">Country</strong> is
            set on the campaign root and applies to every ad set. V1
            launches use the FIRST ad set&rsquo;s age to the whole campaign;
            per-set age splits land in V1.1 alongside geo radius and
            interest IDs. For city-radius targeting + Meta interest
            picking now, use the classic builder.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={ageInvalid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- shared field row ------------------------------------------------------

function FieldRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {sub ? (
          <span className="text-[11px] leading-snug text-ink-quiet">{sub}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
