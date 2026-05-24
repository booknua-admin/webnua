'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCloneAutomation } from '@/lib/automations/queries';
import { normalizeError } from '@/lib/errors';

type AutomationCloneButtonProps = {
  /** The source automation id (the one being cloned). */
  automationId: string;
  /** Display name of the source — shown in the modal copy. */
  sourceName: string;
  /** Operator-only flag — the parent already gates on role; this is just a
   *  safety belt + a way to omit the affordance entirely. */
  visible: boolean;
};

/**
 * "Clone automation" — operator-only fork. Phase 8 Session 2 ships this
 * behind a small Dialog modal that captures an optional suffix; on confirm
 * we POST to the new automation row, copy actions, and route to the clone's
 * editor.
 *
 * Mounted on the editor page (`/automations/[id]`) next to the trigger
 * box. Client-role users don't see this button at all (the parent gates
 * via `role === 'admin'`).
 */
function AutomationCloneButton({
  automationId,
  sourceName,
  visible,
}: AutomationCloneButtonProps) {
  const [open, setOpen] = useState(false);
  const [suffix, setSuffix] = useState('');
  const clone = useCloneAutomation();
  const router = useRouter();

  if (!visible) return null;

  const handleConfirm = () => {
    clone.mutate(
      { sourceId: automationId, suffix: suffix.trim() || undefined },
      {
        onSuccess: ({ id }) => {
          setOpen(false);
          setSuffix('');
          router.push(`/automations/${id}`);
        },
      },
    );
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        Clone to customise
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Clone “{sourceName}”</DialogTitle>
            <DialogDescription>
              Creates a copy you can edit independently. The clone starts{' '}
              <strong>disabled</strong> — turn it on when you&rsquo;re ready.
              The original keeps its current state.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-1">
            <label
              htmlFor="clone-suffix"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
            >
              Suffix (optional)
            </label>
            <Input
              id="clone-suffix"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="after-hours"
              maxLength={32}
            />
            <p className="font-sans text-[12px] text-ink-quiet">
              Appears as a tag on the cloned flow. If empty, the clone is
              named &ldquo;{sourceName} (copy)&rdquo;.
            </p>
          </div>
          {clone.error ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-warn">
              {`// ${normalizeError(clone.error).message}`}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={clone.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleConfirm} disabled={clone.isPending}>
              {clone.isPending ? 'Cloning…' : 'Clone →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AutomationCloneButton };
export type { AutomationCloneButtonProps };
