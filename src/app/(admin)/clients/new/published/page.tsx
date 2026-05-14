import Link from 'next/link';

import { NextStepCard } from '@/components/admin/onboarding/NextStepCard';
import { PublishedSuccessHero } from '@/components/admin/onboarding/PublishedSuccessHero';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  voltlineBasics,
  voltlineNextSteps,
} from '@/lib/onboarding/voltline-build';

export default function NewClientPublishedPage() {
  const b = voltlineBasics;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`${b.businessName} · published`}
          />
        }
      />
      <div className="px-10 py-10">
        <PublishedSuccessHero
          title={
            <>
              {b.businessName} is <em>live</em>.
            </>
          }
          description="Landing page deployed to 16 edge regions. Three automations are armed and waiting for the first lead. Mark just got an SMS with his dashboard link."
          url={b.website}
        />

        <div className="rounded-xl border border-rule bg-card px-8 py-7">
          <div className="mb-4 font-sans text-[18px] font-extrabold tracking-[-0.02em] text-ink">
            What happens next
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {voltlineNextSteps.map((step) => (
              <NextStepCard
                key={step.num}
                num={step.num}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </div>

        <BuilderFooterActions
          progress={
            <>
              {b.businessName} · Setup complete in <strong>22 min</strong>
            </>
          }
          actions={
            <>
              <Button variant="secondary" asChild>
                <Link href="/clients">← Back to clients</Link>
              </Button>
              <Button asChild>
                <Link href="/clients">Open {b.businessName} workspace →</Link>
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
