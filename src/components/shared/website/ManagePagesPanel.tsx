'use client';

// =============================================================================
// ManagePagesPanel — the page-rename editor (Dialog). Opened from the website
// hub's "// PAGES" row. Lists every page with its type + URL slug (read-only)
// and an editable display name (`Page.title`).
//
// Renaming a page also re-syncs the matching header menu item — that link
// happens in the `renamePages` mutation, not here. Saves to the draft
// snapshot. Mirrors the SeoPanel pattern.
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
import type { PageType } from '@/lib/website/types';

export type ManagePagesPanelPage = {
  id: string;
  title: string;
  type: PageType;
  slug: string;
};

export type ManagePagesPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: ManagePagesPanelPage[];
  onSave: (titlesByPageId: Record<string, string>) => Promise<boolean>;
};

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  generic: 'Page',
};

export function ManagePagesPanel({
  open,
  onOpenChange,
  pages,
  onSave,
}: ManagePagesPanelProps) {
  const seededTitles = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of pages) out[p.id] = p.title;
    return out;
  }, [pages]);

  const [titles, setTitles] = useState<Record<string, string>>(seededTitles);
  const [seedKey, setSeedKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSeedKey = useMemo(
    () => hashKey(JSON.stringify(seededTitles)),
    [seededTitles],
  );
  if (open && seedKey !== currentSeedKey) {
    setTitles(seededTitles);
    setSeedKey(currentSeedKey);
    setError(null);
  }

  const missingCount = pages.filter(
    (p) => (titles[p.id] ?? '').trim().length === 0,
  ).length;

  const handleSave = async () => {
    if (missingCount > 0) {
      setError('Every page needs a name.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: Record<string, string> = {};
    for (const p of pages) payload[p.id] = (titles[p.id] ?? '').trim();
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onOpenChange(false);
    else setError('Save failed — your page names were not persisted.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-0 overflow-hidden p-0" showCloseButton={false}>
        <div className="border-b border-paper-2 px-6 py-5">
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-rust-soft px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            ✦ Pages · names
          </p>
          <DialogTitle className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">
            Name every <em className="not-italic text-rust">page</em>.
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] text-ink-soft">
            The page name is what shows on the page cards and, by default, in
            the header menu.{' '}
            <strong className="text-ink">
              Renaming a page updates its header menu item too.
            </strong>{' '}
            The URL slug is fixed.
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-paper-2 bg-paper px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </p>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2.5">
            {pages.map((page) => (
              <div
                key={page.id}
                className="rounded-lg border border-rule bg-card px-4 py-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-pill bg-paper-2 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                    {PAGE_TYPE_LABEL[page.type]}
                  </span>
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-rust">
                    /{page.slug === 'home' ? '' : page.slug}
                  </span>
                </div>
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                  Page name
                </span>
                <Input
                  value={titles[page.id] ?? ''}
                  onChange={(e) =>
                    setTitles((cur) => ({ ...cur, [page.id]: e.target.value }))
                  }
                  placeholder="e.g. Home"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {error ? (
              <span className="text-warn">{error}</span>
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
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save names'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Tiny stable hash so the open-time re-seed compares cheaply. */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
