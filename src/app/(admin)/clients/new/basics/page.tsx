import Link from 'next/link';

import { FunnelLandingPreview } from '@/components/admin/onboarding/FunnelLandingPreview';
import { AIPill } from '@/components/shared/builder/AIPill';
import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
  BuilderInput,
} from '@/components/shared/builder/BuilderField';
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
  previewAfterBasics,
  voltlineBasics,
} from '@/lib/onboarding/voltline-build';

export default function NewClientBasicsPage() {
  const b = voltlineBasics;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients']}
            current={`New · ${b.businessName} · Step 1 of ${ONBOARDING_TOTAL_STEPS}`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${b.businessName} · Step 1 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              Business <em>basics</em>.
            </>
          }
          subtitle={
            <>
              The minimum we need to start drafting the funnel.{' '}
              <strong>Five fields</strong> — then AI fills the rest.
              You&apos;ll edit anything that&apos;s not right.
            </>
          }
        />
        <BuilderLayout
          form={
            <>
              <BuilderFormSection>
                <BuilderField label="Trade">
                  <BuilderInput defaultValue={b.trade} readOnly />
                </BuilderField>
                <BuilderField label="Business name">
                  <BuilderInput defaultValue={b.businessName} readOnly />
                </BuilderField>
                <BuilderFormRow>
                  <BuilderField label="Owner name">
                    <BuilderInput defaultValue={b.ownerName} readOnly />
                  </BuilderField>
                  <BuilderField label="Phone">
                    <BuilderInput defaultValue={b.ownerPhone} readOnly />
                  </BuilderField>
                </BuilderFormRow>
                <BuilderField label="Service area">
                  <BuilderInput defaultValue={b.serviceArea} readOnly />
                </BuilderField>
                <BuilderField
                  label="Website (optional"
                  hint={<>· for AI to scrape)</>}
                  helper={b.websiteHelper}
                >
                  <BuilderInput defaultValue={b.website} readOnly />
                </BuilderField>
              </BuilderFormSection>
              <BuilderFormSection>
                <BuilderField
                  label={
                    <>
                      Promise / response time <AIPill>Will AI-draft</AIPill>
                    </>
                  }
                >
                  <BuilderInput defaultValue={b.responsePromise} variant="ai" />
                </BuilderField>
                <BuilderField
                  label={
                    <>
                      Licence + insurance details <AIPill>Will AI-fill</AIPill>
                    </>
                  }
                >
                  <BuilderInput defaultValue={b.licence} variant="ai" />
                </BuilderField>
              </BuilderFormSection>
              <BuilderFooterActions
                progress={
                  <>
                    Step <strong>1</strong> of {ONBOARDING_TOTAL_STEPS}
                  </>
                }
                actions={
                  <>
                    <Button variant="ghost" asChild>
                      <Link href="/dashboard">← Back</Link>
                    </Button>
                    <Button asChild>
                      <Link href={stepHref('idea')}>Continue →</Link>
                    </Button>
                  </>
                }
              />
            </>
          }
          preview={
            <FunnelLandingPreview
              state={previewAfterBasics}
              skeleton={{
                title: 'Waiting on the big idea',
                description:
                  "Once you pick a reframe in the next step, the preview will start rendering with Voltline's actual content.",
              }}
            />
          }
        />
      </div>
    </>
  );
}
