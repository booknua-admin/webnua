'use client';

// =============================================================================
// Step 7: Done. The conversion landing.
//
// Shows:
//   - Success message
//   - Generation status (ready / running / failed-with-retry)
//   - Summary of what was set up (industry, services, integrations)
//   - Three CTAs:
//       * "See your full site" — opens {slug}.webnua.dev (preview)
//       * "See your dashboard" — primary, marks wizard complete + routes
//       * "Publish to go live" — links to /dashboard where the Publish
//         CTA + Stripe Checkout lives
//       * Secondary: "Or request operator review first" — same path as
//         existing Pattern B (PublishToGoLiveCTA shows this option, we
//         link to it)
//
// "See your dashboard" calls onComplete which stamps wizard_completed_at
// and routes — the other CTAs all also implicitly mark complete (the
// route handler stamps it; the dashboard guard sees the flag and stops
// redirecting back).
// =============================================================================

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { WizardState } from '@/lib/onboarding/types';
import { env } from '@/lib/env';

import { StepFrame } from './_step-frame';

type Step7Props = {
  state: WizardState;
  clientSlug: string;
  generationStatus: 'idle' | 'running' | 'ready' | 'failed';
  onRetryGeneration: () => void;
  onComplete: () => void;
  onBack: () => void;
};

export function Step7Done({
  state,
  clientSlug,
  generationStatus,
  onRetryGeneration,
  onComplete,
  onBack,
}: Step7Props) {
  const previewHost = (env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev').toLowerCase();
  const previewUrl = `https://${clientSlug}.${previewHost}`;

  const integrationsConnected = countConnected(state);
  const services = state.step_data.step1?.services ?? [];
  const industryDisplay = state.step_data.step1?.industryFreeText
    ?? state.step_data.step1?.industryKey
    ?? 'your trade';
  const hasTestimonials = (state.step_data.step5?.testimonials.length ?? 0) > 0;

  return (
    <StepFrame
      title={
        <>
          Your <em>platform</em> is ready.
        </>
      }
      description={
        <>
          We&rsquo;ve built your site, set up your funnel, and wired in your
          automation defaults. <strong>Hit Publish when you&rsquo;re ready
          to go live</strong> — or take a look around first.
        </>
      }
      continueLabel="See my dashboard →"
      onContinue={onComplete}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        {/* Generation status */}
        <GenerationStatusCard
          status={generationStatus}
          previewUrl={previewUrl}
          onRetry={onRetryGeneration}
        />

        {/* Summary card — what's set up */}
        <div className="rounded-xl border border-rule bg-card px-5 py-5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// What we set up'}
          </div>
          <ul className="mt-3 flex flex-col gap-2 text-[13.5px] leading-[1.5] text-ink-soft">
            <li>
              <strong className="text-ink">Industry:</strong> {industryDisplay}
              {services.length > 0
                ? ` — ${services.slice(0, 3).join(', ')}${services.length > 3 ? `, +${services.length - 3} more` : ''}`
                : ''}
            </li>
            <li>
              <strong className="text-ink">Integrations connected:</strong>{' '}
              {integrationsConnected} of 2 (Meta Ads + Google Business Profile)
            </li>
            <li>
              <strong className="text-ink">Social proof:</strong>{' '}
              {hasTestimonials
                ? `${state.step_data.step5?.testimonials.length} testimonials added`
                : 'Placeholder (ready for Google reviews)'}
            </li>
            <li>
              <strong className="text-ink">Default automations:</strong>{' '}
              9 (review requests, lead acknowledgments, no-show recovery, etc.)
            </li>
            <li>
              <strong className="text-ink">Site status:</strong>{' '}
              {generationStatus === 'ready' ? 'Draft ready' : 'Building…'} —
              public when you Publish
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              ↗ See your site
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[220px]">
            <Link href="/dashboard">Publish to go live →</Link>
          </Button>
        </div>
      </div>
    </StepFrame>
  );
}

function GenerationStatusCard({
  status,
  previewUrl,
  onRetry,
}: {
  status: 'idle' | 'running' | 'ready' | 'failed';
  previewUrl: string;
  onRetry: () => void;
}) {
  switch (status) {
    case 'ready':
      return (
        <div className="rounded-xl border-2 border-good bg-good/[0.06] px-5 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-good">
            {'// Site ready'}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink">
            Your site is built and previewable at{' '}
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono font-semibold text-rust hover:underline"
            >
              {previewUrl.replace(/^https?:\/\//, '')}
            </a>
            .
          </p>
        </div>
      );
    case 'running':
    case 'idle':
      return (
        <div className="rounded-xl border border-rust border-dashed bg-rust-soft px-5 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// Generating…'}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
            Webnua is writing your site copy + assembling your funnel — usually
            takes 30–60 seconds. You can move on; it&rsquo;ll be ready when
            you reach your dashboard.
          </p>
        </div>
      );
    case 'failed':
      return (
        <div className="rounded-xl border-2 border-warn bg-warn/[0.06] px-5 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            {'// Taking longer than expected'}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
            Generation hit a snag. You can retry now, or continue to your
            dashboard — your site will keep trying to build in the background,
            and an operator will pick it up if it still isn&rsquo;t ready in a
            few minutes.
          </p>
          <div className="mt-3">
            <Button onClick={onRetry} variant="outline" size="sm">
              ↻ Retry generation
            </Button>
          </div>
        </div>
      );
  }
}

function countConnected(state: WizardState): number {
  const s = state.step_data.step6;
  if (!s) return 0;
  let n = 0;
  if (s.metaAds === 'connected') n++;
  if (s.gbp === 'connected') n++;
  return n;
}
