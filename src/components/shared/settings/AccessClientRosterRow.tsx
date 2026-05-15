'use client';

// =============================================================================
// AccessClientRosterRow — single row in the agency-mode access roster.
// Surfaces a client business at a glance (logo, name, user count, caps
// summary) with a "Drill in →" button that switches the workspace context
// to that client. Clicking the button puts the operator into sub-account
// mode for that client — the page re-renders to show their per-user
// capability grid.
// =============================================================================

import type { AdminClient } from '@/lib/nav/admin-clients';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AccessClientRosterRowProps = {
  client: AdminClient;
  userCount: number;
  totalCapsGranted: number;
  onDrillIn: (clientId: string) => void;
};

export function AccessClientRosterRow({
  client,
  userCount,
  totalCapsGranted,
  onDrillIn,
}: AccessClientRosterRowProps) {
  const isEmpty = userCount === 0;
  return (
    <div className="grid grid-cols-[40px_1fr_120px_140px_120px] items-center gap-3 border-b border-paper-2 bg-card px-5 py-4 last:border-b-0">
      <div
        aria-hidden
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md font-sans text-[13px] font-extrabold',
          isEmpty ? 'bg-paper-2 text-ink-quiet' : 'bg-ink text-rust-light',
        )}
      >
        {client.initial}
      </div>
      <div>
        <p className="text-[14px] font-bold text-ink">{client.name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {client.meta}
        </p>
      </div>
      <div className="text-[13px] text-ink">
        {isEmpty ? (
          <span className="text-ink-quiet">No users yet</span>
        ) : (
          <>
            <strong className="font-bold">{userCount}</strong>
            {' '}
            <span className="text-ink-quiet">
              {userCount === 1 ? 'user' : 'users'}
            </span>
          </>
        )}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
        {isEmpty ? (
          '—'
        ) : (
          <>
            <strong className="text-ink">{totalCapsGranted}</strong>{' '}
            cap{totalCapsGranted === 1 ? '' : 's'} granted
          </>
        )}
      </div>
      <div className="text-right">
        <Button
          variant={isEmpty ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => onDrillIn(client.id)}
        >
          {isEmpty ? 'Open →' : 'Drill in →'}
        </Button>
      </div>
    </div>
  );
}
