'use client';

// =============================================================================
// WebsiteEditorPendingBanner — warn-tinted lock banner that mounts above the
// editor for a Lane B submitter while their submission is pending operator
// review. Design doc §3.3 + the Session 5 plan message (decision 4).
//
// The banner is per-user — operators never see it, since they're the one
// expected to act on the pending submission. Logic for "who is the
// submitter" lives in the page-level wrappers (header / footer / [pageId])
// via `useUserPendingSubmission`.
//
// Affordances:
//   - "Recall submission →"  pulls the pending back to draft state. The
//                            submitter resumes editing from where they left
//                            off (their draft was retained — see §3.3).
//   - "Open ticket →"        deep-links to the website-approvals tab so the
//                            submitter can see the queue position / op
//                            commentary.
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { recallSubmission } from '@/lib/website/publish-stub';
import type { WebsiteApprovalSubmission } from '@/lib/tickets/website-approval-stub';

const TIME_FORMAT = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIME_FORMAT.format(date);
}

export type WebsiteEditorPendingBannerProps = {
  submission: WebsiteApprovalSubmission;
  /** Who'll review — currently "Craig" since the stub layer has one admin.
   *  When real auth ships this comes from the workspace operator-of-record. */
  reviewerName?: string;
};

export function WebsiteEditorPendingBanner({
  submission,
  reviewerName = 'Craig',
}: WebsiteEditorPendingBannerProps) {
  const router = useRouter();

  const handleRecall = useCallback(() => {
    const ok = window.confirm(
      'Pull this submission back to draft? Your edits stay; the review queue entry is cancelled.',
    );
    if (!ok) return;
    recallSubmission(submission.id);
    // Stay on the editor — recalling unlocks the page in-place.
    router.refresh();
  }, [submission.id, router]);

  return (
    <div
      data-slot="website-pending-banner"
      className="flex items-center justify-between gap-4 border-b border-warn/30 bg-warn-soft px-5 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warn/15 font-mono text-[13px] font-bold text-warn"
        >
          !
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink">
            Submitted for review · waiting on{' '}
            <span className="text-rust">{reviewerName}</span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            Sent {formatSubmittedAt(submission.submittedAt)} ·{' '}
            {submission.diff.fieldsChanged}{' '}
            {submission.diff.fieldsChanged === 1 ? 'field' : 'fields'} across{' '}
            {submission.diff.sectionsChanged}{' '}
            {submission.diff.sectionsChanged === 1 ? 'section' : 'sections'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/tickets">Open ticket →</Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={handleRecall}>
          Recall submission ↩
        </Button>
      </div>
    </div>
  );
}
