'use client';

// =============================================================================
// FunnelApprovalRow — single pending-funnel-submission row inside the
// "Approvals" tab on /tickets. Admin-only. The funnel-shaped sibling of
// WebsiteApprovalRow (A3).
//
// Layout: 4-cell grid + footer affordances + inline reject expansion.
//   [client avatar] [funnel + diff summary + meta] [age] [actions]
//
// Reject expands inline (same pattern as WebsiteApprovalRow decision 3) —
// clicking ✗ Reject swaps the actions row for a reason textarea.
//
// Approve & publish promotes the pending funnel_version → published in one
// step (`approveFunnelSubmission`). "Open in editor →" routes to the funnel
// detail page — funnel submissions are funnel-level (every step ships as a
// unit), and the detail page carries the editor deep-link.
// =============================================================================

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import type { FunnelApprovalSubmission } from '@/lib/funnel/approval';
import {
  approveFunnelSubmission,
  rejectFunnelSubmission,
} from '@/lib/funnel/mutations';
import { cn } from '@/lib/utils';

const TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function relativeAge(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIME_FORMATTER.format(date);
}

function summariseDiff(d: FunnelApprovalSubmission['diff']): string {
  if (d.fieldsChanged === 0) return 'No content differences';
  const fieldsWord = d.fieldsChanged === 1 ? 'field' : 'fields';
  const stepsWord = d.sectionsChanged === 1 ? 'section' : 'sections';
  return `${d.fieldsChanged} ${fieldsWord} in ${d.sectionsChanged} ${stepsWord}`;
}

export type FunnelApprovalRowProps = {
  submission: FunnelApprovalSubmission;
};

export function FunnelApprovalRow({ submission }: FunnelApprovalRowProps) {
  const user = useUser();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const clientName = submission.clientName ?? 'Funnel';
  const funnelName = submission.funnelName ?? 'A funnel';
  const clientInitial = clientName.charAt(0).toUpperCase();
  const stepsLabel = `${submission.diff.pagesChanged} ${
    submission.diff.pagesChanged === 1 ? 'step' : 'steps'
  } touched`;

  const handleApprove = async () => {
    if (!user) return;
    await approveFunnelSubmission(submission.id, {
      id: user.id,
      displayName: user.displayName,
    });
  };

  const handleRejectSubmit = async () => {
    if (!user) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) return;
    await rejectFunnelSubmission(
      submission.id,
      { id: user.id, displayName: user.displayName },
      trimmed,
    );
    setRejecting(false);
    setReason('');
  };

  return (
    <div
      data-slot="funnel-approval-row"
      className="border-b border-paper-2 px-[18px] py-4 last:border-b-0"
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[36px_1fr_90px_auto] lg:items-center lg:gap-4">
        <div className="flex items-start gap-3 lg:contents">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rust/15 font-mono text-[13px] font-bold text-rust">
            {clientInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink">
              {clientName}{' '}
              <span className="font-normal text-ink-quiet">·</span>{' '}
              <span className="font-normal text-ink-soft">
                {summariseDiff(submission.diff)}
              </span>
              <span className="ml-2 rounded-pill bg-rust/10 px-1.5 py-0.5 align-middle font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-rust">
                Funnel
              </span>
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
              From <strong className="text-ink">{submission.submitterName}</strong>{' '}
              · Submitted {formatTime(submission.submittedAt)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-rust">
              Funnel: <span className="text-ink">{funnelName}</span> · {stepsLabel}
            </p>
          </div>
          <p className="shrink-0 font-mono text-[12px] text-ink-quiet lg:text-right">
            {relativeAge(submission.submittedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {rejecting ? null : (
            <>
              <Button size="sm" onClick={handleApprove}>
                Approve & publish ✓
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href={`/funnels/${submission.funnelId}`}>
                  Open in editor →
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejecting(true)}
                className="text-warn hover:text-warn"
              >
                Reject ✗
              </Button>
            </>
          )}
        </div>
      </div>

      {rejecting ? (
        <div className="mt-3 rounded-md border border-warn/30 bg-warn-soft/50 p-3">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            {'// REJECTION REASON'}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being sent back? The submitter sees your reason when they reopen the funnel."
            className="min-h-20 bg-card"
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRejectSubmit}
              className={cn(
                'bg-warn text-paper hover:bg-warn/90',
                reason.trim().length === 0 && 'opacity-50',
              )}
            >
              Submit rejection ↩
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
