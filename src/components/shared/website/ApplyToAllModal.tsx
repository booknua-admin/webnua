'use client';

// =============================================================================
// ApplyToAllModal — offered after a colour change in the element inspector
// (Phase 6 · brand style defaults). "Apply everywhere" promotes the colour to
// a brand-level default, so every section that has not overridden it inherits
// the change. "Just this one" keeps it as a per-section override.
//
// The "don't ask again" preference is per-browser (brand-style-stub).
// =============================================================================

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { dismissApplyToAll } from '@/lib/website/brand-style-stub';

export type ApplyToAllModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plural element name, e.g. "headings". */
  scopeLabel: string;
  /** Promote the colour to the brand default + drop the local override. */
  onApplyEverywhere: () => void;
};

export function ApplyToAllModal({
  open,
  onOpenChange,
  scopeLabel,
  onApplyEverywhere,
}: ApplyToAllModalProps) {
  const [dontAsk, setDontAsk] = useState(false);

  const finish = (applyEverywhere: boolean) => {
    if (dontAsk) dismissApplyToAll();
    if (applyEverywhere) onApplyEverywhere();
    onOpenChange(false);
    setDontAsk(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Apply to all {scopeLabel}?</DialogTitle>
          <DialogDescription>
            Make this the site-wide colour for {scopeLabel}. Every section that
            hasn&rsquo;t set its own keeps in step automatically. Sections with
            a custom colour are left as they are.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-[13px] text-ink-mid">
          <input
            type="checkbox"
            checked={dontAsk}
            onChange={(e) => setDontAsk(e.target.checked)}
            className="h-4 w-4 accent-rust"
          />
          Don&rsquo;t ask again
        </label>
        <DialogFooter>
          <Button variant="secondary" onClick={() => finish(false)}>
            Just this one
          </Button>
          <Button onClick={() => finish(true)}>Apply everywhere</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
