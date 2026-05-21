'use client';

// =============================================================================
// NavLinksPanel — the header-menu editor (Dialog). Opened from the header
// editor's toolbar. Lists every page with: a "show in menu" toggle, an
// editable menu label, and reorder controls. Menu items map 1:1 to pages
// (V1 — no custom/external links); any pre-existing href-target links are
// preserved untouched.
//
// Saves the assembled `NavLink[]` onto the draft snapshot via `saveNavLinks`.
// Mirrors the SeoPanel pattern (site-wide scope, local draft state, re-seed
// on open, Save → mutation).
// =============================================================================

import { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MAX_NAV_LINKS, type NavLink, type PageType } from '@/lib/website/types';

export type NavLinksPanelPage = {
  id: string;
  title: string;
  type: PageType;
  slug: string;
};

export type NavLinksPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: NavLinksPanelPage[];
  nav: NavLink[];
  onSave: (nav: NavLink[]) => Promise<boolean>;
};

type MenuRow = { pageId: string; label: string; shown: boolean };

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  generic: 'Page',
};

export function NavLinksPanel({
  open,
  onOpenChange,
  pages,
  nav,
  onSave,
}: NavLinksPanelProps) {
  // Seed rows from nav (page-target links, in order) then append any page
  // not yet in the menu as a hidden row. href-target links are kept aside
  // and re-appended untouched on save.
  const { seededRows, passthrough } = useMemo(() => {
    const pageById = new Map(pages.map((p) => [p.id, p]));
    const rows: MenuRow[] = [];
    const seen = new Set<string>();
    const pass: NavLink[] = [];
    for (const link of nav) {
      if (link.target.kind === 'page') {
        const page = pageById.get(link.target.pageId);
        if (page && !seen.has(page.id)) {
          rows.push({ pageId: page.id, label: link.label, shown: true });
          seen.add(page.id);
        }
      } else {
        pass.push(link);
      }
    }
    for (const page of pages) {
      if (!seen.has(page.id)) {
        rows.push({ pageId: page.id, label: page.title, shown: false });
      }
    }
    return { seededRows: rows, passthrough: pass };
  }, [pages, nav]);

  const [rows, setRows] = useState<MenuRow[]>(seededRows);
  const [seedKey, setSeedKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the dialog re-opens against a fresh page/nav set.
  const currentSeedKey = useMemo(
    () => hashKey(JSON.stringify(seededRows)),
    [seededRows],
  );
  if (open && seedKey !== currentSeedKey) {
    setRows(seededRows);
    setSeedKey(currentSeedKey);
    setError(null);
  }

  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const shownCount = rows.filter((r) => r.shown).length;
  const overLimit = shownCount > MAX_NAV_LINKS;

  const setRow = (i: number, patch: Partial<MenuRow>) => {
    setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setRows((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    if (overLimit) return;
    setSaving(true);
    setError(null);
    const links: NavLink[] = rows
      .filter((r) => r.shown)
      .map((r) => ({
        label: r.label.trim() || pageById.get(r.pageId)?.title || 'Page',
        target: { kind: 'page' as const, pageId: r.pageId },
      }));
    const ok = await onSave([...links, ...passthrough]);
    setSaving(false);
    if (ok) onOpenChange(false);
    else setError('Save failed — your menu changes were not persisted.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-0 overflow-hidden p-0" showCloseButton={false}>
        <div className="border-b border-paper-2 px-6 py-5">
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-rust-soft px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            ✦ Menu · header navigation
          </p>
          <DialogTitle className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">
            What shows in the <em className="not-italic text-rust">header menu</em>.
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] text-ink-soft">
            Each menu item links to one of your pages. Rename the menu label,
            reorder the items, or hide a page from the menu.{' '}
            <strong className="text-ink">
              The menu label is separate from the page name
            </strong>{' '}
            — a short label here keeps the header tidy.
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-paper-2 bg-paper px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </p>
          <p
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
              overLimit ? 'text-warn' : 'text-ink-quiet',
            )}
          >
            {shownCount} / {MAX_NAV_LINKS} in menu
          </p>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2.5">
            {rows.map((row, i) => {
              const page = pageById.get(row.pageId);
              if (!page) return null;
              return (
                <div
                  key={row.pageId}
                  className={cn(
                    'rounded-lg border bg-card px-4 py-3 transition-opacity',
                    row.shown ? 'border-rule' : 'border-paper-2 opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-pill bg-paper-2 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                        {PAGE_TYPE_LABEL[page.type]}
                      </span>
                      <span className="truncate text-[13px] font-bold text-ink">
                        {page.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <ReorderButton
                          glyph="↑"
                          label="Move up"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        />
                        <ReorderButton
                          glyph="↓"
                          label="Move down"
                          disabled={i === rows.length - 1}
                          onClick={() => move(i, 1)}
                        />
                      </div>
                      <Switch
                        checked={row.shown}
                        onCheckedChange={(v) => setRow(i, { shown: v })}
                        label={row.shown ? 'In menu' : 'Hidden'}
                      />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                      Menu label
                    </span>
                    <Input
                      value={row.label}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      disabled={!row.shown}
                      placeholder={page.title}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {error ? (
              <span className="text-warn">{error}</span>
            ) : overLimit ? (
              <span className="text-warn">
                The menu holds at most {MAX_NAV_LINKS} items — hide{' '}
                {shownCount - MAX_NAV_LINKS} more.
              </span>
            ) : (
              <>Saves to the draft — publish to take it live.</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || overLimit}>
              {saving ? 'Saving…' : 'Save menu'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReorderButton({
  glyph,
  label,
  disabled,
  onClick,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-rule bg-card text-[14px] leading-none text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:opacity-35 disabled:hover:border-rule disabled:hover:text-ink-mid"
    >
      {glyph}
    </button>
  );
}

/** Tiny stable hash so the open-time re-seed compares cheaply. */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
