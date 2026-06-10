'use client';

// =============================================================================
// SocialCalendarContent — the /social body (both roles).
//
// Action-first: a "✦ Draft my next 30 days" button fills the calendar with
// AI drafts; "Approve all" clears the whole month in one tap; each card is
// individually editable. Approved posts auto-publish to the client's
// Facebook Page at their scheduled time (the every-15-min worker).
// =============================================================================

import { useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  useApproveAllSocialPosts,
  useGenerateSocialCalendar,
  useSocialPosts,
} from '@/lib/social/queries';

import { SocialPostCard } from './SocialPostCard';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export function SocialCalendarContent({ clientUuid }: { clientUuid: string | null }) {
  // Poll for ~45s after a draft run is requested so the new cards appear
  // as the job lands without a manual refresh.
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: posts, isLoading } = useSocialPosts(clientUuid, polling);
  const generate = useGenerateSocialCalendar();
  const approveAll = useApproveAllSocialPosts();
  const [error, setError] = useState<string | null>(null);

  const drafts = useMemo(
    () => (posts ?? []).filter((p) => p.status === 'draft'),
    [posts],
  );
  const upcoming = useMemo(
    () =>
      (posts ?? []).filter(
        (p) =>
          p.status !== 'published' ||
          // Keep the last fortnight of published posts visible as history.
          Date.now() - new Date(p.scheduled_for).getTime() < 14 * 86_400_000,
      ),
    [posts],
  );

  const handleGenerate = () => {
    if (!clientUuid) return;
    setError(null);
    generate.mutate(clientUuid, {
      onSuccess: () => {
        setPolling(true);
        if (pollTimer.current) clearTimeout(pollTimer.current);
        pollTimer.current = setTimeout(() => setPolling(false), 45_000);
      },
      onError: (e) => setError(e instanceof Error ? e.message : 'Something went wrong.'),
    });
  };

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Social" />} />
      <div className="flex flex-col gap-6 px-4 py-6 md:px-10 md:py-10">
        <PageHeader
          className="mb-0"
          eyebrow="Social calendar"
          title={
            <>
              Your <em>social posts</em>.
            </>
          }
          subtitle={
            <>
              AI drafts the month; <strong>you approve with one tap</strong>. Approved
              posts publish to your Facebook Page automatically at their scheduled time.
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={handleGenerate} disabled={!clientUuid || generate.isPending || polling}>
            {generate.isPending || polling ? '✦ Drafting…' : '✦ Draft my next 30 days'}
          </Button>
          {drafts.length > 0 ? (
            <Button
              variant="secondary"
              disabled={approveAll.isPending || !clientUuid}
              onClick={() => clientUuid && approveAll.mutate(clientUuid)}
            >
              {approveAll.isPending ? 'Approving…' : `Approve all (${drafts.length})`}
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-[12px] font-semibold text-warn">{error}</p> : null}

        {isLoading || !clientUuid ? (
          <Notice>{'// Loading calendar…'}</Notice>
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule bg-card px-6 py-12 text-center">
            <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              {'// NO POSTS YET'}
            </p>
            <p className="mx-auto max-w-[420px] text-[13px] leading-relaxed text-ink-soft">
              Tap <strong>✦ Draft my next 30 days</strong> and the AI writes a month of
              posts for your trade and area. You approve before anything goes out.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {upcoming.map((post) => (
              <SocialPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
