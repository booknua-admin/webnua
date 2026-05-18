'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';

type SessionRowProps = {
  icon: string;
  device: string;
  isCurrent?: boolean;
  meta: string;
  when: string;
  className?: string;
};

function SessionRow({ icon, device, isCurrent, meta, when, className }: SessionRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Session-local: revoking collapses the row. Not persisted (no backend).
  const [revoked, setRevoked] = useState(false);

  if (revoked) return null;

  return (
    <div
      data-slot="session-row"
      className={cn(
        'grid grid-cols-[36px_1fr_100px_70px] items-center gap-3.5 border-b border-dotted border-rule-soft py-3.5 last:border-b-0',
        className,
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-base text-ink">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
          {device}
          {isCurrent ? (
            <span className="rounded-full bg-rust-soft px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-rust">
              This device
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 font-mono text-[11px] tracking-[0.04em] text-ink-quiet">{meta}</div>
      </div>
      <div className="text-right font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
        {when}
      </div>
      {isCurrent ? (
        <span />
      ) : (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="cursor-pointer bg-transparent text-right font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-warn transition-colors hover:text-warn/70"
        >
          Revoke
        </button>
      )}
      {isCurrent ? null : (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Revoke this session?"
          description={
            <>
              <strong>{device}</strong> will be signed out immediately. If this wasn&apos;t you,
              change your password too.
            </>
          }
          confirmLabel="Revoke session"
          cancelLabel="Keep it"
          tone="destructive"
          onConfirm={() => setRevoked(true)}
        />
      )}
    </div>
  );
}

export { SessionRow };
