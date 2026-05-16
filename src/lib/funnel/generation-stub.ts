// =============================================================================
// generateFunnelStub — the onboarding wizard's funnel-generation handler.
//
// STUB (Session 7B). A deterministic passthrough: it returns the
// registry-backed Voltline funnel from `data-stub.tsx` after a synthetic
// 4–8s delay, regardless of the GenerationContext passed.
//
// Why a passthrough rather than a real composition: Session 6's
// `generatePageStub` is website-page-shaped — its recipes cannot emit the
// funnel-only `schedulePicker` / `thanksConfirmation` sections. Real funnel
// generation (composing per-step generations — design doc §5.5) is a backend
// pass; it will take a `GenerationContext` assembled from the wizard's Q&A
// steps. The stub is parameter-less — it has nothing to read.
// =============================================================================

import { findFunnel, getDraftForFunnel } from './data-stub';
import type { Funnel, FunnelStep } from './types';

export type FunnelGenerationResult = {
  funnel: Funnel;
  steps: FunnelStep[];
};

// Stub layer: onboarding always builds the Voltline funnel.
const STUB_FUNNEL_ID = 'emergency-call-out';

function syntheticDelayMs(): number {
  // 4–8s, per builder-generation-design §6.
  return Math.random() * 4000 + 4000;
}

export async function generateFunnelStub(): Promise<FunnelGenerationResult> {
  await new Promise((resolve) => setTimeout(resolve, syntheticDelayMs()));

  const funnel = findFunnel(STUB_FUNNEL_ID);
  const draft = funnel ? getDraftForFunnel(STUB_FUNNEL_ID) : null;
  if (!funnel || !draft) {
    throw new Error(
      `generateFunnelStub: no funnel resolves to "${STUB_FUNNEL_ID}".`,
    );
  }
  return { funnel, steps: draft.snapshot.steps };
}
