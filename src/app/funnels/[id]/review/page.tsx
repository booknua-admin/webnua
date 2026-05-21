'use client';

// =============================================================================
// /funnels/[id]/review — the pre-publish review surface for funnels (A3).
//
// The funnel-shaped sibling of /website/review. Runs the funnel preflight rule
// engine against the effective draft snapshot (draft funnel_version +
// content_drafts overlay, read live via `useFunnelWithDraft`) and renders the
// checklist + per-step cards + the publish action following the §3.3
// capability lane:
//     has `publish`            → Publish → (blocked by hard fails)
//     any edit cap, no publish → Submit for review →   (Lane B → operator queue)
//     view-only                → no action
//
// A funnel publishes as a unit — the whole step sequence goes live together
// (see `lib/funnel/mutations.ts`). The funnel editor's toolbar routes its
// "Review & publish →" link here, so preflight is a mandatory gate (mirror of
// the website editor → /website/review path).
// =============================================================================

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PreflightChecklist } from '@/components/shared/website/PreflightChecklist';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useCan, useCanAny, useUser } from '@/lib/auth/user-stub';
import {
  publishFunnelDraft,
  submitFunnelForApproval,
} from '@/lib/funnel/mutations';
import {
  groupFunnelResultsByStep,
  runFunnelPreflight,
} from '@/lib/funnel/preflight';
import { useFunnelWithDraft } from '@/lib/funnel/queries';
import type { FunnelStep, FunnelVersionSnapshot } from '@/lib/funnel/types';

export default function FunnelReviewPage() {
  const params = useParams<{ id: string }>();
  const funnelId = params?.id ?? '';

  const { data, isLoading, isError } = useFunnelWithDraft(funnelId);

  if (isLoading) {
    return (
      <ReviewShell name={funnelId}>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Running preflight…'}
        </p>
      </ReviewShell>
    );
  }

  if (isError || !data) {
    return (
      <ReviewShell name={funnelId}>
        <EmptyState
          message={`No funnel resolves to "${funnelId}", or it's outside your workspace.`}
        />
      </ReviewShell>
    );
  }

  return (
    <ReviewSurface
      funnelId={data.funnel.id}
      funnelName={data.funnel.name}
      snapshot={data.draft.snapshot}
    />
  );
}

function ReviewSurface({
  funnelId,
  funnelName,
  snapshot,
}: {
  funnelId: string;
  funnelName: string;
  snapshot: FunnelVersionSnapshot;
}) {
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const report = useMemo(
    () => runFunnelPreflight(snapshot, funnelId),
    [snapshot, funnelId],
  );
  const grouped = groupFunnelResultsByStep(report.results);

  const runPublish = async () => {
    if (!user || !report.canPublish) return;
    setBusy(true);
    setError(null);
    const result = await publishFunnelDraft(funnelId, {
      id: user.id,
      displayName: user.displayName,
    });
    setBusy(false);
    if (result) router.push(`/funnels/${funnelId}`);
    else setError('Publish failed — no draft snapshot resolved.');
  };

  const handlePublish = () => {
    if (!user || !report.canPublish) return;
    if (report.counts.warn > 0) {
      setConfirmOpen(true);
      return;
    }
    void runPublish();
  };

  const handleSubmitForReview = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const submission = await submitFunnelForApproval(funnelId, {
      id: user.id,
      displayName: user.displayName,
    });
    setBusy(false);
    if (submission) router.push(`/funnels/${funnelId}`);
    else setError('Submit failed — no draft snapshot resolved.');
  };

  return (
    <ReviewShell name={funnelName}>
      <div className="mb-6">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// PRE-PUBLISH REVIEW'}
        </p>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
          Review &amp; <em className="font-extrabold not-italic text-rust">publish</em>{' '}
          {funnelName}.
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
          Preflight checks the whole funnel before it goes live. The funnel
          publishes as a unit — every step ships together. Blockers must be
          cleared; warnings can ship and be fixed later.
        </p>
      </div>

      <PreflightChecklist report={report} className="mb-6" />

      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        <strong className="text-ink">{snapshot.steps.length}</strong>{' '}
        {snapshot.steps.length === 1 ? 'step' : 'steps'} in this funnel
      </p>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.steps.map((step, i) => (
          <StepReviewCard
            key={step.id}
            step={step}
            position={i + 1}
            results={grouped[step.id] ?? []}
            fixHref={`/funnels/${funnelId}/edit/${step.id}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-rule bg-card px-6 py-5">
        <div>
          <p className="text-[14px] font-bold text-ink">
            {report.canPublish
              ? 'Funnel is clear to publish.'
              : `${report.counts.fail} blocker${
                  report.counts.fail === 1 ? '' : 's'
                } still open.`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-quiet">
            {canPublish
              ? report.canPublish
                ? 'Publishing replaces the live funnel immediately.'
                : 'Clear the blockers before this funnel can publish.'
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
            <Link href={`/funnels/${funnelId}`}>← Back to funnel</Link>
          </Button>
          {canPublish ? (
            <Button onClick={handlePublish} disabled={busy || !report.canPublish}>
              {busy ? 'Publishing…' : 'Publish →'}
            </Button>
          ) : canEditAnything ? (
            <Button onClick={handleSubmitForReview} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit for review →'}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish with warnings?"
        description={
          <>
            There {report.counts.warn === 1 ? 'is' : 'are'}{' '}
            <strong>{report.counts.warn}</strong>{' '}
            {report.counts.warn === 1 ? 'warning' : 'warnings'} on this funnel.
            Warnings don’t block publishing — you can ship now and fix them
            later.
          </>
        }
        confirmLabel="Publish anyway"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmOpen(false);
          void runPublish();
        }}
      />
    </ReviewShell>
  );
}

function StepReviewCard({
  step,
  position,
  results,
  fixHref,
}: {
  step: FunnelStep;
  position: number;
  results: ReturnType<typeof groupFunnelResultsByStep>[string];
  fixHref: string;
}) {
  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  const enabled = step.sections.filter((s) => s.enabled).length;
  const tone =
    fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass';
  const TONE_CLASS: Record<typeof tone, string> = {
    fail: 'bg-warn/20 text-warn',
    warn: 'bg-amber/15 text-amber',
    pass: 'bg-good/15 text-good',
  };
  return (
    <Link
      href={fixHref}
      className="block rounded-lg border border-rule bg-card px-4 py-3.5 transition-colors hover:border-rust"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          Step {position} · {step.type}
        </span>
        <span
          className={`rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${TONE_CLASS[tone]}`}
        >
          {fails > 0
            ? `${fails} blocker${fails === 1 ? '' : 's'}`
            : warns > 0
              ? `${warns} warning${warns === 1 ? '' : 's'}`
              : 'Clear'}
        </span>
      </div>
      <p className="mt-1 text-[15px] font-bold text-ink">
        {step.title || step.slug}
      </p>
      <p className="mt-0.5 text-[12.5px] text-ink-quiet">
        {enabled} {enabled === 1 ? 'section' : 'sections'}
      </p>
    </Link>
  );
}

function ReviewShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Funnels', name]} current="Review" />}
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
          <Link href="/funnels">← Back to funnels</Link>
        </Button>
      </div>
    </div>
  );
}
