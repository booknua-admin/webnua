import Link from 'next/link';

import { JobsMenuEditor } from '@/components/admin/onboarding/JobsMenuEditor';
import { AIPill } from '@/components/shared/builder/AIPill';
import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
  BuilderInput,
} from '@/components/shared/builder/BuilderField';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { ONBOARDING_TOTAL_STEPS, stepHref } from '@/lib/onboarding/types';
import {
  voltlineBasics,
  voltlineJobs,
  voltlineTrust,
} from '@/lib/onboarding/voltline-build';

export default function NewClientTrustPage() {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step 4 of ${ONBOARDING_TOTAL_STEPS} · Trust + jobs`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${voltlineBasics.businessName} · Step 4 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              Trust + <em>jobs menu</em>.
            </>
          }
          subtitle={
            <>
              The fixed-price jobs grid is the tactic —{' '}
              <strong>10 common jobs with prices on the page</strong> kills the
              &quot;I have to come look first&quot; stalemate. Quote-only for
              the bigger work.
            </>
          }
        />
        <div className="max-w-[760px] rounded-xl border border-rule bg-card p-7">
          <BuilderFormSection>
            <BuilderField label="Trust signals (4 stat cards)">
              <BuilderFormRow>
                <BuilderField label={voltlineTrust[0].label}>
                  <BuilderInput defaultValue={voltlineTrust[0].value} readOnly />
                </BuilderField>
                <BuilderField label={voltlineTrust[1].label}>
                  <BuilderInput defaultValue={voltlineTrust[1].value} readOnly />
                </BuilderField>
              </BuilderFormRow>
              <BuilderFormRow>
                <BuilderField label={voltlineTrust[2].label}>
                  <BuilderInput defaultValue={voltlineTrust[2].value} readOnly />
                </BuilderField>
                <BuilderField label={voltlineTrust[3].label}>
                  <BuilderInput defaultValue={voltlineTrust[3].value} readOnly />
                </BuilderField>
              </BuilderFormRow>
            </BuilderField>
          </BuilderFormSection>
          <BuilderFormSection>
            <BuilderField
              label={
                <>
                  Common jobs menu <AIPill>AI-suggested · edit prices</AIPill>
                </>
              }
            >
              <JobsMenuEditor jobs={voltlineJobs} />
            </BuilderField>
          </BuilderFormSection>
          <BuilderFooterActions
            progress={
              <>
                Step <strong>4</strong> of {ONBOARDING_TOTAL_STEPS}
              </>
            }
            actions={
              <>
                <Button variant="ghost" asChild>
                  <Link href={stepHref('offer')}>← Back</Link>
                </Button>
                <Button asChild>
                  <Link href={stepHref('draft')}>Generate the funnel →</Link>
                </Button>
              </>
            }
          />
        </div>
      </div>
    </>
  );
}
