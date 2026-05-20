'use client';

// =============================================================================
// WebsiteActivityCard — "Recent website activity" panel on the `/website`
// hub. Thin adapter over the shared ActivityFeed primitive; sources from
// `useWebsiteVersions` (publish + draft events) plus the force-publish
// audit log when one exists.
//
// V1 sources from version metadata only — per-section / per-field edit
// granularity isn't captured in the version snapshot today (the content_drafts
// buffer is per-page but doesn't persist individual edits). Per-page-edit
// activity is a backend follow-up flagged alongside the funnel rollup
// step-granularity work (analytics-audit §2.2 / Session B).
// =============================================================================

import { ActivityFeed } from '@/components/shared/ActivityFeed';
import type { ActivityRowData } from '@/components/shared/ActivityRow';
import { useWebsiteVersions } from '@/lib/website/queries';
import type { Version } from '@/lib/website/types';

export type WebsiteActivityCardProps = {
  websiteId: string;
  /** Map of operator user id → display name, so "BY YOU / BY WEBNUA" can be
   *  resolved at the call site. The current signed-in user's id is the
   *  "YOU" marker. */
  currentUserId: string | null;
};

export function WebsiteActivityCard({
  websiteId,
  currentUserId,
}: WebsiteActivityCardProps) {
  const versionsQuery = useWebsiteVersions(websiteId);
  const versions = (versionsQuery.data ?? []) as Version[];

  const events: ActivityRowData[] = [...versions]
    .sort((a, b) =>
      (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
    )
    .slice(0, 6)
    .map((v) => {
      const isPublish = v.status === 'published' && v.publishedAt;
      const at = isPublish ? v.publishedAt! : v.createdAt;
      const actorId = v.publishedBy ?? v.createdBy;
      const isYou = currentUserId !== null && actorId === currentUserId;
      const tone = isPublish ? 'good' : isYou ? 'rust' : 'info';
      const icon = isPublish ? '↑' : isYou ? '✎' : '⟳';
      const action = isPublish
        ? 'published a new version'
        : v.status === 'draft'
          ? 'edited the draft'
          : v.status === 'pending_approval'
            ? 'submitted a draft for review'
            : 'archived a version';
      const detail = v.notes ? v.notes : undefined;
      return {
        id: v.id,
        icon,
        tone,
        actor: isYou ? 'You' : 'Webnua',
        body: ` ${action}.`,
        detail,
        time: relativeTime(at),
      };
    });

  return (
    <ActivityFeed
      title={
        <>
          Recent website <em>activity</em>
        </>
      }
      sub={
        <>
          Everything that&rsquo;s changed on your website lately &mdash; your
          edits in <strong>orange</strong>, Webnua&rsquo;s in <strong>blue</strong>.
        </>
      }
      items={events}
    />
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
