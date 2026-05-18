'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';

type ApiKeyRowProps = {
  name: string;
  token: string;
  createdLabel: React.ReactNode;
  usedLabel: React.ReactNode;
  className?: string;
};

function ApiKeyRow({ name, token, createdLabel, usedLabel, className }: ApiKeyRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Session-local: revoking collapses the row. Not persisted (no backend) —
  // a reload restores it, same as NotificationBell's read-state stub.
  const [revoked, setRevoked] = useState(false);

  if (revoked) return null;

  return (
    <div
      data-slot="api-key-row"
      className={cn(
        'mb-2 grid grid-cols-[1fr_130px_100px_80px] items-center gap-3.5 rounded-lg border border-rule bg-paper px-[18px] py-3.5',
        className,
      )}
    >
      <div>
        <div className="mb-1 text-[13px] font-bold text-ink">{name}</div>
        <div className="font-mono text-[11px] tracking-[0.04em] text-ink-quiet">{token}</div>
      </div>
      <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {createdLabel}
      </div>
      <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {usedLabel}
      </div>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="cursor-pointer bg-transparent text-right font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-warn transition-colors hover:text-warn/70"
      >
        Revoke
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Revoke this API key?"
        description={
          <>
            <strong>{name}</strong> will stop working immediately and any integration using it
            will lose access. This can&apos;t be undone.
          </>
        }
        confirmLabel="Revoke key"
        cancelLabel="Keep it"
        tone="destructive"
        onConfirm={() => setRevoked(true)}
      />
    </div>
  );
}

export { ApiKeyRow };
