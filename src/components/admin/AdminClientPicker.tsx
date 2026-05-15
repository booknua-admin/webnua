'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { AdminClient } from '@/lib/nav/admin-clients';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

// =============================================================================
// AdminClientPicker — the switch between agency mode (cross-client birds-eye)
// and sub-account mode (drill into a specific client). Wired to the
// workspace context: closed state shows the active client (or "All clients"
// in agency mode); open state lists every client + an "All clients" entry
// at the top to return to agency mode.
// =============================================================================

type AdminClientPickerProps = {
  clients: AdminClient[];
};

function AdminClientPicker({ clients }: AdminClientPickerProps) {
  const { activeClient, hydrated, setActiveClientId, clearActiveClient } =
    useWorkspace();
  const [open, setOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="mx-[22px] mb-3 h-[60px] rounded-lg border border-paper/[0.08] bg-paper/[0.04]" />
    );
  }

  const handleSelectClient = (id: string) => {
    setActiveClientId(id);
    setOpen(false);
  };

  const handleSelectAgency = () => {
    clearActiveClient();
    setOpen(false);
  };

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
        {activeClient ? (
          <>
            <ClientLogo initial={activeClient.initial} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-paper">
                {activeClient.name}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/55">
                Sub-account · 1 of {clients.length}
              </div>
            </div>
          </>
        ) : (
          <>
            <AgencyLogo />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-paper">
                All clients
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/55">
                Agency · birds-eye
              </div>
            </div>
          </>
        )}
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
          <button
            type="button"
            onClick={handleSelectAgency}
            data-active={activeClient === null || undefined}
            className="flex items-center gap-3 rounded px-2 py-2 text-left text-paper/80 transition-colors hover:bg-paper/[0.06] data-[active=true]:bg-paper/[0.08] data-[active=true]:text-paper"
          >
            <AgencyLogo small />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-paper">
                All clients
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/50">
                Agency birds-eye · cross-client triage
              </div>
            </div>
          </button>
          <div className="my-0.5 border-t border-paper/[0.06]" />
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelectClient(client.id)}
              data-active={client.id === activeClient?.id || undefined}
              className="flex items-center gap-3 rounded px-2 py-2 text-left text-paper/80 transition-colors hover:bg-paper/[0.06] data-[active=true]:bg-paper/[0.08] data-[active=true]:text-paper"
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
            </button>
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

function AgencyLogo({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border border-paper/20 bg-paper/10 font-mono font-bold text-paper',
        small ? 'size-7 text-[11px]' : 'size-9 text-[13px]',
      )}
      title="Agency-level birds-eye view"
    >
      ◆
    </div>
  );
}

export { AdminClientPicker };
