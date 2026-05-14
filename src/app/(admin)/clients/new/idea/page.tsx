'use client';

import Link from 'next/link';
import { useState } from 'react';

import { FunnelLandingPreview } from '@/components/admin/onboarding/FunnelLandingPreview';
import { ReframeOptionCard } from '@/components/admin/onboarding/ReframeOptionCard';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { BuilderLayout } from '@/components/shared/builder/BuilderLayout';
import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  ONBOARDING_TOTAL_STEPS,
  stepHref,
} from '@/lib/onboarding/types';
import {
  previewAfterIdea,
  voltlineBasics,
  voltlineReframes,
  voltlineSelectedReframeId,
} from '@/lib/onboarding/voltline-build';

export default function NewClientIdeaPage() {
  const [selectedId, setSelectedId] = useState(voltlineSelectedReframeId);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step 2 of ${ONBOARDING_TOTAL_STEPS} · Big idea`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${voltlineBasics.businessName} · Step 2 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              The big <em>idea</em>.
            </>
          }
          subtitle={
            <>
              Claude drafted three reframes for a residential sparky.{' '}
              <strong>Pick one or write your own.</strong> The one you pick
              becomes the hero line on the funnel and the share-quote on the IG
              carousel.
            </>
          }
        />
        <BuilderLayout
          form={
            <>
              <div className="flex flex-col gap-3">
                {voltlineReframes.map((option) => (
                  <ReframeOptionCard
                    key={option.id}
                    tag={option.tag}
                    text={option.text}
                    reason={option.reason}
                    selected={selectedId === option.id}
                    onSelect={() => setSelectedId(option.id)}
                  />
                ))}
                <div className="mt-2.5 border-t border-paper-2 pt-3.5">
                  <Button variant="secondary" className="w-full justify-center">
                    ✦ Regenerate · try 3 more
                  </Button>
                </div>
              </div>
              <BuilderFooterActions
                progress={
                  <>
                    Step <strong>2</strong> of {ONBOARDING_TOTAL_STEPS}
                  </>
                }
                actions={
                  <>
                    <Button variant="ghost" asChild>
                      <Link href={stepHref('basics')}>← Back</Link>
                    </Button>
                    <Button asChild>
                      <Link href={stepHref('offer')}>
                        Continue · build the funnel →
                      </Link>
                    </Button>
                  </>
                }
              />
            </>
          }
          preview={<FunnelLandingPreview state={previewAfterIdea} />}
        />
      </div>
    </>
  );
}
