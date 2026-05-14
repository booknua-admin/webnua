import Link from 'next/link';

import { FunnelLandingPreview } from '@/components/admin/onboarding/FunnelLandingPreview';
import { AIPill } from '@/components/shared/builder/AIPill';
import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
  BuilderInput,
  BuilderTextarea,
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
  previewAfterOffer,
  voltlineBasics,
  voltlineOffer,
} from '@/lib/onboarding/voltline-build';

export default function NewClientOfferPage() {
  const o = voltlineOffer;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step 3 of ${ONBOARDING_TOTAL_STEPS} · Offer`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${voltlineBasics.businessName} · Step 3 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              The <em>offer</em>.
            </>
          }
          subtitle={
            <>
              Sparkies don&apos;t sell at a discount — they sell the response
              promise. <strong>Lock in the 90-minute window</strong> with skin
              in the game.
            </>
          }
        />
        <BuilderLayout
          form={
            <>
              <BuilderFormSection>
                <BuilderField
                  label={
                    <>
                      Anchor offer line <AIPill>AI-drafted</AIPill>
                    </>
                  }
                >
                  <BuilderInput defaultValue={o.anchor} variant="ai" />
                </BuilderField>
                <BuilderField
                  label={
                    <>
                      Sub-headline · who you&apos;re for{' '}
                      <AIPill>AI-drafted</AIPill>
                    </>
                  }
                >
                  <BuilderInput defaultValue={o.subHeadline} variant="ai" />
                </BuilderField>
                <BuilderFormRow>
                  <BuilderField label="After-hours rate">
                    <BuilderInput defaultValue={o.afterHoursRate} readOnly />
                  </BuilderField>
                  <BuilderField label="Normal rate">
                    <BuilderInput defaultValue={o.normalRate} readOnly />
                  </BuilderField>
                </BuilderFormRow>
              </BuilderFormSection>
              <BuilderFormSection>
                <BuilderField label="Primary CTA text">
                  <BuilderInput defaultValue={o.primaryCta} readOnly />
                </BuilderField>
                <BuilderField label="Secondary CTA">
                  <BuilderInput defaultValue={o.secondaryCta} readOnly />
                </BuilderField>
              </BuilderFormSection>
              <BuilderFormSection>
                <BuilderField
                  label={
                    <>
                      Guarantee terms <AIPill>AI-drafted</AIPill>
                    </>
                  }
                >
                  <BuilderTextarea
                    rows={4}
                    defaultValue={o.guarantee}
                    variant="ai"
                    className="min-h-[84px]"
                  />
                </BuilderField>
              </BuilderFormSection>
              <BuilderFooterActions
                progress={
                  <>
                    Step <strong>3</strong> of {ONBOARDING_TOTAL_STEPS}
                  </>
                }
                actions={
                  <>
                    <Button variant="ghost" asChild>
                      <Link href={stepHref('idea')}>← Back</Link>
                    </Button>
                    <Button asChild>
                      <Link href={stepHref('trust')}>Continue →</Link>
                    </Button>
                  </>
                }
              />
            </>
          }
          preview={<FunnelLandingPreview state={previewAfterOffer} />}
        />
      </div>
    </>
  );
}
