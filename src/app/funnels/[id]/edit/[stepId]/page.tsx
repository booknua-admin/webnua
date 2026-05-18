'use client';

// =============================================================================
// /funnels/[id]/edit/[stepId] — funnel-step editor (Session 7 · wired Phase 4).
//
// Mounts SectionEditor in `funnelStep` mode. The funnel + its draft version
// resolve live from Supabase (`lib/funnel/queries`); the [stepId] segment
// picks the step out of the draft snapshot. Toolbar surfaces one tab per step.
// Publish/Submit hide for funnel mode — funnel publish + approval mechanics
// are still unbuilt (CLAUDE.md parked decision); the editor autosaves to a
// localStorage draft slot.
// =============================================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useFunnelWithDraft } from '@/lib/funnel/queries';

export default function FunnelStepEditorPage() {
  const params = useParams<{ id: string; stepId: string }>();
  const funnelId = params?.id ?? '';
  const stepId = params?.stepId ?? '';

  const { data, isLoading, isError } = useFunnelWithDraft(funnelId);

  if (isLoading) {
    return <StatusState message="// Resolving funnel…" tone="quiet" />;
  }

  if (isError || !data) {
    return (
      <NotFoundState
        message={`No funnel resolves to "${funnelId}", or it's outside your workspace.`}
        backHref="/funnels"
      />
    );
  }

  const { funnel, draft } = data;
  const step = draft.snapshot.steps.find((s) => s.id === stepId);
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

function StatusState({
  message,
  tone,
}: {
  message: string;
  tone: 'quiet' | 'warn';
}) {
  return (
    <div className="flex h-svh items-center justify-center bg-paper px-6">
      <p
        className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
          tone === 'warn' ? 'text-warn' : 'text-ink-quiet'
        }`}
      >
        {message}
      </p>
    </div>
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
