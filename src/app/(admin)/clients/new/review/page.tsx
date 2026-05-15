import Link from 'next/link';

import { PublishCTACard } from '@/components/admin/onboarding/PublishCTACard';
import { ReviewCard } from '@/components/admin/onboarding/ReviewCard';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  ONBOARDING_TOTAL_STEPS,
  stepHref,
} from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';
import {
  voltlineAutomations,
  voltlineBasics,
  voltlineJobs,
  voltlineOffer,
  voltlineReframes,
  voltlineSelectedReframeId,
  voltlineTrust,
} from '@/lib/onboarding/voltline-build';

export default function NewClientReviewPage() {
  const b = voltlineBasics;
  const o = voltlineOffer;
  const picked =
    voltlineReframes.find((r) => r.id === voltlineSelectedReframeId) ??
    voltlineReframes[0];
  const flatJobs = voltlineJobs.filter((j) => j.type === 'flat').length;
  const quoteJobs = voltlineJobs.filter((j) => j.type === 'quote').length;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={`Step 7 of ${ONBOARDING_TOTAL_STEPS} · Review + publish`}
          />
        }
      />
      <div className="px-10 py-10">
        <BuilderStepHeader
          eyebrow={`// ${b.businessName} · Step 7 of ${ONBOARDING_TOTAL_STEPS}`}
          title={
            <>
              Review + <em>publish</em>.
            </>
          }
          subtitle={
            <>
              One last look before this goes live.{' '}
              <strong>Everything is editable post-publish</strong> — you can
              roll back to any version in one click from the page settings.
            </>
          }
        />

        <div className="mb-8 grid grid-cols-2 gap-4.5">
          <ReviewCard
            heading="Business basics"
            editHref={stepHref('basics')}
            details={[
              { label: '// TRADE', value: b.trade },
              {
                label: '// OWNER',
                value: `${b.ownerName} · ${b.ownerPhone}`,
              },
              { label: '// SERVICE AREA', value: b.serviceArea },
            ]}
          />
          <ReviewCard
            heading="Big idea"
            editHref={stepHref('draft')}
            details={[
              { label: '// HERO LINE', value: picked.text },
              {
                label: '// SUB',
                value: (
                  <span className="font-medium text-ink-soft">
                    {o.subHeadline}
                  </span>
                ),
              },
            ]}
          />
          <ReviewCard
            heading="Offer + guarantee"
            editHref={stepHref('draft')}
            details={[
              {
                label: '// ANCHOR',
                value: (
                  <>
                    <em>90 minutes</em> — or $50 off the call-out
                  </>
                ),
              },
              {
                label: '// RATES',
                value: `${o.normalRate.replace(' call-out', '')} normal · ${o.afterHoursRate.replace(' call-out', '')} after-hours`,
              },
              { label: '// LICENCE', value: b.licence },
            ]}
          />
          <ReviewCard
            heading="Trust + jobs menu"
            editHref={stepHref('draft')}
            details={[
              {
                label: '// TRUST SIGNALS',
                value: `${voltlineTrust[0].value} jobs · ${voltlineTrust[1].value} · ${voltlineTrust[2].value} · ${voltlineTrust[3].value} reviews`,
              },
              {
                label: '// JOBS MENU',
                value: `${voltlineJobs.length} jobs · ${flatJobs} flat-rate · ${quoteJobs} quote-only`,
              },
            ]}
          />
          <ReviewCard
            heading="Automations"
            editHref={stepHref('automations')}
            className="col-span-2"
            details={[]}
          >
            <div className="grid grid-cols-2 gap-3.5">
              {voltlineAutomations.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3.5 py-3',
                    a.enabled ? 'bg-good-soft' : 'bg-paper-2',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      a.enabled ? 'bg-good' : 'bg-ink-quiet',
                    )}
                  />
                  <div>
                    <div
                      className={cn(
                        'font-sans text-[13px] font-bold',
                        a.enabled ? 'text-ink' : 'text-ink-quiet',
                      )}
                    >
                      {a.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-quiet">
                      {a.steps.length} STEP{a.steps.length > 1 ? 'S' : ''} ·{' '}
                      {a.enabled ? 'ACTIVE' : 'OFF'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReviewCard>
        </div>

        <PublishCTACard
          title={
            <>
              Ship {b.businessName} <em>live</em>.
            </>
          }
          description={
            <>
              Publishes the landing page to <strong>{b.website}</strong>,
              activates the{' '}
              {voltlineAutomations.filter((a) => a.enabled).length} enabled
              automations, and sends {b.ownerName.split(' ')[0]} a magic-link
              to his dashboard. <strong>Takes ~3 seconds.</strong>
            </>
          }
          ctaLabel={`Publish to ${b.website} →`}
          ctaHref={stepHref('published')}
        />

        <BuilderFooterActions
          progress={
            <>
              Step <strong>7</strong> of {ONBOARDING_TOTAL_STEPS} · all ready
            </>
          }
          actions={
            <>
              <Button variant="ghost" asChild>
                <Link href={stepHref('automations')}>← Back</Link>
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
