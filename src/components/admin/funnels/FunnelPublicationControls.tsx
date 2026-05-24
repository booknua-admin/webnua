'use client';

// =============================================================================
// FunnelPublicationControls — operator-only publication management for a
// funnel (Phase 8 + A3 gap close). Today: Unpublish — pull a live funnel
// offline so the public URL stops resolving. The previously-live version is
// archived (history still renders it); the draft is preserved so editing
// continues. Operator can re-publish later from the /funnels/[id]/review
// surface.
//
// Mounts only when:
//   • the signed-in user is an operator (role === 'admin')
//   • AND holds the `publish` capability
//   • AND the funnel has a published version (nothing to unpublish otherwise)
//
// Renders null in every other case — keeps the per-client detail page clean.
//
// Confirm + reason copy is destructive-tinted via `ConfirmDialog`. The
// underlying mutation refuses while a pending approval submission is in
// flight; the error surfaces inline.
// =============================================================================

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useUser } from '@/lib/auth/user-stub';
import { unpublishFunnel } from '@/lib/funnel/mutations';

type Props = {
  funnelId: string;
  publishedVersionId: string | null;
};

const REASON_LABEL: Record<string, string> = {
  not_found: 'Could not find the funnel.',
  not_published: 'Funnel is already unpublished.',
  pending_submission:
    'A pending approval submission is in flight — resolve it first (approve, reject, or recall).',
};

export function FunnelPublicationControls({ funnelId, publishedVersionId }: Props) {
  const user = useUser();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role !== 'admin') return null;
  if (!user.capabilities.has('publish')) return null;
  if (!publishedVersionId) return null;

  async function handleConfirm() {
    if (!user) return;
    setBusy(true);
    setError(null);
    const res = await unpublishFunnel(funnelId, {
      id: user.id,
      displayName: user.displayName,
    });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      setError(REASON_LABEL[res.reason] ?? 'Could not unpublish.');
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-rule bg-card px-5 py-3.5">
      <div className="flex flex-col gap-0.5">
        <Eyebrow tone="quiet">Publication</Eyebrow>
        <p className="text-[13px] text-ink">
          This funnel is <strong>live</strong>. Pull it offline to stop the
          public URL resolving.
        </p>
        {error ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
            {error}
          </p>
        ) : null}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-warn/40 text-warn hover:bg-warn/5"
        onClick={() => setConfirming(true)}
        disabled={busy}
      >
        {busy ? 'Unpublishing…' : 'Unpublish'}
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
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
        onConfirm={handleConfirm}
      />
    </div>
  );
}
