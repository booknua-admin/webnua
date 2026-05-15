'use client';

// =============================================================================
// WebsiteApprovalRow — single pending-website-submission row inside the
// "Website approvals" tab on /tickets. Admin-only.
//
// Layout: 4-cell grid + footer affordances + inline reject expansion.
//   [submitter avatar] [diff summary + meta] [age] [actions]
//
// Per the Session 5 plan (decision 3), Reject uses inline collapsible row.
// Clicking ✗ Reject swaps the actions row for a textarea + Cancel / Submit.
// Submitting calls publish-stub.rejectSubmission(submissionId, reason).
//
// Approve & publish promotes the pending Version → published in one step
// (publish-stub.approveSubmission).
//
// "Edit in editor" deep-links into the page editor at the submitted page;
// for now it routes to /website since per-page deep-link wasn't requested
// in the plan and submissions today are website-level (any of their pages
// could have changed).
// =============================================================================

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import { adminClients } from '@/lib/nav/admin-clients';
import { findWebsite } from '@/lib/website/data-stub';
import {
  approveSubmission,
  rejectSubmission,
} from '@/lib/website/publish-stub';
import type { WebsiteApprovalSubmission } from '@/lib/tickets/website-approval-stub';
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
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIME_FORMATTER.format(date);
}

function summariseDiff(d: WebsiteApprovalSubmission['diff']): string {
  if (d.fieldsChanged === 0) return 'No content differences';
  const fieldsWord = d.fieldsChanged === 1 ? 'field' : 'fields';
  const sectionsWord = d.sectionsChanged === 1 ? 'section' : 'sections';
  return `${d.fieldsChanged} ${fieldsWord} in ${d.sectionsChanged} ${sectionsWord}`;
}

export type WebsiteApprovalRowProps = {
  submission: WebsiteApprovalSubmission;
};

export function WebsiteApprovalRow({ submission }: WebsiteApprovalRowProps) {
  const user = useUser();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const website = findWebsite(submission.websiteId);
  const client = website
    ? adminClients.find((c) => c.id === website.clientId)
    : null;
  const clientName = client?.name ?? website?.name ?? submission.websiteId;
  const clientInitial = clientName.charAt(0).toUpperCase();

  const handleApprove = () => {
    if (!user) return;
    approveSubmission(submission.id, {
      id: user.id,
      displayName: user.displayName,
    });
  };

  const handleRejectSubmit = () => {
    if (!user) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) return;
    rejectSubmission(
      submission.id,
      { id: user.id, displayName: user.displayName },
      trimmed,
    );
    setRejecting(false);
    setReason('');
  };

  return (
    <div
      data-slot="website-approval-row"
      className="border-b border-paper-2 px-[18px] py-4 last:border-b-0"
    >
      <div className="grid grid-cols-[36px_1fr_90px_auto] items-center gap-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-rust/15 font-mono text-[13px] font-bold text-rust">
          {clientInitial}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink">
            {clientName}{' '}
            <span className="text-ink-quiet">·</span>{' '}
            <span className="font-normal text-ink-soft">
              {summariseDiff(submission.diff)}
            </span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            From <strong className="text-ink">{submission.submitterName}</strong>{' '}
            · Submitted {formatTime(submission.submittedAt)} ·{' '}
            {submission.diff.pagesChanged}{' '}
            {submission.diff.pagesChanged === 1 ? 'page' : 'pages'} touched
          </p>
        </div>
        <p className="text-right font-mono text-[12px] text-ink-quiet">
          {relativeAge(submission.submittedAt)}
        </p>
        <div className="flex items-center gap-1.5">
          {rejecting ? null : (
            <>
              <Button size="sm" onClick={handleApprove}>
                Approve & publish ✓
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/website">Open in editor →</Link>
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
            // REJECTION REASON
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being sent back? The submitter sees your reason as a ticket reply."
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
