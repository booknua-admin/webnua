'use client';

// =============================================================================
// /funnels/[id]/edit/[stepId] — funnel-step editor (Session 7).
//
// Mounts SectionEditor in `funnelStep` mode. Sections come from the funnel's
// draft version; toolbar surfaces one tab per step (prefixed `01 ·`, `02 ·`,
// `03 ·`) so the sequence is visible at a glance. Publish/Submit hide for
// funnel mode in Session 7 — funnel publish + approval mechanics land in a
// later session; the shell is here so the funnel data model + editor wiring
// are exercised end-to-end.
// =============================================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import {
  findFunnel,
  findStep,
  getDraftForFunnel,
} from '@/lib/funnel/data-stub';

export default function FunnelStepEditorPage() {
  const params = useParams<{ id: string; stepId: string }>();
  const funnelId = params?.id ?? '';
  const stepId = params?.stepId ?? '';

  const funnel = findFunnel(funnelId);
  if (!funnel) {
    return (
      <NotFoundState
        message={`No funnel resolves to "${funnelId}".`}
        backHref="/funnels"
      />
    );
  }

  const draft = getDraftForFunnel(funnelId);
  if (!draft) {
    return (
      <NotFoundState
        message={`Funnel "${funnel.name}" has no draft version.`}
        backHref={`/funnels/${funnelId}`}
      />
    );
  }

  const step = findStep(funnelId, stepId);
  if (!step) {
    return (
      <NotFoundState
        message={`No step "${stepId}" on this funnel.`}
        backHref={`/funnels/${funnelId}`}
      />
    );
  }

  return (
    <SectionEditor
      mode={{
        kind: 'funnelStep',
        funnel,
        steps: draft.snapshot.steps,
        step,
      }}
    />
  );
}

function NotFoundState({
  message,
  backHref,
}: {
  message: string;
  backHref: string;
}) {
  return (
    <div className="flex h-svh items-center justify-center bg-paper px-6">
      <div className="max-w-[480px] text-center">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// FUNNEL STEP NOT FOUND'}
        </p>
        <p className="mb-5 text-[16px] text-ink">{message}</p>
        <Button asChild variant="secondary">
          <Link href={backHref}>← Back</Link>
        </Button>
      </div>
    </div>
  );
}
