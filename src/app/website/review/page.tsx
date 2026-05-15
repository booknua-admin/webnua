'use client';

// =============================================================================
// /website/review — the pre-publish review surface (Session 8, design doc §7).
//
// Runs the preflight rule engine against the effective draft snapshot (seed
// draft Version merged with localStorage edits) and renders:
//   - the PreflightChecklist (pass / warn / fail summary + issue list)
//   - a per-page review-card grid
//   - the domain status indicator
//   - the publish action, following the §3.3 capability lane:
//       has `publish`            → Publish → (blocked by hard fails)
//       any edit cap, no publish → Submit for review →
//       view-only                → no action
//
// Hard-fail rules block publish entirely. Warnings allow publish behind a
// confirm. This is a website-wide surface — publishing is a whole-website
// operation in the current publish model (`publishDraft(websiteId)`).
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DomainStatusIndicator } from '@/components/shared/website/DomainStatusIndicator';
import { PageReviewCard } from '@/components/shared/website/PageReviewCard';
import { PreflightChecklist } from '@/components/shared/website/PreflightChecklist';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useCan, useCanAny, useUser } from '@/lib/auth/user-stub';
import { findWebsiteByClient } from '@/lib/website/data-stub';
import {
  getEffectiveDraftSnapshot,
  publishDraft,
  submitForApproval,
} from '@/lib/website/publish-stub';
import { groupResultsByPage, runPreflight } from '@/lib/website/preflight';
import type { Website } from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsiteReviewPage() {
  const user = useUser();
  const workspace = useWorkspace();

  if (!workspace.hydrated || !user) {
    return (
      <ReviewShell>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving workspace…'}
        </p>
      </ReviewShell>
    );
  }

  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  if (!activeClientId) {
    return (
      <ReviewShell>
        <EmptyState
          message={
            user.role === 'admin'
              ? 'Switch into a client workspace to review their website.'
              : 'No workspace resolved for this user.'
          }
        />
      </ReviewShell>
    );
  }

  const website = findWebsiteByClient(activeClientId);
  if (!website) {
    return (
      <ReviewShell>
        <EmptyState message="This workspace has no website yet." />
      </ReviewShell>
    );
  }

  return <ReviewSurface website={website} />;
}

function ReviewSurface({ website }: { website: Website }) {
  const router = useRouter();
  const user = useUser();
  const canPublish = useCan('publish');
  const canEditAnything = useCanAny(
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(
    () => getEffectiveDraftSnapshot(website.id),
    [website.id],
  );

  const report = useMemo(
    () =>
      snapshot
        ? runPreflight(snapshot, { websiteId: website.id })
        : null,
    [snapshot, website.id],
  );

  if (!snapshot || !report) {
    return (
      <ReviewShell>
        <EmptyState message="No draft version on this website to review." />
      </ReviewShell>
    );
  }

  const grouped = groupResultsByPage(report.results);
  const siteResults = grouped['__site'] ?? [];

  const handlePublish = () => {
    if (!user) return;
    if (!report.canPublish) return;
    if (
      report.counts.warn > 0 &&
      !window.confirm(
        `There ${report.counts.warn === 1 ? 'is' : 'are'} ${report.counts.warn} warning${
          report.counts.warn === 1 ? '' : 's'
        }. Publish anyway?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = publishDraft(website.id, {
      id: user.id,
      displayName: user.displayName,
    });
    setBusy(false);
    if (result) {
      router.push('/website');
    } else {
      setError('Publish failed — no draft snapshot resolved.');
    }
  };

  const handleSubmitForReview = () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const submission = submitForApproval(website.id, {
      id: user.id,
      displayName: user.displayName,
    });
    setBusy(false);
    if (submission) {
      router.push('/website');
    } else {
      setError('Submit failed — no draft snapshot resolved.');
    }
  };

  return (
    <ReviewShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// PRE-PUBLISH REVIEW'}
          </p>
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Review &amp; <em className="font-extrabold not-italic text-rust">publish</em>{' '}
            {website.name}.
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
            Preflight checks the whole draft before it goes live. Blockers
            must be cleared; warnings can ship and be fixed later.
          </p>
        </div>
        <DomainStatusIndicator domain={website.domain} />
      </div>

      <PreflightChecklist report={report} className="mb-6" />

      {/* Site-wide results (header / footer / nav) */}
      {siteResults.length > 0 ? (
        <div className="mb-6 rounded-lg border border-rule bg-card px-5 py-4">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// WEBSITE-LEVEL (header / footer / nav)'}
          </p>
          <ul className="flex flex-col gap-1.5">
            {siteResults.map((r, i) => (
              <li
                key={`${r.ruleId}-${i}`}
                className="flex items-center gap-2 text-[12.5px] text-ink-mid"
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    r.status === 'fail' ? 'bg-warn' : 'bg-warn'
                  }`}
                />
                <span className="font-semibold text-ink">{r.title}</span>
                <span className="text-ink-quiet">— {r.message}</span>
                {r.fixHref ? (
                  <Link
                    href={r.fixHref}
                    className="ml-auto shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust hover:text-rust-deep"
                  >
                    Fix →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Per-page review cards */}
      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        <strong className="text-ink">{snapshot.pages.length}</strong>{' '}
        {snapshot.pages.length === 1 ? 'page' : 'pages'} in this draft
      </p>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.pages.map((page) => (
          <PageReviewCard
            key={page.id}
            page={page}
            results={grouped[page.id] ?? []}
          />
        ))}
      </div>

      {/* Publish action bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-rule bg-card px-6 py-5">
        <div>
          <p className="text-[14px] font-bold text-ink">
            {report.canPublish
              ? 'Draft is clear to publish.'
              : `${report.counts.fail} blocker${
                  report.counts.fail === 1 ? '' : 's'
                } still open.`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-quiet">
            {canPublish
              ? 'Publishing replaces the live version immediately.'
              : canEditAnything
                ? 'Your changes go to an operator for review before going live.'
                : 'You don’t have permission to publish or submit changes.'}
          </p>
          {error ? (
            <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href="/website">← Back to hub</Link>
          </Button>
          {canPublish ? (
            <Button
              onClick={handlePublish}
              disabled={busy || !report.canPublish}
            >
              {busy ? 'Publishing…' : 'Publish →'}
            </Button>
          ) : canEditAnything ? (
            <Button onClick={handleSubmitForReview} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit for review →'}
            </Button>
          ) : null}
        </div>
      </div>
    </ReviewShell>
  );
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Website']} current="Review" />}
      />
      <div className="px-10 py-9">{children}</div>
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-rule bg-paper-2 px-8 py-12 text-center">
      <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// NOTHING TO REVIEW'}
      </p>
      <p className="text-[15px] text-ink">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" asChild>
          <Link href="/website">← Back to website hub</Link>
        </Button>
      </div>
    </div>
  );
}
