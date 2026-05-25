'use client';

// =============================================================================
// _wizard-shell — Pattern B onboarding wizard orchestrator.
//
// Owns the wizard state (loaded from / persisted to clients.wizard_state
// via the /api/clients/[id]/wizard-state route) and dispatches per-step
// content. Each step is its own component under _steps/ and consumes a
// per-step props bundle so the orchestrator owns navigation + the shared
// chrome (step indicator, "Skip for now", Back, Continue).
//
// Side effects worth flagging:
//
//   * Background site generation fires the moment step 4 is committed and
//     the customer has not yet generated a site (`generationStartedRef`).
//     The promise runs in the background so steps 5–6 are not gated on
//     the call; failures retry once with backoff. By step 7 the site is
//     either ready (the common case) or a "taking longer than expected"
//     message displays.
//
//   * Persistence is fire-and-forget. Every step transition writes the
//     new state to the server before the orchestrator advances; a failure
//     surfaces inline (not blocking) so a slow network doesn't strand the
//     customer. Resume always re-reads the server state, which is the SoT.
//
//   * Skip is universal except step 1 (industry required). A skipped step's
//     slot stays `null`; the brief derivation falls back to industry
//     template defaults.
//
//   * The "I'm done" landing — step 7 — calls /api/clients/[id]/wizard-state
//     with { complete: true } AND the latest state. That stamps
//     `wizard_completed_at` so the dashboard guard stops redirecting here.
// =============================================================================

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { generateFunnelStub } from '@/lib/funnel/generation-stub';
import { generateSiteStub } from '@/lib/website/site-generation-stub';
import { generateFunnelOffer, type FunnelOffer } from '@/lib/website/offer-generate';
import { deriveBriefFromWizard } from '@/lib/onboarding/derive-brief';
import {
  INITIAL_WIZARD_STATE,
  type Step1Data,
  type Step2Data,
  type Step3Data,
  type Step4Data,
  type Step5Data,
  type Step6Data,
  type WizardState,
  type WizardStepId,
} from '@/lib/onboarding/types';
import { supabase } from '@/lib/supabase/client';
import type { WizardAssetsResult } from '@/app/api/clients/[id]/wizard-assets/route';

import { Step1Industry } from './_steps/Step1Industry';
import { Step2Business } from './_steps/Step2Business';
import { Step3Target } from './_steps/Step3Target';
import { Step4Brand } from './_steps/Step4Brand';
import { Step5Testimonials } from './_steps/Step5Testimonials';
import { Step6Integrations } from './_steps/Step6Integrations';
import { Step7Done } from './_steps/Step7Done';

const TOTAL_STEPS = 7 as const;

export type WizardShellProps = {
  /** UUID of the client. */
  clientId: string;
  /** Slug — passed through to step 6 + step 7 for IntegrationConnections
   *  + preview links. */
  clientSlug: string;
  /** Display name from clients.name + the signup-time defaults the wizard
   *  falls back to when individual steps are skipped. */
  fallbackBusinessName: string;
  fallbackEmail: string;
  fallbackIndustry: string;
  /** The hydrated wizard state (or null for a fresh start). */
  initialState: WizardState | null;
};

