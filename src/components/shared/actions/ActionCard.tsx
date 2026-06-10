'use client';

// =============================================================================
// ActionCard — one approvable card in the action-first feed.
//
// The owner-facing unit of the approval-first UX: kind-tinted icon + headline
// + the AI's detection chip + the draft body + Approve / Edit / Dismiss. The
// Edit path expands an inline textarea seeded with the draft so a non-
// technical owner can tweak a sentence and send without leaving the card.
// =============================================================================

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApproveAction, useDismissAction } from '@/lib/actions/queries';
import { APPROVE_LABEL, type SuggestedActionKind, type SuggestedActionRow } from '@/lib/actions/types';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/time';

const KIND_PRESENTATION: Record<SuggestedActionKind, { icon: string; tile: string }> = {
  reply_draft: { icon: '✉', tile: 'bg-info/10 text-info' },
  ads_budget: { icon: '€', tile: 'bg-rust-soft text-rust' },
  ads_pause: { icon: '‖', tile: 'bg-warn/10 text-warn' },
  ads_creative_refresh: { icon: '✦', tile: 'bg-rust-soft text-rust' },
  review_reply_draft: { icon: '★', tile: 'bg-amber/10 text-amber' },
  followup_nudge: { icon: '⤿', tile: 'bg-rust-soft text-rust' },
  generic: { icon: '•', tile: 'bg-paper-2 text-ink-quiet' },
};

/** Kinds whose body is an editable draft (Edit-then-approve). */
const EDITABLE_KINDS: ReadonlySet<SuggestedActionKind> = new Set([
  'reply_draft',
  'review_reply_draft',
]);

export function ActionCard({ action }: { action: SuggestedActionRow }) {
  const router = useRouter();
  const approve = useApproveAction();
  const dismiss = useDismissAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.body);
  const [error, setError] = useState<string | null>(null);

  const presentation = KIND_PRESENTATION[action.kind] ?? KIND_PRESENTATION.generic;
  const isUrgent = action.urgency === 'high';
  const leadId =
    typeof action.payload.leadId === 'string' ? (action.payload.leadId as string) : null;

  const busy = approve.isPending || dismiss.isPending;

  const handleApprove = (bodyOverride?: string) => {
    setError(null);
    approve.mutate(
      { id: action.id, body: bodyOverride },
      {
        onSuccess: () => {
          setEditing(false);
          // A follow-up nudge's approval IS "go work the lead" — land there.
          if (action.kind === 'followup_nudge' && leadId) {
            router.push(`/leads/${leadId}`);
          }
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Something went wrong.'),
      },
    );
  };

  const handleDismiss = () => {
    setError(null);
    dismiss.mutate(action.id, {
      onError: (e) => setError(e instanceof Error ? e.message : 'Something went wrong.'),
    });
  };

  return (
    <article
      className={cn(
        'rounded-xl border bg-card px-4 py-4 md:px-5',
        isUrgent ? 'border-warn/40' : 'border-rule',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-[15px] font-bold',
            presentation.tile,
          )}
        >
          {presentation.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-[14.5px] font-bold tracking-[-0.01em] text-ink">
              {action.title}
            </h3>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
              {relativeTime(action.created_at)}
            </span>
          </div>
          {action.explanation ? (
            <p
              className={cn(
                'mt-1 inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
                isUrgent ? 'bg-warn/10 text-warn' : 'bg-paper-2 text-ink-quiet',
              )}
            >
              {action.explanation}
            </p>
          ) : null}
        </div>
      </div>

      {action.body && !editing ? (
        <blockquote className="mt-3 whitespace-pre-wrap rounded-lg border-l-[3px] border-rule bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
          {action.body}
        </blockquote>
      ) : null}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-32 font-sans text-[13px]"
            aria-label="Edit the drafted reply"
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[12px] font-semibold text-warn">{error}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={busy || !draft.trim()}
              onClick={() => handleApprove(draft)}
            >
              {approve.isPending ? 'Sending…' : 'Send edited →'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft(action.body);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={busy} onClick={() => handleApprove()}>
              {approve.isPending ? 'Working…' : APPROVE_LABEL[action.kind]}
            </Button>
            {EDITABLE_KINDS.has(action.kind) ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" disabled={busy} onClick={handleDismiss}>
              Dismiss
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
