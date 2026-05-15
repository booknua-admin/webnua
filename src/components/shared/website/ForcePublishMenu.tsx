'use client';

// =============================================================================
// ForcePublishMenu — break-glass "skip approval" menu for admins, sitting
// to the right of the rust "Publish →" button in EditorToolbar.
//
// Per design doc §2.4 this is NOT a separate capability. It's a UI affordance
// + audit-discipline layered on top of the existing `publish` cap, conditioned
// at the call site on `role === 'admin'`. Clients never have `publish` in
// their default set anyway, so the role check is the real gate.
//
// Two-stage confirm:
//   1. Click the chevron → menu drops "Force publish (skip approval)".
//   2. Click that → ForcePublishConfirmDialog opens, requires a free-text
//      reason. Cancel returns. Confirm fires publishDraft({ force: { reason }})
//      which both publishes AND writes an audit entry (publish-stub.ts +
//      audit-stub.ts wired in chunk F).
// =============================================================================

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import { publishDraft } from '@/lib/website/publish-stub';
import { cn } from '@/lib/utils';

export type ForcePublishMenuProps = {
  websiteId: string;
  /** When true, render nothing (used by EditorToolbar when the publish
   *  button itself is disabled — Lane B lock). */
  hidden?: boolean;
};

export function ForcePublishMenu({ websiteId, hidden }: ForcePublishMenuProps) {
  const user = useUser();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Role check at the call site is the meaningful gate — see design doc §2.4.
  if (hidden || !user || user.role !== 'admin') return null;

  return (
    <>
      <div className="relative">
        <button
          type="button"
          aria-label="Open publish options"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-md border border-rule bg-card px-2 text-[12px] text-ink-quiet transition-colors hover:border-rust hover:text-rust',
          )}
        >
          ▾
        </button>
        {menuOpen ? (
          <>
            {/* Click-outside catcher */}
            <button
              type="button"
              aria-hidden
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 z-50 mt-1.5 w-[260px] rounded-md border border-rule bg-card shadow-card">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setDialogOpen(true);
                }}
                className="block w-full px-3.5 py-3 text-left text-[13px] text-warn transition-colors hover:bg-warn-soft"
              >
                <span className="block font-bold">
                  Force publish (skip approval)
                </span>
                <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Audit-logged · break-glass only
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>
      <ForcePublishConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={(reason) => {
          if (!user) return;
          const result = publishDraft(
            websiteId,
            {
              id: user.id,
              displayName: user.displayName,
              email: user.email,
            },
            { force: { reason } },
          );
          setDialogOpen(false);
          if (result) router.push('/website');
        }}
      />
    </>
  );
}

// ---- Confirm dialog ------------------------------------------------------
//
// Two-stage confirm: the dialog itself IS stage two (stage one being the
// menu item). The "Force publish" CTA on the dialog stays disabled until
// the reason field has non-whitespace content — a soft second-confirm
// without requiring a literal two-click pattern that would feel adversarial.

type ForcePublishConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

function ForcePublishConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: ForcePublishConfirmDialogProps) {
  const [reason, setReason] = useState('');

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setReason('');
  }, [onOpenChange]);

  const handleConfirm = useCallback(() => {
    const trimmed = reason.trim();
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
    setReason('');
  }, [reason, onConfirm]);

  const canConfirm = reason.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="default"
        className="p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="border-b border-paper-2 bg-warn-soft/60 px-6 py-5">
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            <span aria-hidden className="size-1.5 rounded-full bg-warn" />
            Break-glass · skip approval
          </p>
          <DialogTitle className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">
            Force publish this <em className="not-italic text-rust">draft</em>?
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] text-ink-soft">
            This bypasses the review queue and publishes immediately.{' '}
            <strong className="text-ink">
              Every force-publish is audit-logged
            </strong>{' '}
            with your name, time, and the reason below — visible to all admins
            and to the affected client.
          </DialogDescription>
        </div>
        <div className="px-6 py-5">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
            Reason · required
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was broken? Who asked? Why couldn't this go through review?"
            className="min-h-24"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            <strong className="text-ink">No undo.</strong> The live site
            updates immediately.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn(
                'bg-warn text-paper hover:bg-warn/90',
                !canConfirm && 'cursor-not-allowed opacity-50',
              )}
            >
              Force publish ⚡
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
