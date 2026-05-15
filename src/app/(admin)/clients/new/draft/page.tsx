'use client';

// =============================================================================
// /clients/new/draft — wizard Step 5, the draft walk-through (design doc §5).
//
// Reached when the trust step (Step 4) triggers generation. On mount it runs
// `generateFunnelStub` and shows the generation card for the synthetic delay,
// then mounts WizardSectionEditor to walk the generated funnel's sections one
// at a time.
//
// Stub layer: generation is a deterministic passthrough to the Voltline
// funnel (see lib/funnel/generation-stub.ts). With real backend it's whatever
// the Q&A answers generated.
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { GenerationStatusCard } from '@/components/shared/website/GenerationStatusCard';
import { WizardSectionEditor } from '@/components/shared/website/WizardSectionEditor';
import { Button } from '@/components/ui/button';
import {
  generateFunnelStub,
  type FunnelGenerationResult,
} from '@/lib/funnel/generation-stub';
import {
  ONBOARDING_TOTAL_STEPS,
  getStepNumber,
  stepHref,
} from '@/lib/onboarding/types';
import { voltlineBasics } from '@/lib/onboarding/voltline-build';

export default function NewClientDraftPage() {
  const router = useRouter();
  const [result, setResult] = useState<FunnelGenerationResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generateFunnelStub()
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stepNo = getStepNumber('draft');

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step ${stepNo} of ${ONBOARDING_TOTAL_STEPS} · Polish your draft`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${voltlineBasics.businessName} · Step ${stepNo} of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              Polish your <em>draft</em>.
            </>
          }
          subtitle={
            <>
              We&apos;ve drafted every section from your answers.{' '}
              <strong>Walk through each one</strong> — tweak the copy, swap an
              image, or leave it as drafted. Nothing here is final.
            </>
          }
        />

        {failed ? (
          <div className="rounded-xl border border-rule bg-card px-8 py-7">
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
              {'// DRAFT UNAVAILABLE'}
            </p>
            <p className="mb-5 text-[15px] text-ink">
              The generated funnel could not be resolved.
            </p>
            <Button variant="secondary" asChild>
              <Link href={stepHref('trust')}>← Back to trust</Link>
            </Button>
          </div>
        ) : result ? (
          <WizardSectionEditor
            funnel={result.funnel}
            steps={result.steps}
            onExitForward={() => router.push(stepHref('automations'))}
            onExitBack={() => router.push(stepHref('trust'))}
          />
        ) : (
          <GenerationStatusCard />
        )}
      </div>
    </>
  );
}
