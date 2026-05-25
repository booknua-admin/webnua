'use client';

// =============================================================================
// Step 7: the wizard finale.
//
// Three render phases keyed off generationStatus (owned by _wizard-shell):
//
//   * 'idle' | 'running' → BuildingSequence
//     A staged loading surface. Stages cycle on timers (reassurance, not
//     real progress); the parent's genState flipping to 'ready' / 'failed'
//     swaps the phase instantly. No CTAs visible — the customer is meant
//     to wait. Most customers spend 30-60s on steps 5-6, so by the time
//     they land here generation is often already done and the BuildReady
//     branch renders without a loading flash.
//
//   * 'ready' → BuildReady
//     Single primary CTA ("Preview your site") + secondary
//     ("Continue to dashboard"). The summary card renders here so the
//     customer sees what was built. Publish / request-review CTAs live on
//     the dashboard only — the dashboard's IntegrationOnboarding +
//     PublishToGoLiveCTA owns that flow.
//
//   * 'failed' → BuildFailed
//     Error message + retry + skip. The customer can re-fire generation
//     OR continue to dashboard; the dashboard's onboarding surface will
//     re-attempt / surface an operator-actionable state.
//
// Why not StepFrame: the loading phase needs full control of footer chrome
// (no CTAs allowed); the ready phase has two primary actions, not one.
// Steps 1-6 are input pages and benefit from the shared frame; step 7 is
// a results surface and renders its own layout.
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WizardState } from '@/lib/onboarding/types';

type GenerationStatus = 'idle' | 'running' | 'ready' | 'failed';

type Step7Props = {
  state: WizardState;
  clientSlug: string;
  generationStatus: GenerationStatus;
  /** Diagnostic from the last generation attempt — surfaced inline on
   *  the failed surface so the customer / support sees what happened. */
  generationError: string | null;
  onRetryGeneration: () => void;
  onComplete: () => void;
  onBack: () => void;
};

export function Step7Done({
  state,
  clientSlug,
  generationStatus,
  generationError,
  onRetryGeneration,
  onComplete,
  onBack,
}: Step7Props) {
  // 'use client' file — must read NEXT_PUBLIC_* directly so Next inlines
  // at build time. The server-only `lib/env` module would throw on the
  // missing server-only keys (undefined in the browser bundle).
  const previewHost = (
    process.env.NEXT_PUBLIC_PUBLIC_SITE_DOMAIN ?? 'webnua.dev'
  ).toLowerCase();
  const previewUrl = `https://${clientSlug}.${previewHost}`;

  if (generationStatus === 'failed') {
    return (
      <BuildFailed
        errorMessage={generationError}
        onRetry={onRetryGeneration}
        onSkip={onComplete}
        onBack={onBack}
      />
    );
  }

  if (generationStatus === 'ready') {
    return (
      <BuildReady
        state={state}
        previewUrl={previewUrl}
        onComplete={onComplete}
      />
    );
  }

  return <BuildingSequence />;
}

// ---------- phase 1: building ----------------------------------------------

type Stage = { id: string; label: string; durationMs: number };

// Stages are reassurance copy, not real progress events. Total scripted
// duration ~33s; the final stage parks indefinitely until the parent's
// genState flips to 'ready' / 'failed' and this whole component unmounts.
// Tuned to feel honest: customer hits step 7 after ~30s on steps 5-6, so
// generation is often nearly done; the loading flash is brief.
const BUILD_STAGES: Stage[] = [
  { id: 'workspace', label: 'Setting up your workspace', durationMs: 3000 },
  { id: 'homepage', label: 'Building your homepage', durationMs: 7000 },
  { id: 'copy', label: 'Writing your services and about copy', durationMs: 8000 },
  { id: 'funnel', label: 'Setting up your lead funnel', durationMs: 8000 },
  { id: 'automations', label: 'Connecting your automations', durationMs: 5000 },
  { id: 'final', label: 'Finalizing', durationMs: 120000 },
];

