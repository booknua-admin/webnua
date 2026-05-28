'use client';

// =============================================================================
// AdSetEditModal — per-ad-set TARGETING editor.
//
// Phase 7.5 · Session 2.3 (v3). Each ad set holds the audience the
// operator is testing the angle against. Inside a set, the IMAGE
// varies; between sets, the COPY varies. Audience is the third axis
// the operator can independently tune per set.
//
// V1 fields:
//   • Audience description (free-form)
//   • Age min / max
//   • Geo radius (km from the customer's primary city — Meta's
//     custom_locations radius)
//   • Interest keywords (comma-separated text; Meta autocomplete-
//     resolved ids are V1.1)
//
// V1 caveat surfaced inline in the modal: the launch orchestrator
// currently applies ONE targeting spec to the whole campaign — per-
// set targeting is captured here for the snapshot + ops audit, and
// V1.1 will thread it through the orchestrator so each ad set really
// gets its own audience on Meta.
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
import { Input } from '@/components/ui/input';
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
const RADIUS_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 80];

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
      <DialogContent size="lg">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldRow label="Age min" sub="Lower bound.">
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

            <FieldRow label="Age max" sub="Upper bound.">
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

            <FieldRow label="Radius (km)" sub="From the customer's primary city.">
              <select
                value={draft.audience.radiusKm}
                onChange={(e) =>
                  patchAudience({ radiusKm: Number(e.target.value) })
                }
                className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r} km
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

          <FieldRow
            label="Interest keywords"
            sub="Comma-separated. e.g. 'home renovation, kitchen design'. We&rsquo;ll resolve these to Meta interest ids at launch."
          >
            <Input
              type="text"
              value={draft.audience.interestKeywords}
              onChange={(e) =>
                patchAudience({ interestKeywords: e.target.value })
              }
              placeholder="home renovation, kitchen design, home improvement"
            />
          </FieldRow>

          <div className="rounded-md border border-rule bg-paper/40 px-3 py-2 text-[11px] leading-snug text-ink-quiet">
            <strong className="font-semibold text-ink">Heads up:</strong>{' '}
            Per-ad-set targeting is captured here. V1 applies these to the
            whole campaign at launch — V1.1 will publish each set with its
            own audience to Meta. The classic builder lets you tune
            placements and custom audiences if you need them now.
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
