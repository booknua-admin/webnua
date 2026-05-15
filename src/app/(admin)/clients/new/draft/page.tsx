'use client';

// =============================================================================
// /clients/new/draft — wizard Step 5, the draft walk-through (design doc §5).
//
// Reached after the Q&A steps trigger generation. On mount it shows the
// generation card for the synthetic delay, then mounts WizardSectionEditor
// to walk the generated funnel's sections one at a time.
//
// Session 7A: the generation handoff is a timed reveal — the real
// `generateFunnelStub` wiring (and arrival from the trust step) lands in 7B.
// The funnel is the stub Voltline funnel; with real backend it's whatever
// the just-run generation produced.
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { GenerationStatusCard } from '@/components/shared/website/GenerationStatusCard';
import { WizardSectionEditor } from '@/components/shared/website/WizardSectionEditor';
import { Button } from '@/components/ui/button';
import { findFunnel, getDraftForFunnel } from '@/lib/funnel/data-stub';
import {
  ONBOARDING_TOTAL_STEPS,
  getStepNumber,
  stepHref,
} from '@/lib/onboarding/types';
import { voltlineBasics } from '@/lib/onboarding/voltline-build';

// Stub layer: onboarding always builds the Voltline funnel.
const WIZARD_FUNNEL_ID = 'emergency-call-out';
const GENERATION_MS = 3200;

export default function NewClientDraftPage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setGenerating(false), GENERATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const funnel = findFunnel(WIZARD_FUNNEL_ID);
  const draft = funnel ? getDraftForFunnel(WIZARD_FUNNEL_ID) : null;
  const steps = draft?.snapshot.steps ?? [];

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

        {generating ? (
          <GenerationStatusCard />
        ) : funnel && steps.length > 0 ? (
          <WizardSectionEditor
            funnel={funnel}
            steps={steps}
            onExitForward={() => router.push(stepHref('automations'))}
            onExitBack={() => router.push(stepHref('trust'))}
          />
        ) : (
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
        )}
      </div>
    </>
  );
}