function BuildingSequence() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= BUILD_STAGES.length - 1) return;
    const t = window.setTimeout(
      () => setActive((i) => i + 1),
      BUILD_STAGES[active].durationMs,
    );
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-7 py-6">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-rule border-t-rust"
          aria-hidden
        />
        <span className="text-[20px] text-rust" aria-hidden>
          ✦
        </span>
      </div>

      <div className="text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
          {'// Building your platform'}
        </p>
        <h1 className="mt-2 text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] text-ink md:text-[26px]">
          Putting it all together
        </h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-[1.5] text-ink-soft">
          Usually 30–60 seconds. Don&rsquo;t close this tab — we&rsquo;ll show
          your site the moment it&rsquo;s ready.
        </p>
      </div>

      <ol
        className="flex w-full max-w-md flex-col gap-1.5"
        aria-label="Generation progress"
      >
        {BUILD_STAGES.map((s, i) => {
          const status: 'done' | 'active' | 'pending' =
            i < active ? 'done' : i === active ? 'active' : 'pending';
          return (
            <li
              key={s.id}
              aria-current={status === 'active' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3.5 py-2.5 transition-colors duration-300',
                status === 'active' && 'bg-rust-soft',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-colors duration-300',
                  status === 'done' && 'border-good bg-good text-paper',
                  status === 'active' && 'animate-pulse border-rust bg-rust text-paper',
                  status === 'pending' && 'border-rule text-transparent',
                )}
                aria-hidden
              >
                {status === 'done' ? '✓' : status === 'active' ? '◆' : '·'}
              </span>
              <span
                className={cn(
                  'text-[13px] transition-colors duration-300',
                  status === 'done' && 'text-ink-mid line-through decoration-ink-quiet/40',
                  status === 'active' && 'font-semibold text-ink',
                  status === 'pending' && 'text-ink-quiet',
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------- phase 2: ready -------------------------------------------------

function BuildReady({
  state,
  previewUrl,
  onComplete,
}: {
  state: WizardState;
  previewUrl: string;
  onComplete: () => void;
}) {
  const integrationsConnected = countConnected(state);
  const services = state.step_data.step1?.services ?? [];
  const industryDisplay =
    state.step_data.step1?.industryFreeText
    ?? state.step_data.step1?.industryKey
    ?? 'your trade';
  const hasTestimonials = (state.step_data.step5?.testimonials.length ?? 0) > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-good text-paper text-[16px]"
        >
          ✓
        </span>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-good">
          {'// Your site is ready'}
        </p>
      </div>

      <h1 className="mt-3 text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink md:text-[32px]">
        Your <em className="not-italic text-rust">platform</em> is ready.
      </h1>
      <p className="mt-3 text-[14px] leading-[1.55] text-ink-soft md:text-[15px]">
        We&rsquo;ve built your site, set up your funnel, and wired in your
        automation defaults. Take a look around — when you&rsquo;re ready
        to go live, hit Publish on your dashboard.
      </p>

      {/* Primary action surface — the single thing we want the customer
          to do next is open their preview. Secondary is the dashboard. */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="min-w-[220px]">
          <a href={previewUrl} target="_blank" rel="noreferrer">
            ↗ Preview your site
          </a>
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={onComplete}
          className="min-w-[200px]"
        >
          Continue to dashboard →
        </Button>
      </div>

      {/* Summary of what was set up — supports the primary CTA, doesn't
          compete with it. */}
      <div className="mt-7 rounded-xl border border-rule bg-card px-5 py-5">
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
            <strong className="text-ink">Site status:</strong> Draft ready — public when you Publish
          </li>
        </ul>
      </div>

      <p className="mt-5 text-[12px] leading-[1.5] text-ink-quiet">
        Publish + operator-review options live on your dashboard, alongside
        your inbox and the rest of your tools.
      </p>
    </div>
  );
}

// ---------- phase 3: failed ------------------------------------------------

function BuildFailed({
  errorMessage,
  onRetry,
  onSkip,
  onBack,
}: {
  errorMessage: string | null;
  onRetry: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-warn/[0.12] text-warn text-[16px] font-bold"
        >
          !
        </span>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-warn">
          {'// Generation hit a snag'}
        </p>
      </div>

      <h1 className="mt-3 text-[24px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink md:text-[28px]">
        Let&rsquo;s try that again.
      </h1>
      <p className="mt-3 text-[14px] leading-[1.55] text-ink-soft md:text-[15px]">
        We hit a problem building your site. You can retry now, or skip to
        your dashboard — your site will keep trying in the background, and
        an operator will pick it up if it still isn&rsquo;t ready.
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-md border border-warn/30 bg-warn/[0.06] px-3 py-2 font-mono text-[11px] leading-[1.4] text-warn">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={onRetry} size="lg" className="min-w-[200px]">
          ↻ Try again
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="min-w-[220px]"
        >
          Skip and view dashboard
        </Button>
      </div>

      <div className="mt-7 border-t border-rule pt-5">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-rust"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// ---------- helpers --------------------------------------------------------

function countConnected(state: WizardState): number {
  const s = state.step_data.step6;
  if (!s) return 0;
  let n = 0;
  if (s.metaAds === 'connected') n++;
  if (s.gbp === 'connected') n++;
  return n;
}
