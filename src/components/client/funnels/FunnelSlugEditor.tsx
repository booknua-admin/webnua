'use client';

// =============================================================================
// FunnelSlugEditor — shows a funnel's public URL ({host}/{slug}) and lets an
// operator edit the slug inline. The slug is unique per client; a clash comes
// back from updateFunnelSlug as a friendly message.
//
// On a successful save the builder event fires, so the funnel detail page
// (useFunnelWithDraft) refetches and re-renders this with the new slug.
// =============================================================================

import { useState } from 'react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateFunnelSlug } from '@/lib/funnel/mutations';

type Props = {
  funnelId: string;
  /** The host the funnel lives on, e.g. "voltline.webnua.dev". */
  host: string;
  slug: string;
  canEdit: boolean;
};

export function FunnelSlugEditor({ funnelId, host, slug, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const liveUrl = `${host}/${slug}`;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateFunnelSlug(funnelId, value);
    setSaving(false);
    if (res.ok) {
      setValue(res.slug);
      setEditing(false);
    } else {
      setError(res.message);
    }
  }

  function cancel() {
    setValue(slug);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-rule bg-card px-6 py-5">
      <Eyebrow tone="rust" bullet>
        Public URL
      </Eyebrow>

      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] text-ink-quiet">{host}/</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-52"
            autoFocus
            aria-label="Funnel URL slug"
          />
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href={`https://${liveUrl}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[14px] font-semibold text-rust hover:underline"
          >
            {liveUrl}
          </a>
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit URL
            </Button>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-[13px] text-warn">{error}</p> : null}
      <p className="mt-2 text-[12px] text-ink-quiet">
        Visitors reach this funnel at the address above once it&rsquo;s
        published.
      </p>
    </div>
  );
}
