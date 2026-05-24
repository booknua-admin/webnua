'use client';

// =============================================================================
// FunnelSlugEditor — shows a funnel's public URL ({host}/{slug}) and lets an
// operator edit the slug inline. The slug is unique per client; a clash comes
// back from updateFunnelSlug as a friendly message.
//
// Also surfaces the funnel's publish state to operators: a contextual button
// to the right of the URL row — "Unpublish" when live, "Publish →" (linking
// to the /funnels/[id]/review surface) when draft-only. Operator-only via
// the `publish` capability + role='admin' guard; clients see the row without
// the publish/unpublish affordance (their publish path is the review
// surface, reached via the editor toolbar).
//
// On a successful slug save the builder event fires, so the funnel detail
// page (useFunnelWithDraft) refetches and re-renders this with the new slug.
// =============================================================================

import Link from 'next/link';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/lib/auth/user-stub';
import { unpublishFunnel, updateFunnelSlug } from '@/lib/funnel/mutations';

type Props = {
  funnelId: string;
  /** The host the funnel lives on, e.g. "voltline.webnua.dev". */
  host: string;
  slug: string;
  canEdit: boolean;
  /** Drives the publish/unpublish toggle. NULL = no published version,
   *  show "Publish →"; populated = funnel is live, show "Unpublish". */
  publishedVersionId: string | null;
};

const UNPUBLISH_REASON_LABEL: Record<string, string> = {
  not_found: 'Could not find the funnel.',
  not_published: 'Funnel is already unpublished.',
  pending_submission:
    'A pending approval submission is in flight — resolve it first.',
};

export function FunnelSlugEditor({
  funnelId,
  host,
  slug,
  canEdit,
  publishedVersionId,
}: Props) {
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Publish-toggle state — owned here so the row's right slot can drive
  // it without a separate component.
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);

  const liveUrl = `${host}/${slug}`;
  const isLive = Boolean(publishedVersionId);
  const canPublish = Boolean(
    user && user.role === 'admin' && user.capabilities.has('publish'),
  );

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

  async function handleUnpublishConfirm() {
    if (!user) return;
    setUnpublishing(true);
    setUnpublishError(null);
    const res = await unpublishFunnel(funnelId, {
      id: user.id,
      displayName: user.displayName,
    });
    setUnpublishing(false);
    setConfirmingUnpublish(false);
    if (!res.ok) {
      setUnpublishError(UNPUBLISH_REASON_LABEL[res.reason] ?? 'Could not unpublish.');
    }
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
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
          {canPublish ? (
            isLive ? (
              <Button
                size="sm"
                variant="outline"
                className="border-warn/40 text-warn hover:bg-warn/5"
                onClick={() => setConfirmingUnpublish(true)}
                disabled={unpublishing}
              >
                {unpublishing ? 'Unpublishing…' : 'Unpublish'}
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href={`/funnels/${funnelId}/review`}>Publish →</Link>
              </Button>
            )
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-[13px] text-warn">{error}</p> : null}
      {unpublishError ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
          {unpublishError}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-ink-quiet">
        {isLive
          ? 'Visitors reach this funnel at the address above.'
          : "Visitors reach this funnel at the address above once it's published."}
      </p>

      <ConfirmDialog
        open={confirmingUnpublish}
        onOpenChange={(open) => {
          if (!unpublishing) setConfirmingUnpublish(open);
        }}
        tone="destructive"
        title="Unpublish this funnel?"
        description={
          <>
            The public URL will return a not-published response. The draft and
            version history are preserved — you can re-publish from the review
            surface any time.
          </>
        }
        confirmLabel="Unpublish"
        cancelLabel="Keep live"
        onConfirm={handleUnpublishConfirm}
      />
    </div>
  );
}