export function WizardShell({
  clientId,
  clientSlug,
  fallbackBusinessName,
  fallbackEmail,
  fallbackIndustry,
  initialState,
}: WizardShellProps) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState ?? INITIAL_WIZARD_STATE);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [genState, setGenState] = useState<'idle' | 'running' | 'ready' | 'failed'>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  // Non-blocking warning for the funnel-offer generator. Failure here does
  // NOT fail the wizard (site + funnel still publish, just without an
  // AI-drafted offer); the customer can run it from the editor later.
  // Surfaced on step 7's BuildReady surface as an inline note.
  const [offerWarning, setOfferWarning] = useState<string | null>(null);
  const generationStartedRef = useRef(false);
  // Stamp `wizard_completed_at` the moment step 7 is reached — NOT just on
  // the "See my dashboard" CTA. Most customers close the tab on step 7
  // (the success surface) so the CTA-only stamp never fires. The ref
  // prevents duplicate writes if step 7 re-renders (state updates / retry
  // effects fire) before navigation.
  const completionStampedRef = useRef(false);

  const persist = useCallback(
    async (next: WizardState, opts?: { complete?: boolean }) => {
      // Synchronous-feeling UX: state is set locally first, the write
      // races in the background. Persistence failures surface inline; the
      // customer can still advance, and a reload re-reads the server.
      setState(next);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(`/api/clients/${clientId}/wizard-state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ state: next, ...(opts?.complete ? { complete: true } : {}) }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setPersistError(`Could not save (${body.error ?? res.status}). Your progress is in this browser tab; reload to retry.`);
        } else {
          setPersistError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setPersistError(`Could not save: ${message}. Your progress is in this browser tab; reload to retry.`);
      }
    },
    [clientId],
  );

  // Background site + funnel generation. Fires when step 4 first commits.
  // The brief is derived from whatever the wizard has so far; skipped
  // steps fall back to template + signup defaults.
  //
  // Persistence note: BOTH the website and funnel insert paths route through
  // /api/clients/[id]/wizard-assets (service-client write) rather than the
  // browser supabase client. This is because:
  //
  //   (1) `funnels_insert` RLS requires `private.is_operator()` (migration
  //       0014) — a customer-role wizard cannot INSERT funnels via the
  //       browser path. Every Pattern B wizard run prior to this routing
  //       persisted 0 funnels because of this silent denial.
  //   (2) The route runs an idempotency probe FIRST: if a website OR funnel
  //       already exists for the client, the matching arm is skipped. This
  //       is the fix for `website_count = 2` rows showing up when a customer
  //       refreshed mid-flow.
  //   (3) Errors from the route surface here as `setGenError(msg)` rather
  //       than `console.warn` + silent advance — the customer sees an
  //       actionable banner on step 7 and can retry.
  const triggerGeneration = useCallback(
    async (latestState: WizardState) => {
      if (generationStartedRef.current) return;
      generationStartedRef.current = true;
      setGenState('running');
      setGenError(null);
      setOfferWarning(null);

      // Build the initial brief WITHOUT the offer — the offer generator
      // takes raw funnel inputs (industry / serviceArea / service / pain /
      // guarantee), all of which come from the wizard state, not from the
      // offer struct itself. We re-derive the brief with the resolved
      // offer below before kicking off funnel generation, so the funnel
      // generator (which threads offer.headline / promise / risk_reversal /
      // cta_text through every section) and the funnels.funnel_offer
      // persistence both see it.
      const briefWithoutOffer = deriveBriefFromWizard({
        state: latestState,
        fallbackBusinessName,
        fallbackEmail,
        fallbackIndustry,
      });

      // Resolve auth token + idempotency state up front. If either fails
      // we park 'failed' immediately — no point running the generators.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        const msg = 'Not signed in — cannot generate.';
        console.error('[wizard] generation aborted — no auth token');
        setGenError(msg);
        setGenState('failed');
        // Allow a future retry — clear the ref so retryGeneration() can fire
        // again once the session is back.
        generationStartedRef.current = false;
        return;
      }

      // Idempotency probe — has generation already produced assets for
      // this client? Skip the expensive generators if so. This is the
      // resume-mid-wizard path (close tab on step 5, come back, /onboarding
      // re-mounts WizardShell and runs the initial-state effect below).
      let alreadyHasWebsite = false;
      let alreadyHasFunnel = false;
      try {
        const probeRes = await fetch(`/api/clients/${clientId}/wizard-assets`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (probeRes.ok) {
          const probe = (await probeRes.json()) as {
            hasWebsite: boolean;
            hasFunnel: boolean;
          };
          alreadyHasWebsite = probe.hasWebsite;
          alreadyHasFunnel = probe.hasFunnel;
        } else {
          console.error('[wizard] wizard-assets probe failed', probeRes.status);
          // Continue — probe failure shouldn't block; the route's POST
          // path will re-probe before each insert anyway.
        }
      } catch (e) {
        console.error('[wizard] wizard-assets probe network error', e);
      }

      if (alreadyHasWebsite && alreadyHasFunnel) {
        // Nothing left to do — mark ready immediately.
        setGenState('ready');
        return;
      }

      // Two retries with exponential-backoff (1s, 3s). After two fails we
      // park 'failed' — step 7 surfaces the "taking longer than expected"
      // message; the customer can retry from step 7 if it never lands.
      const attempts = [0, 1000, 3000];
      let lastError: string | null = null;
      for (let i = 0; i < attempts.length; i += 1) {
        if (attempts[i] > 0) {
          await sleep(attempts[i]);
        }
        try {
          // Phase 2 parity fix — fire the Sonnet-backed funnel-offer
          // generator alongside site generation (in parallel). Adds
          // ~5s + ~$0.01/customer; brings the wizard into parity with
          // the concierge path (which always generates an offer at
          // step 7-equivalent in CreateClientModal).
          //
          // The funnel generator (generate-funnel-live.ts:611-620) reads
          // brief.funnel.offer to thread headline / promise / risk_reversal
          // / cta_text through every funnel section, so we MUST wait for
          // the offer before kicking off funnel generation. We don't wait
          // for the offer to start the site (the website generator
          // doesn't read it) — that stays in parallel.
          //
          // Offer-failure policy: NON-BLOCKING. If the offer call fails
          // (key unset → 503, real failure → 500, network), we surface
          // a warning on step 7 ("Offer generation failed — you can run
          // it from the editor") and continue with `offer: null`. The
          // funnel still generates (generic copy instead of offer-driven)
          // and persists. This matches "fall back to offer: null and
          // continue" from the Phase 2 brief.
          const offerInputs = {
            industry: briefWithoutOffer.industry,
            serviceArea: briefWithoutOffer.business.serviceArea,
            funnelService: briefWithoutOffer.funnel.service,
            funnelCustomerPain: briefWithoutOffer.funnel.customerPain,
            funnelGuarantee: briefWithoutOffer.funnel.guarantee,
          };
          const offerPromise: Promise<FunnelOffer | null> = alreadyHasFunnel
            ? Promise.resolve(null) // funnel already exists; no offer needed
            : generateFunnelOffer(offerInputs).catch((error) => {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[wizard] offer generation failed (non-blocking)', msg);
                setOfferWarning(
                  `We couldn't draft your AI offer (${msg}). Your site + funnel published with placeholder copy — you can generate the offer from the funnel editor any time.`,
                );
                return null;
              });

          // Fire site + offer in parallel. Site doesn't depend on the
          // offer; funnel does.
          const [siteResult, offerResult] = await Promise.all([
            alreadyHasWebsite ? Promise.resolve(null) : generateSiteStub(briefWithoutOffer, { clientId }),
            offerPromise,
          ]);

          // Re-derive the brief with the resolved offer (or null on
          // failure / when the funnel already exists). The new brief
          // feeds BOTH the funnel generator (so it threads offer copy
          // through every section) AND the wizard-assets POST (so the
          // offer lands on funnels.funnel_offer via offerToRow).
          const brief = offerResult
            ? deriveBriefFromWizard({
                state: latestState,
                fallbackBusinessName,
                fallbackEmail,
                fallbackIndustry,
                offerOverride: offerResult,
              })
            : briefWithoutOffer;

          const funnelResult = alreadyHasFunnel
            ? null
            : await generateFunnelStub(brief, { clientId });

          // POST to wizard-assets to persist whichever arms produced content.
          // The route re-probes for idempotency before each insert — a
          // concurrent run (e.g. step 4 commit + step 7 retry) can't double-
          // create.
          const persistRes = await fetch(`/api/clients/${clientId}/wizard-assets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              brief,
              clientSlug,
              site: siteResult,
              funnel: funnelResult,
            }),
          });
          if (!persistRes.ok) {
            const errBody = (await persistRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(
              `wizard-assets POST ${persistRes.status}: ${errBody.error ?? 'unknown'}`,
            );
          }
          const result = (await persistRes.json()) as WizardAssetsResult;

          // Partial failure — one arm persisted, the other errored. We
          // surface the error but treat the run as 'ready' if at least one
          // asset is in place (so step 7 doesn't lock on a recoverable
          // funnel-only failure). The error string carries the diagnostic.
          const websiteOk =
            result.websiteCreated || result.websiteSkipped || alreadyHasWebsite;
          const funnelOk =
            result.funnelCreated || result.funnelSkipped || alreadyHasFunnel;

          if (result.errors.website) {
            console.error('[wizard] website persistence error', result.errors.website);
          }
          if (result.errors.funnel) {
            console.error('[wizard] funnel persistence error', result.errors.funnel);
          }

          if (websiteOk && funnelOk) {
            // At least one of each landed (or already existed). 'ready'.
            // If a soft error came back on either arm we still set 'ready'
            // because the asset exists somewhere down the chain — but we
            // surface the message inline so the operator sees it.
            const softMsg =
              result.errors.website ?? result.errors.funnel ?? null;
            if (softMsg) setGenError(softMsg);
            setGenState('ready');
            return;
          }

          // Hard failure on at least one required arm — retry.
          lastError =
            result.errors.website ?? result.errors.funnel ?? 'unknown persistence failure';
          throw new Error(lastError);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[wizard] generation attempt ${i + 1} failed`, error);
          lastError = msg;
          if (i === attempts.length - 1) {
            setGenError(msg);
            setGenState('failed');
            // Allow retry from step 7 — clear the ref so the next call
            // through retryGeneration restarts the loop.
            generationStartedRef.current = false;
            return;
          }
        }
      }
    },
    [clientId, clientSlug, fallbackBusinessName, fallbackEmail, fallbackIndustry],
  );

  // Re-trigger from step 7 if generation failed. The button on Step7Done
  // calls this through the shell. Resets both ref + error state so the
  // retry surface shows clean.
  const retryGeneration = useCallback(async () => {
    generationStartedRef.current = false;
    setGenError(null);
    setOfferWarning(null);
    await triggerGeneration(state);
  }, [state, triggerGeneration]);

  // Initial-state effect: if the customer's state already has step 4
  // filled (resumed mid-wizard), kick off generation so it has time to
  // settle by the time they reach step 7.
  useEffect(() => {
    if (state.step_data.step4 !== null && !generationStartedRef.current) {
      void triggerGeneration(state);
    }
    // Run-once on mount per (clientId, ...). Subsequent step 4 commits go
    // through the per-step commit handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 7 auto-complete effect: stamp `wizard_completed_at` the moment
  // the customer reaches step 7. The dashboard's /onboarding redirect
  // gate reads this column; if it's never stamped, every subsequent visit
  // re-redirects back here. The "See my dashboard" CTA also stamps it
  // (belt-and-braces), but most customers close the tab on the success
  // surface — this effect makes sure the gate releases regardless of
  // whether they click through. Idempotent via completionStampedRef +
  // the route's `complete: true` flag (which sets the column to now() —
  // a second call just updates the timestamp).
  useEffect(() => {
    if (state.current_step !== 7) return;
    if (completionStampedRef.current) return;
    completionStampedRef.current = true;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          console.error('[wizard] cannot stamp completion — no auth token');
          completionStampedRef.current = false;
          return;
        }
        const res = await fetch(`/api/clients/${clientId}/wizard-state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          // Send the current state too so a step 7 mount also persists any
          // unsaved step 6 transitions. `complete: true` stamps the column.
          body: JSON.stringify({ state, complete: true }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          console.error(
            `[wizard] completion stamp failed (${res.status}): ${body.error ?? 'unknown'}`,
          );
          completionStampedRef.current = false;
        }
      } catch (error) {
        console.error('[wizard] completion stamp threw', error);
        completionStampedRef.current = false;
      }
    })();
    // Intentionally only fire on current_step transitions to step 7. State
    // body and clientId are stable for the lifetime of the wizard mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current_step]);

  // --- per-step commit handlers --------------------------------------------

  function commit<K extends keyof WizardState['step_data']>(
    key: K,
    value: WizardState['step_data'][K],
  ): WizardState {
    const next: WizardState = {
      ...state,
      completed_steps: stepCompletedUnion(state.completed_steps, stepNumberFor(key)),
      step_data: { ...state.step_data, [key]: value },
    };
    return next;
  }

  function goTo(step: WizardStepId, next?: WizardState) {
    const target: WizardState = { ...(next ?? state), current_step: step };
    void persist(target);
  }

  // Returns the per-step handlers each component consumes.
  const continueFromStep = useMemo(
    () => ({
      onStep1Continue: (data: Step1Data) => {
        const next = commit('step1', data);
        goTo(2, next);
      },
      onStep1Skip: undefined, // step 1 is required
      onStep2Continue: (data: Step2Data) => {
        const next = commit('step2', data);
        goTo(3, next);
      },
      onStep2Skip: () => {
        const next = commit('step2', null);
        goTo(3, next);
      },
      onStep3Continue: (data: Step3Data) => {
        const next = commit('step3', data);
        goTo(4, next);
      },
      onStep3Skip: () => {
        const next = commit('step3', null);
        goTo(4, next);
      },
      onStep4Continue: (data: Step4Data) => {
        const next = commit('step4', data);
        // Site generation kicks off here. Fire-and-forget; UI advances.
        void triggerGeneration(next);
        goTo(5, next);
      },
      onStep4Skip: () => {
        const next = commit('step4', null);
        void triggerGeneration(next);
        goTo(5, next);
      },
      onStep5Continue: (data: Step5Data) => {
        const next = commit('step5', data);
        goTo(6, next);
      },
      onStep5Skip: () => {
        const next = commit('step5', null);
        goTo(6, next);
      },
      onStep6Continue: (data: Step6Data) => {
        const next = commit('step6', data);
        goTo(7, next);
      },
      onStep6Skip: () => {
        const next = commit('step6', null);
        goTo(7, next);
      },
      onStep7Complete: () => {
        // Stamp wizard_completed_at and route to /dashboard. The dashboard
        // guard sees the non-null timestamp and renders the regular
        // IntegrationOnboarding (publish CTA + integrations).
        const next: WizardState = {
          ...state,
          completed_steps: stepCompletedUnion(state.completed_steps, 7),
        };
        void persist(next, { complete: true }).then(() => {
          router.push('/dashboard');
        });
      },
    }),
    // `commit` and `goTo` are inner closures that read `state` directly +
    // call the same `persist` we depend on; including them would re-fire
    // the memo every render and defeat the point. Stable through the
    // listed deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, triggerGeneration, router, persist],
  );
  void continueFromStep; // satisfy linter — useMemo's value is used inline below

  const goBack = () => {
    if (state.current_step > 1) {
      goTo((state.current_step - 1) as WizardStepId);
    }
  };

  // --- render ----------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col">
      <ProgressIndicator current={state.current_step} total={TOTAL_STEPS} />
      <div className="mt-6 flex-1">
        {state.current_step === 1 ? (
          <Step1Industry
            initial={state.step_data.step1}
            fallbackIndustry={fallbackIndustry}
            onContinue={continueFromStep.onStep1Continue}
          />
        ) : null}
        {state.current_step === 2 ? (
          <Step2Business
            initial={state.step_data.step2}
            fallbackBusinessName={fallbackBusinessName}
            fallbackEmail={fallbackEmail}
            onContinue={continueFromStep.onStep2Continue}
            onSkip={continueFromStep.onStep2Skip}
            onBack={goBack}
          />
        ) : null}
        {state.current_step === 3 ? (
          <Step3Target
            initial={state.step_data.step3}
            onContinue={continueFromStep.onStep3Continue}
            onSkip={continueFromStep.onStep3Skip}
            onBack={goBack}
          />
        ) : null}
        {state.current_step === 4 ? (
          <Step4Brand
            initial={state.step_data.step4}
            industryKey={state.step_data.step1?.industryKey ?? 'generic'}
            clientId={clientId}
            onContinue={continueFromStep.onStep4Continue}
            onSkip={continueFromStep.onStep4Skip}
            onBack={goBack}
          />
        ) : null}
        {state.current_step === 5 ? (
          <Step5Testimonials
            initial={state.step_data.step5}
            onContinue={continueFromStep.onStep5Continue}
            onSkip={continueFromStep.onStep5Skip}
            onBack={goBack}
          />
        ) : null}
        {state.current_step === 6 ? (
          <Step6Integrations
            initial={state.step_data.step6}
            clientSlug={clientSlug}
            clientName={fallbackBusinessName}
            onContinue={continueFromStep.onStep6Continue}
            onSkip={continueFromStep.onStep6Skip}
            onBack={goBack}
          />
        ) : null}
        {state.current_step === 7 ? (
          <Step7Done
            state={state}
            clientSlug={clientSlug}
            generationStatus={genState}
            generationError={genError}
            generationWarning={offerWarning}
            onRetryGeneration={retryGeneration}
            onComplete={continueFromStep.onStep7Complete}
            onBack={goBack}
          />
        ) : null}
      </div>
      {persistError ? (
        <p className="mt-4 rounded-lg border border-warn bg-warn/[0.06] px-4 py-2 text-[12.5px] leading-[1.5] text-warn">
          {persistError}
        </p>
      ) : null}
    </div>
  );
}

// ---------- internals -------------------------------------------------------

function ProgressIndicator({
  current,
  total,
}: {
  current: WizardStepId;
  total: number;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {`// Step ${current} of ${total}`}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => {
          const isDone = step < current;
          const isCurrent = step === current;
          return (
            <div
              key={step}
              aria-hidden
              className={
                'h-1.5 flex-1 rounded-full ' +
                (isDone || isCurrent ? 'bg-rust' : 'bg-rule')
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function stepCompletedUnion(existing: WizardStepId[], step: WizardStepId): WizardStepId[] {
  if (existing.includes(step)) return existing;
  return [...existing, step].sort((a, b) => a - b) as WizardStepId[];
}

function stepNumberFor(key: keyof WizardState['step_data']): WizardStepId {
  switch (key) {
    case 'step1':
      return 1;
    case 'step2':
      return 2;
    case 'step3':
      return 3;
    case 'step4':
      return 4;
    case 'step5':
      return 5;
    case 'step6':
      return 6;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Re-export `Button` so step files importing from shell can use it without
 *  knowing the source. Keeps the per-step file's import list small. */
export { Button };
