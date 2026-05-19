'use client';

// =============================================================================
// SignupFlow — the orchestrator for the cold-traffic signup flow.
//
// A linear step machine held in React state (the flow is short and
// conversion-oriented; URL persistence isn't worth the complexity). Contact
// details never leave component state until they're posted to the edge
// function. The lead is captured at the contact gate; the final CTA marks it
// complete.
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { estimateGuarantee, tradeLabel } from '@/lib/signup/guarantee';
import { splashOneLines, splashTwoLines } from '@/lib/signup/splash-copy';
import { completeSignup, submitLead } from '@/lib/signup/submit';
import { EMPTY_BRIEF } from '@/lib/signup/types';
import type {
  ContactDetails,
  GuaranteeEstimate,
  SignupBrief,
  SignupStep,
} from '@/lib/signup/types';

import { AnalysisSplash } from './AnalysisSplash';
import { BusinessBriefStep } from './BusinessBriefStep';
import { ContactGateStep } from './ContactGateStep';
import { GuaranteeRevealCard } from './GuaranteeRevealCard';
import { OfferStep } from './OfferStep';
import { PreviewReveal } from './PreviewReveal';
import { SignupConfirmation } from './SignupConfirmation';
import { SignupHookStep } from './SignupHookStep';

function SignupFlow() {
  const [step, setStep] = useState<SignupStep>('hook');
  const [brief, setBrief] = useState<SignupBrief>(EMPTY_BRIEF);
  const [contact, setContact] = useState<ContactDetails>({
    name: '',
    email: '',
    phone: '',
  });
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const patchBrief = (patch: Partial<SignupBrief>) =>
    setBrief((b) => ({ ...b, ...patch }));

  // Estimates — the hook step guarantees a non-empty trade past `hook`.
  const baseEstimate: GuaranteeEstimate | null = brief.trade
    ? estimateGuarantee(brief.trade, 'base')
    : null;
  const finalEstimate: GuaranteeEstimate | null = brief.trade
    ? estimateGuarantee(brief.trade, 'optimised')
    : null;

  const handleGateSubmit = async (next: ContactDetails) => {
    setContact(next);
    const result = await submitLead({
      brief,
      contact: next,
      estimate: finalEstimate,
      baseLeads: baseEstimate?.leads ?? null,
    });
    if (result.ok) {
      setSubmissionId(result.id);
      setStep('reveal');
    }
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  const handleExitCapture = async (email: string) => {
    await submitLead({
      brief,
      contact: { email },
      estimate: finalEstimate,
      baseLeads: baseEstimate?.leads ?? null,
    });
  };

  const handleClaim = async () => {
    if (submissionId) void completeSignup(submissionId);
    setStep('done');
  };

  return (
    <div className="w-full py-10">
      {step === 'hook' && (
        <SignupHookStep
          brief={brief}
          onChange={patchBrief}
          onNext={() => setStep('splash1')}
        />
      )}

      {step === 'splash1' && (
        <AnalysisSplash
          eyebrow="// Analysing"
          title="Building your lead system"
          lines={splashOneLines(
            tradeLabel(brief.trade),
            brief.serviceArea || 'your area',
            baseEstimate?.sampleSize ?? 0,
          )}
          onDone={() => setStep('guarantee')}
        />
      )}

      {step === 'guarantee' && baseEstimate && (
        <div className="mx-auto w-full max-w-[560px]">
          <GuaranteeRevealCard
            estimate={baseEstimate}
            variant="tease"
            area={brief.serviceArea || 'your area'}
          />
          <div className="mt-6 rounded-2xl border border-rule bg-card px-7 py-6 text-center">
            <p className="text-[15px] leading-[1.5] text-ink-quiet">
              That&apos;s a real, contracted guarantee. Tell us a little about
              your business and we&apos;ll see if we can push it higher.
            </p>
            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={() => setStep('brief')}
            >
              Sharpen my guarantee →
            </Button>
          </div>
        </div>
      )}

      {step === 'brief' && (
        <BusinessBriefStep
          brief={brief}
          onChange={patchBrief}
          onNext={() => setStep('splash2')}
          onBack={() => setStep('guarantee')}
        />
      )}

      {step === 'splash2' && (
        <AnalysisSplash
          eyebrow="// Finalising"
          title="Putting the finishing touches on your offer"
          lines={splashTwoLines(
            brief.businessName,
            brief.serviceArea || 'your area',
          )}
          onDone={() => setStep('gate')}
        />
      )}

      {step === 'gate' && finalEstimate && (
        <ContactGateStep
          estimate={finalEstimate}
          onSubmit={handleGateSubmit}
          onExitCapture={handleExitCapture}
          onBack={() => setStep('brief')}
        />
      )}

      {step === 'reveal' && finalEstimate && (
        <div className="mx-auto w-full max-w-[640px]">
          <div className="mb-6 text-center">
            <Eyebrow tone="rust">{'// Results'}</Eyebrow>
            <h2 className="mt-3 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
              We can guarantee you even more.
            </h2>
          </div>
          <GuaranteeRevealCard
            estimate={finalEstimate}
            variant="final"
            area={brief.serviceArea || 'your area'}
          />
          <div className="mt-8">
            <PreviewReveal brief={brief} estimate={finalEstimate} />
          </div>
          <Button
            size="lg"
            className="mt-7 w-full"
            onClick={() => setStep('offer')}
          >
            Get my lead system live →
          </Button>
        </div>
      )}

      {step === 'offer' && finalEstimate && (
        <OfferStep estimate={finalEstimate} onClaim={handleClaim} />
      )}

      {step === 'done' && finalEstimate && (
        <SignupConfirmation
          brief={brief}
          contact={contact}
          estimate={finalEstimate}
        />
      )}
    </div>
  );
}

export { SignupFlow };
