'use client';

// =============================================================================
// ClientMultiSelect — compact multi-select client filter dropdown. Replaces
// the FilterChips client strip on the admin list surfaces: a chip-per-client
// strip doesn't scale past ~5 clients.
//
// Options are self-sourced from the full client roster (`useAdminClients`),
// so every client — including a brand-new one with no records yet — is always
// selectable. `value` is a list of client slugs; an empty list means "all".
// =============================================================================

import { useState } from 'react';

import { useAdminClients } from '@/lib/clients/clients-store';
import { cn } from '@/lib/utils';

type ClientMultiSelectProps = {
  /** Mono label shown to the left, e.g. "// CLIENT". */
  label?: string;
  /** Selected client slugs. Empty = all clients. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional slug → record-count map, shown beside each client. */
  counts?: Record<string, number>;
};

function ClientMultiSelect({
  label,
  value,
  onChange,
  counts,
}: ClientMultiSelectProps) {
  const clients = useAdminClients();
  const [open, setOpen] = useState(false);

  const selected = new Set(value);
  const allSelected = value.length === 0;

  const toggle = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  };

  const summary = allSelected
    ? 'All clients'
    : value.length === 1
      ? (clients.find((c) => c.id === value[0])?.name ?? '1 client')
      : `${value.length} clients`;

  return (
    <div className="flex items-center gap-3">
      {label ? (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-full border border-rule bg-card px-4 text-[13px] font-bold text-ink transition-colors hover:border-rust"
        >
          <span>{summary}</span>
          {!allSelected ? (
            <span className="rounded-full bg-rust px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-paper">
              {value.length}
            </span>
          ) : null}
          <span
            aria-hidden
            className={cn(
              'text-ink-quiet transition-transform',
              open && 'rotate-180',
            )}
          >
            ⌄
          </span>
        </button>

        {open ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[260px] rounded-lg border border-rule bg-card p-1.5 shadow-card">
              <button
                type="button"
                onClick={() => onChange([])}
                data-active={allSelected || undefined}
                className="flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-[13px] font-bold text-ink-soft transition-colors hover:bg-paper-2 data-[active=true]:bg-rust-soft data-[active=true]:text-rust"
              >
                <span>All clients</span>
                {allSelected ? (
                  <span aria-hidden className="text-rust">
                    ✓
                  </span>
                ) : null}
              </button>
              <div className="my-1 border-t border-paper-2" />
              {clients.length === 0 ? (
                <p className="px-2.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                  {'// No clients'}
                </p>
              ) : (
                <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
                  {clients.map((client) => {
                    const checked = selected.has(client.id);
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => toggle(client.id)}
                        data-active={checked || undefined}
                        className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-paper-2 data-[active=true]:bg-rust-soft"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold',
                            checked
                              ? 'border-rust bg-rust text-paper'
                              : 'border-rule text-transparent',
                          )}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                          {client.name}
                        </span>
                        {counts ? (
                          <span className="font-mono text-[10px] font-bold text-ink-quiet">
                            {counts[client.id] ?? 0}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export { ClientMultiSelect };
