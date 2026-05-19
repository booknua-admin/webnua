'use client';

// =============================================================================
// SeoPanel — the site-wide SEO editor (Dialog). Lists every page (or every
// funnel step) with its meta title + description, char counters, a per-row
// AI regenerate, and a master "Auto-fill all" that drafts metadata for the
// whole site in one click via the Claude-backed /api/generate-seo route
// (deterministic fallback when the route is unconfigured).
//
// Generic over websites + funnels — both pass a `SeoPanelTarget[]` and an
// `onSave` that persists to the right draft snapshot. Title / description are
// the only fields edited here (the preflight blockers); ogImage is left to a
// later asset-management pass.
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  generateSeo,
  type SeoBusinessContext,
  type SeoTarget,
} from '@/lib/website/seo-generate';
import type { PageSEO, Section } from '@/lib/website/types';

export type SeoPanelTarget = {
  id: string;
  /** Page / step title — the row heading + deterministic title seed. */
  label: string;
  /** Display kind ("Home", "Landing", …). */
  kindLabel: string;
  /** Raw kind passed to the generator for extra context. */
  kind: string;
  sections: Section[];
  seo: PageSEO;
};

export type SeoPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: SeoPanelTarget[];
  business: SeoBusinessContext;
  /** "website" | "funnel" — used in the panel copy. */
  scopeLabel: string;
  onSave: (seoById: Record<string, PageSEO>) => Promise<boolean>;
};

const TITLE_IDEAL = { min: 30, max: 60 };
const DESC_IDEAL = { min: 70, max: 158 };

type DraftEntry = { title: string; description: string };

function toTarget(t: SeoPanelTarget): SeoTarget {
  return {
    id: t.id,
    label: t.label,
    kind: t.kind,
    sections: t.sections,
    seo: t.seo,
  };
}

export function SeoPanel({
  open,
  onOpenChange,
  targets,
  business,
  scopeLabel,
  onSave,
}: SeoPanelProps) {
  const seededDrafts = useMemo<Record<string, DraftEntry>>(() => {
    const out: Record<string, DraftEntry> = {};
    for (const t of targets) {
      out[t.id] = {
        title: t.seo.title ?? '',
        description: t.seo.description ?? '',
      };
    }
    return out;
  }, [targets]);

  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>(seededDrafts);
  const [seedKey, setSeedKey] = useState(0);
  const [busyAll, setBusyAll] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the dialog re-opens against a fresh target set.
  const currentSeedKey = useMemo(() => JSON.stringify(seededDrafts), [seededDrafts]);
  if (open && seedKey !== hashKey(currentSeedKey)) {
    setDrafts(seededDrafts);
    setSeedKey(hashKey(currentSeedKey));
    setError(null);
  }

  const setField = (id: string, field: keyof DraftEntry, value: string) => {
    setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], [field]: value } }));
  };

  const autofillAll = async () => {
    setBusyAll(true);
    setError(null);
    try {
      const generated = await generateSeo(targets.map(toTarget), business);
      setDrafts((cur) => {
        const next = { ...cur };
        for (const t of targets) {
          const g = generated[t.id];
          if (g) next[t.id] = { title: g.title, description: g.description };
        }
        return next;
      });
    } catch {
      setError('AI auto-fill failed — edit the fields manually or retry.');
    } finally {
      setBusyAll(false);
    }
  };

  const regenRow = async (target: SeoPanelTarget) => {
    setBusyRow(target.id);
    setError(null);
    try {
      const generated = await generateSeo([toTarget(target)], business);
      const g = generated[target.id];
      if (g) {
        setDrafts((cur) => ({
          ...cur,
          [target.id]: { title: g.title, description: g.description },
        }));
      }
    } catch {
      setError('AI auto-fill failed — edit the fields manually or retry.');
    } finally {
      setBusyRow(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, PageSEO> = {};
    for (const t of targets) {
      const d = drafts[t.id];
      payload[t.id] = {
        title: d.title.trim(),
        description: d.description.trim(),
      };
    }
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onOpenChange(false);
    else setError('Save failed — your SEO changes were not persisted.');
  };

  const missingCount = targets.filter(
    (t) => drafts[t.id]?.title.trim().length === 0,
  ).length;
  const busy = busyAll || saving || busyRow != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-0 overflow-hidden p-0" showCloseButton={false}>
        <div className="border-b border-paper-2 px-6 py-5">
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-rust-soft px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            ✦ SEO · whole {scopeLabel}
          </p>
          <DialogTitle className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">
            Search metadata for every{' '}
            <em className="not-italic text-rust">page</em>.
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] text-ink-soft">
            The meta title + description are what Google shows in results. Use{' '}
            <strong className="text-ink">Auto-fill all</strong> to draft them
            from each page&rsquo;s own copy, then tweak.
            {missingCount > 0 ? (
              <>
                {' '}
                <strong className="text-warn">
                  {missingCount} page{missingCount === 1 ? '' : 's'} still
                  missing a title.
                </strong>
              </>
            ) : null}
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-paper-2 bg-paper px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {targets.length} {targets.length === 1 ? 'page' : 'pages'}
          </p>
          <Button size="sm" variant="secondary" onClick={autofillAll} disabled={busy}>
            {busyAll ? 'Drafting…' : '✦ Auto-fill all pages'}
          </Button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            {targets.map((target) => {
              const d = drafts[target.id] ?? { title: '', description: '' };
              return (
                <div
                  key={target.id}
                  className="rounded-lg border border-rule bg-card px-4 py-3.5"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-pill bg-paper-2 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                        {target.kindLabel}
                      </span>
                      <span className="truncate text-[13px] font-bold text-ink">
                        {target.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => regenRow(target)}
                      disabled={busy}
                      className="shrink-0 rounded-md border border-rule bg-card px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust transition-colors hover:border-rust disabled:opacity-45"
                    >
                      {busyRow === target.id ? 'Drafting…' : '✦ Regen'}
                    </button>
                  </div>

                  <FieldLabel
                    text="Meta title"
                    count={d.title.trim().length}
                    ideal={TITLE_IDEAL}
                  />
                  <Input
                    value={d.title}
                    onChange={(e) => setField(target.id, 'title', e.target.value)}
                    placeholder="e.g. Same-day electricians in Perth · Voltline"
                    className="mb-3"
                  />

                  <FieldLabel
                    text="Meta description"
                    count={d.description.trim().length}
                    ideal={DESC_IDEAL}
                  />
                  <Textarea
                    value={d.description}
                    onChange={(e) =>
                      setField(target.id, 'description', e.target.value)
                    }
                    placeholder="One or two plain sentences naming the outcome and a reason to click."
                    className="min-h-16 font-sans text-[13px]"
                  />
                </div>
              );
            })}
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
            <Button size="sm" onClick={handleSave} disabled={busy}>
              {saving ? 'Saving…' : 'Save SEO'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({
  text,
  count,
  ideal,
}: {
  text: string;
  count: number;
  ideal: { min: number; max: number };
}) {
  const tone =
    count === 0
      ? 'text-warn'
      : count < ideal.min || count > ideal.max
        ? 'text-amber'
        : 'text-good';
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
        {text}
      </span>
      <span className={cn('font-mono text-[10px] tabular-nums', tone)}>
        {count} / {ideal.max}
      </span>
    </div>
  );
}

/** Tiny stable hash so the open-time re-seed compares cheaply. */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
