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
import { createWebsiteForClient } from '@/lib/clients/create-client';
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
  const generationStartedRef = useRef(false);

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
  const triggerGeneration = useCallback(
    async (latestState: WizardState) => {
      if (generationStartedRef.current) return;
      generationStartedRef.current = true;
      setGenState('running');

      const brief = deriveBriefFromWizard({
        state: latestState,
        fallbackBusinessName,
        fallbackEmail,
        fallbackIndustry,
      });

      // Two retries with exponential-backoff (1s, 3s). After two fails we
      // park 'failed' — step 7 surfaces the "taking longer than expected"
      // message; the customer can retry from step 7 if it never lands.
      // Resolve the auth user id once — `createWebsiteForClient` stamps it
      // on website_versions.created_by + the funnel insert needs the same.
      const { data: userData } = await supabase.auth.getUser();
      const createdByUserId = userData.user?.id;
      if (!createdByUserId) {
        setGenState('failed');
        return;
      }

      const attempts = [0, 1000, 3000];
      for (let i = 0; i < attempts.length; i += 1) {
        if (attempts[i] > 0) {
          await sleep(attempts[i]);
        }
        try {
          // Website FIRST — the create flow inserts (website, draft version,
          // brand seed if needed) atomically per call site. The wizard's
          // own brand-step writes are independent — that's the brand
          // editor's surface, not the generator's.
          await createWebsiteForClient({
            clientId,
            clientSlug,
            brief,
            createdByUserId,
          });
          // Funnel — best-effort. A wizard-only customer may never wire
          // a funnel offer (the four-field generator is operator-concierge);
          // if generation fails, the website success isn't shadowed.
          void generateFunnelStub(brief, { clientId }).catch((e) => {
            console.warn('[wizard] funnel generation failed (best-effort)', e);
          });

          setGenState('ready');
          return;
        } catch (error) {
          console.warn(`[wizard] generation attempt ${i + 1} failed`, error);
          if (i === attempts.length - 1) {
            setGenState('failed');
            return;
          }
        }
      }
    },
    [clientId, clientSlug, fallbackBusinessName, fallbackEmail, fallbackIndustry],
  );

  // Re-trigger from step 7 if generation failed. The button on Step7Done
  // calls this through the shell.
  const retryGeneration = useCallback(async () => {
    generationStartedRef.current = false;
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
