'use client';

// =============================================================================
// AddSectionDialog — the section picker behind the editor rail's
// "+ Add section" button. Lists every implemented section type valid for the
// current container (`getSectionsForContainer`); picking one appends a fresh
// section seeded from the registry's `defaultData()`.
// =============================================================================

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getSectionsForContainer } from '@/lib/website/sections';
import type { ContainerKind, SectionType } from '@/lib/website/types';

export type AddSectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: ContainerKind;
  onAdd: (type: SectionType) => void;
};

export function AddSectionDialog({
  open,
  onOpenChange,
  container,
  onAdd,
}: AddSectionDialogProps) {
  const options = getSectionsForContainer(container).filter(
    (d) => d.implemented,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>
            Pick a section to append. You can reorder or remove it afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {options.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => {
                onAdd(def.type);
                onOpenChange(false);
              }}
              className="flex flex-col gap-1 rounded-lg border border-rule bg-card px-4 py-3 text-left transition-colors hover:border-rust hover:bg-rust-soft/40"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                {def.label}
              </span>
              <span className="text-[13px] leading-[1.45] text-ink-soft">
                {def.description}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
