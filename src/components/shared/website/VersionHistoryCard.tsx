'use client';

// =============================================================================
// VersionHistoryCard — ink-bg list of recent versions for a website.
// Same shape family as client/funnels/FunnelHistoryCard but reads the
// Session 2 Version model (status enum, parentVersionId, etc.) instead
// of the older FunnelVersion shape.
//
// Status pills:
//   published → rust filled (the live one) OR rust-light on ink (history)
//   draft     → ink-quiet on ink (current draft)
//   pending_approval → warn-soft (waiting for review)
//   archived  → ink/15 (old, rollback target)
// =============================================================================

import type { ReactNode } from 'react';

import { useCallback, useState } from 'react';

import { useUser } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';
import { restoreVersionAsDraft } from '@/lib/website/publish-stub';
import type { Version, VersionStatus } from '@/lib/website/types';
import { useWebsitePublishState } from '@/lib/website/use-publish-state';

const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'DRAFT',
  pending_approval: 'PENDING',
  published: 'LIVE',
  archived: 'ARCHIVED',
};

export type VersionHistoryCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  versions: Version[];
  /** The id of the currently-live published version. Rendered as the rust
   *  pill in the list, distinguishing it from older published archives. */
  currentPublishedId: string | null;
  /** Website id — Session 8 — needed to scope `restoreVersionAsDraft`.
   *  Optional so existing demo / read-only call sites keep working; when
   *  omitted, the Restore affordance is hidden. */
  websiteId?: string;
  /** Whether to allow restore from any non-current version. Defaults to
   *  true when `websiteId` is set; opt-out for surfaces that just want
   *  to display history (e.g. /settings/access audit feed). */
  allowRestore?: boolean;
  className?: string;
};

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIMESTAMP_FORMATTER.format(date);
}

export function VersionHistoryCard({
  title,
  subtitle,
  versions,
  currentPublishedId,
  websiteId,
  allowRestore = true,
  className,
}: VersionHistoryCardProps) {
  const user = useUser();
  // When websiteId is present, peek at pending submissions — restore is
  // refused while one is in flight (publish-stub enforces this too).
  const publishState = useWebsitePublishState(websiteId ?? '');
  const hasPending = Boolean(websiteId && publishState.livePendingSubmission);

  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = useCallback(
    (versionId: string) => {
      if (!websiteId || !user) return;
      if (
        !window.confirm(
          'Restore this version as a new draft? Any unsaved local edits will be cleared and the editor will rehydrate from the restored snapshot.',
        )
      ) {
        return;
      }
      setPendingRestoreId(versionId);
      setError(null);
      const result = restoreVersionAsDraft(websiteId, versionId, {
        id: user.id,
        displayName: user.displayName,
      });
      setPendingRestoreId(null);
      if (!result) {
        setError(
          'Restore refused — usually because a pending submission is in flight on this website.',
        );
      }
    },
    [websiteId, user],
  );

  const restoreEnabled =
    allowRestore && Boolean(websiteId) && Boolean(user) && !hasPending;

  return (
    <div
      data-slot="version-history-card"
      className={cn(
        'relative overflow-hidden rounded-[14px] bg-ink px-6 py-5 text-paper',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-[220px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232, 116, 59, 0.13) 0%, transparent 70%)',
        }}
      />
      <div className="relative">
        <h3 className="mb-1 text-[15px] font-extrabold tracking-[-0.015em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {title}
        </h3>
        {subtitle ? (
          <p className="mb-4 text-[12px] leading-[1.45] text-paper/60 [&_strong]:font-bold [&_strong]:text-paper">
            {subtitle}
          </p>
        ) : null}

        {hasPending && restoreEnabled ? (
          <p className="mb-3 rounded-md bg-warn/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
            Pending submission in flight · restore disabled
          </p>
        ) : null}

        {versions.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/55">
            No versions yet.
          </p>
        ) : (
          <div>
            {versions.map((v) => (
              <VersionHistoryItem
                key={v.id}
                version={v}
                isCurrent={v.id === currentPublishedId}
                restoreEnabled={restoreEnabled && !hasPending}
                onRestore={handleRestore}
                pending={pendingRestoreId === v.id}
              />
            ))}
          </div>
        )}

        {error ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VersionHistoryItem({
  version,
  isCurrent,
  restoreEnabled,
  onRestore,
  pending,
}: {
  version: Version;
  isCurrent: boolean;
  restoreEnabled: boolean;
  onRestore: (versionId: string) => void;
  pending: boolean;
}) {
  const pillClass = isCurrent
    ? 'bg-rust text-paper'
    : version.status === 'draft'
      ? 'bg-paper/12 text-paper'
      : version.status === 'pending_approval'
        ? 'bg-warn/30 text-warn'
        : 'bg-rust/18 text-rust-light';

  const label = isCurrent && version.status === 'published'
    ? 'LIVE'
    : STATUS_LABEL[version.status];

  // Restore makes sense for any non-current version that holds a real
  // snapshot — published archives + archived rows. Current draft / live
  // version + pending submissions don't get the affordance.
  const canRestore =
    restoreEnabled &&
    !isCurrent &&
    (version.status === 'published' || version.status === 'archived');

  return (
    <div
      data-slot="version-history-item"
      className="grid grid-cols-[60px_1fr_auto_auto] items-center gap-3 border-b border-dotted border-paper/10 py-2.5 last:border-b-0"
    >
      <span
        className={cn(
          'rounded-md py-1 text-center font-mono text-[9px] font-extrabold uppercase tracking-[0.08em]',
          pillClass,
        )}
      >
        {label}
      </span>
      <span className="min-w-0 truncate text-[12.5px] text-paper/85">
        {version.notes ?? '—'}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/55">
        {formatTimestamp(version.publishedAt ?? version.createdAt)}
      </span>
      {canRestore ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onRestore(version.id)}
          className="rounded-md bg-paper/[0.08] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-paper/80 transition-colors hover:bg-rust hover:text-paper disabled:opacity-50"
        >
          {pending ? '…' : '↺ Restore'}
        </button>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}
