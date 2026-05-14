'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { AdminClient } from '@/lib/nav/admin-clients';

type AdminClientPickerProps = {
  clients: AdminClient[];
  activeClientId: string;
};

function AdminClientPicker({ clients, activeClientId }: AdminClientPickerProps) {
  const [open, setOpen] = useState(false);
  const active =
    clients.find((c) => c.id === activeClientId) ?? clients[0];

  if (!active) return null;

  const otherCount = clients.length;

  return (
    <div
      data-slot="admin-client-picker"
      className="mx-[22px] mb-3 rounded-lg border border-paper/[0.08]"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg bg-paper/[0.04] px-3 py-3 text-left transition-colors hover:bg-paper/[0.08]"
      >
        <ClientLogo initial={active.initial} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-paper">
            {active.name}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/55">
            Electrical · 1 of {otherCount} clients
          </div>
        </div>
        <span
          aria-hidden
          className={cn(
            'shrink-0 text-paper/55 transition-transform',
            open && 'rotate-180',
          )}
        >
          ⌄
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-0.5 border-t border-paper/[0.08] p-1.5">
          {clients.map((client) => (
            <div
              key={client.id}
              data-active={client.id === active.id || undefined}
              className="flex items-center gap-3 rounded px-2 py-2 text-paper/80 transition-colors hover:bg-paper/[0.06] data-[active=true]:bg-paper/[0.08] data-[active=true]:text-paper"
            >
              <ClientLogo initial={client.initial} small />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-paper">
                  {client.name}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/50">
                  {client.meta}
                </div>
              </div>
              {client.badge ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-[2px] font-mono text-[10px] font-bold tracking-[0.06em]',
                    client.badge.tone === 'muted'
                      ? 'bg-paper/10 text-paper/55'
                      : 'bg-rust text-paper',
                  )}
                >
                  {client.badge.text}
                </span>
              ) : null}
            </div>
          ))}
          <div className="mt-1 border-t border-paper/[0.08]" />
          <div className="flex items-center gap-3 rounded px-2 py-2 text-paper/55 transition-colors hover:bg-paper/[0.06] hover:text-paper">
            <ClientLogo initial="+" small ghost />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-paper">
                Add new client
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/50">
                Start the funnel build
              </div>
            </div>
          </div>
          <div className="px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust-light hover:text-rust">
            View all clients →
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClientLogo({
  initial,
  small = false,
  ghost = false,
}: {
  initial: string;
  small?: boolean;
  ghost?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md font-sans font-extrabold',
        small ? 'size-7 text-xs' : 'size-9 text-base',
        ghost
          ? 'border border-dashed border-paper/30 text-paper/50'
          : 'bg-rust text-paper',
      )}
    >
      {initial}
    </div>
  );
}

export { AdminClientPicker };
