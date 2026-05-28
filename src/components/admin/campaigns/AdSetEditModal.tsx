'use client';

// =============================================================================
// AdSetEditModal — per-angle ad-set editor.
//
// Phase 7.5 · Session 2.3 (v2). Opens when the operator clicks an
// Ad Set node on the blueprint. V1 scope: name + rationale + shared
// image URL (the fallback image every ad in this set inherits unless
// it overrides via AdEditModal).
//
// Per-ad-set targeting (audience / placements / spend split) is V1.1 —
// the launch orchestrator currently uses one targeting spec for the
// whole campaign. Operators who need per-set targeting use the classic
// builder.
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

export type AdSetEditDraft = {
  angleId: string;
  label: string;
  rationale: string;
  sharedImageUrl: string;
  activeAdCount: number;
  totalAdCount: number;
};

export type AdSetEditModalProps = {
  open: boolean;
  draft: AdSetEditDraft;
  onChange: (next: AdSetEditDraft) => void;
  onClose: () => void;
};

export function AdSetEditModal({
  open,
  draft: initial,
  onChange,
  onClose,
}: AdSetEditModalProps) {
  const [draft, setDraft] = useState<AdSetEditDraft>(initial);
  // Re-seed the working draft on every open. Intentional setState-
  // in-effect — the parent rebuilds `initial` per render from the
  // upstream blueprint state, so this mirrors that snapshot.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
  }, [initial, open]);

  function handleSave() {
    onChange(draft);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Edit ad set</DialogTitle>
          <DialogDescription>
            {draft.activeAdCount} of {draft.totalAdCount} ad
            {draft.totalAdCount === 1 ? '' : 's'} in this set will publish.
            Tweak the shared image + labelling here; per-ad copy + image
            overrides live on each ad card.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Ad-set label
            </span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              How this set shows up on the blueprint + in Ads Manager.
            </span>
            <Input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Why this angle
            </span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              Operator-facing note. Useful when you come back to review
              performance.
            </span>
            <Textarea
              value={draft.rationale}
              onChange={(e) =>
                setDraft({ ...draft, rationale: e.target.value })
              }
              rows={2}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Shared image URL
            </span>
            <span className="text-[11px] leading-snug text-ink-quiet">
              Every ad in this set uses this image unless it overrides.
              Paste a hosted URL (Supabase Storage / Unsplash). Per-ad
              upload lives on each ad card.
            </span>
            <Input
              type="url"
              value={draft.sharedImageUrl}
              onChange={(e) =>
                setDraft({ ...draft, sharedImageUrl: e.target.value })
              }
              placeholder="https://…"
            />
          </label>

          <div className="rounded-md border border-rule bg-paper/40 px-3 py-2 text-[11px] leading-snug text-ink-quiet">
            <strong className="font-semibold text-ink">Targeting:</strong>{' '}
            Webnua applies the campaign-level targeting from the classic
            builder. Per-ad-set audience splits are coming — for now the
            three angles share the same audience.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
