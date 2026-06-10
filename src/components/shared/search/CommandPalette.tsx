'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRole } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { adminWorkspaceNav } from '@/lib/nav/admin-nav';
import { clientNav } from '@/lib/nav/client-nav';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import { cn } from '@/lib/utils';

// =============================================================================
// CommandPalette — the global ⌘K surface. Mounted once inside `Topbar` so
// every authed page carries it; the topbar search field is its click trigger
// and ⌘K / Ctrl+K opens it from anywhere. Three command sources:
//
//   1. Navigate      — the signed-in role's nav destinations (the same data
//                      the sidebar renders — `clientNav` / `adminWorkspaceNav`).
//   2. Quick actions — New ticket (both roles); New client + New campaign
//                      (operator).
//   3. Workspaces    — operator only: switch the active sub-account (the same
//                      `setActiveClientId` / `clearActiveClient` calls
//                      `AdminClientPicker` makes — mode is state-driven, so
//                      no navigation happens on switch).
//
// A non-empty query always appends a "Search everywhere" escape hatch that
// routes to `/search?q=…` (the existing global-search results page).
//
// The query/selection state lives in `PaletteSurface`, INSIDE DialogContent —
// Radix unmounts the content when the dialog closes, so every open starts
// from a clean slate without any reset effect.
// =============================================================================

type PaletteCommand = {
  id: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  /** Right-aligned quiet hint (e.g. the route, or "Switch workspace"). */
  hint?: string;
  /** Extra match text beyond the label. */
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[600px] md:p-0"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <PaletteSurface close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaletteSurface({ close }: { close: () => void }) {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const clients = useAdminClients();
  const { activeClient, setActiveClientId, clearActiveClient } = useWorkspace();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const commands = useMemo<PaletteCommand[]>(() => {
    if (!hydrated) return [];
    const isAdmin = role === 'admin';

    const navItems = isAdmin
      ? adminWorkspaceNav.items
      : clientNav.flatMap((section) => section.items);

    const navigate: PaletteCommand[] = navItems.map((item) => ({
      id: `nav:${item.href}`,
      group: 'Navigate',
      icon: item.icon ?? '→',
      label: item.label,
      hint: item.href,
      run: () => go(item.href),
    }));

    const actions: PaletteCommand[] = [
      {
        id: 'action:new-ticket',
        group: 'Quick actions',
        icon: '+',
        label: 'New ticket',
        keywords: 'request change support',
        hint: '/tickets/new',
        run: () => go('/tickets/new'),
      },
      ...(isAdmin
        ? [
            {
              id: 'action:new-client',
              group: 'Quick actions',
              icon: '+',
              label: 'New client',
              keywords: 'create onboard business sub-account',
              hint: '/clients/new',
              run: () => go('/clients/new'),
            },
            {
              id: 'action:new-campaign',
              group: 'Quick actions',
              icon: '+',
              label: 'New campaign',
              keywords: 'meta ads launch',
              hint: '/campaigns/launch',
              run: () => go('/campaigns/launch'),
            },
          ]
        : []),
    ];

    const workspaces: PaletteCommand[] = isAdmin
      ? [
          {
            id: 'workspace:agency',
            group: 'Workspaces',
            icon: '◆',
            label: 'All clients · agency view',
            keywords: 'birds-eye overview workspace agency mode',
            hint: activeClient ? 'Switch workspace' : 'Current',
            run: () => {
              clearActiveClient();
              close();
            },
          },
          ...clients.map((client) => ({
            id: `workspace:${client.id}`,
            group: 'Workspaces',
            icon: client.initial || client.name.charAt(0).toUpperCase(),
            label: client.name,
            keywords: `client sub-account workspace ${client.meta}`,
            hint: activeClient?.id === client.id ? 'Current' : 'Switch workspace',
            run: () => {
              setActiveClientId(client.id);
              close();
            },
          })),
        ]
      : [];

    return [...navigate, ...actions, ...workspaces];
  }, [hydrated, role, clients, activeClient, go, close, setActiveClientId, clearActiveClient]);

  const trimmed = query.trim();
  const filtered = useMemo<PaletteCommand[]>(() => {
    const q = trimmed.toLowerCase();
    const matches = q
      ? commands.filter((command) =>
          `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase().includes(q),
        )
      : commands;
    if (!q) return matches;
    return [
      ...matches,
      {
        id: 'search:everywhere',
        group: 'Search',
        icon: '⌕',
        label: `Search “${trimmed}” everywhere`,
        hint: 'Leads · bookings · reviews',
        run: () => go(`/search?q=${encodeURIComponent(trimmed)}`),
      },
    ];
  }, [commands, trimmed, go]);

  // Derived at render so a shrinking result list can never leave the
  // selection pointing past the end (no clamp effect needed).
  const safeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(filtered.length ? (safeIndex + 1) % filtered.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(filtered.length ? (safeIndex - 1 + filtered.length) % filtered.length : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      filtered[safeIndex]?.run();
    }
  };

  // Group rows for rendering while preserving the flat keyboard index.
  const grouped = useMemo(() => {
    const out: {
      group: string;
      rows: { command: PaletteCommand; index: number }[];
    }[] = [];
    filtered.forEach((command, index) => {
      const bucket = out.find((g) => g.group === command.group);
      if (bucket) bucket.rows.push({ command, index });
      else out.push({ group: command.group, rows: [{ command, index }] });
    });
    return out;
  }, [filtered]);

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-3 border-b border-paper-2 px-5">
        <span aria-hidden className="text-[15px] text-ink-quiet">
          ⌕
        </span>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder="Jump to a page, switch workspace, or search…"
          className="h-[52px] min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-quiet focus:outline-none"
        />
        <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-quiet">
          ESC
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[min(420px,55vh)] overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// No matches'}
          </p>
        ) : (
          grouped.map(({ group, rows }) => (
            <div key={group} className="px-2 pb-1.5">
              <p className="px-3 pb-1 pt-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-quiet">
                {'// '}
                {group}
              </p>
              {rows.map(({ command, index }) => (
                <button
                  key={command.id}
                  type="button"
                  data-index={index}
                  onClick={command.run}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    index === safeIndex
                      ? 'bg-rust-soft/60 text-ink'
                      : 'text-ink-soft hover:bg-paper-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md text-[12px] font-bold',
                      index === safeIndex ? 'bg-rust text-paper' : 'bg-paper-2 text-ink-mid',
                    )}
                  >
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                    {command.label}
                  </span>
                  {command.hint ? (
                    <span className="shrink-0 font-mono text-[10px] text-ink-quiet">
                      {command.hint}
                    </span>
                  ) : null}
                  {index === safeIndex ? (
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[10px] font-bold text-rust"
                    >
                      ↵
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-paper-2 bg-paper px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span className="ml-auto">⌘K to open anywhere</span>
      </div>
    </div>
  );
}

/**
 * Owns the palette's open state + the global ⌘K / Ctrl+K listener, and hands
 * an `openPalette` callback down via render prop so `Topbar` can wire its
 * search field as the click target without owning palette state itself.
 */
function CommandPaletteProvider({
  children,
}: {
  children: (openPalette: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      {children(() => setOpen(true))}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

export { CommandPalette, CommandPaletteProvider };
