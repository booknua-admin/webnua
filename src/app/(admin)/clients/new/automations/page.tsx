import Link from 'next/link';

import { AutomationCard } from '@/components/shared/automations/AutomationCard';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  ONBOARDING_TOTAL_STEPS,
  stepHref,
} from '@/lib/onboarding/types';
import {
  voltlineAutomations,
  voltlineBasics,
} from '@/lib/onboarding/voltline-build';

export default function NewClientAutomationsPage() {
  const activeCount = voltlineAutomations.filter((a) => a.enabled).length;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step 6 of ${ONBOARDING_TOTAL_STEPS} · Automations`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${voltlineBasics.businessName} · Step 6 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              Pre-built <em>automations</em>.
            </>
          }
          subtitle={
            <>
              Four templated flows.{' '}
              <strong>Toggle on what you want, edit the copy</strong>, leave
              the rest off. All copy is drafted by Claude for an electrical
              business in Perth — review and tweak before publishing.
            </>
          }
        />
        <div className="flex flex-col gap-3.5">
          {voltlineAutomations.map((automation) => (
            <AutomationCard key={automation.id} automation={automation} />
          ))}
        </div>
        <BuilderFooterActions
          progress={
            <>
              Step <strong>6</strong> of {ONBOARDING_TOTAL_STEPS} ·{' '}
              <strong>
                {activeCount} of {voltlineAutomations.length}
              </strong>{' '}
              automations active
            </>
          }
          actions={
            <>
              <Button variant="ghost" asChild>
                <Link href={stepHref('draft')}>← Back</Link>
              </Button>
              <Button asChild>
                <Link href={stepHref('review')}>Continue to publish →</Link>
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
