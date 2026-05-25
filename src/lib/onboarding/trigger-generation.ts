// =============================================================================
// onboarding/trigger-generation — the conversational-onboarding generation
// runner.
//
// Mirrors the wizard's inline `triggerGeneration` (app/onboarding/_wizard-
// shell.tsx) in retry shape + persistence path, with one DELIBERATE
// difference: the offer is NOT generated here. The conversational flow
// captures the offer interactively in turn 4 (the customer accepted /
// refined / used-own / skipped), so by the time this runner fires the
// brief already carries `brief.funnel.offer`. Re-generating would discard
// the customer's choice.
//
// The wizard's inline helper stays where it is — refactoring it to use this
// module is a follow-up; CLAUDE.md's "don't refactor unrelated code while
// doing something else" rule + the "Don't break /sign-up/legacy" constraint
// both point at leaving the wizard alone. See "Open decisions / parked"
// in CLAUDE.md for the consolidation entry.
//
// Retry contract — same as the wizard:
//   attempts = [0, 1000, 3000] (three tries, exponential-ish backoff)
//   each attempt: probe → generate (site + funnel as needed) → POST persist
//   on partial success (one arm landed, the other errored): resolve as
//     'ok' with a soft-error in the soft channel — matches wizard semantics.
//
// SERVER-NEVER. Browser-side only — invokes server routes via fetch.
// =============================================================================

import { generateFunnelStub } from '@/lib/funnel/generation-stub';
import { generateSiteStub, type ClientBrief, type SiteGenerationResult } from '@/lib/website/site-generation-stub';
import type { FunnelGenerationResult } from '@/lib/funnel/generation-stub';
import type { WizardAssetsResult } from '@/app/api/clients/[id]/wizard-assets/route';

export type GenerationProgressEvent =
  | { kind: 'probe' }
  | { kind: 'generating-site' }
  | { kind: 'generating-funnel' }
  | { kind: 'persisting' }
  | { kind: 'attempt-failed'; attempt: number; error: string }
  | { kind: 'soft-error'; message: string };

export type RunConversationGenerationArgs = {
  /** UUID of the client whose assets we're generating. */
  clientId: string;
  /** Slug (used as the default subdomain on inserted website/funnel rows). */
  clientSlug: string;
  /** Supabase access token (the route auths via Authorization: Bearer). */
  token: string;
  /** The fully-derived brief. Caller MUST set `brief.funnel.offer` from the
   *  customer's turn-4 acceptance before calling this runner — null is
   *  allowed (the funnel just publishes without a Sonnet-drafted offer
   *  card) but should be a deliberate caller choice, not an oversight. */
  brief: ClientBrief;
  /** Optional progress sink. The conversation shell wires this to update
   *  the in-chat GenerationStatus card. */
  onProgress?: (event: GenerationProgressEvent) => void;
};

export type RunConversationGenerationResult =
  | { ok: true; websiteId: string | null; funnelId: string | null; softError?: string }
  | { ok: false; error: string };

const ATTEMPT_DELAYS_MS = [0, 1000, 3000] as const;

export async function runConversationGeneration(
  args: RunConversationGenerationArgs,
): Promise<RunConversationGenerationResult> {
  const { clientId, clientSlug, token, brief, onProgress } = args;

  // --- 1. Idempotency probe ----------------------------------------------
  // Same shape as the wizard. If the customer has refreshed mid-flow OR
  // generation has already run (e.g. retry after a prior failure left one
  // arm in place), skip the matching arm.
  onProgress?.({ kind: 'probe' });

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
      console.warn('[conversation-gen] wizard-assets probe failed', probeRes.status);
      // Continue — the POST re-probes per arm.
    }
  } catch (e) {
    console.warn('[conversation-gen] wizard-assets probe network error', e);
  }

  if (alreadyHasWebsite && alreadyHasFunnel) {
    return { ok: true, websiteId: null, funnelId: null };
  }

  // --- 2. Retry loop ------------------------------------------------------
  let lastError = 'unknown';
  for (let attemptIdx = 0; attemptIdx < ATTEMPT_DELAYS_MS.length; attemptIdx += 1) {
    if (ATTEMPT_DELAYS_MS[attemptIdx] > 0) {
      await sleep(ATTEMPT_DELAYS_MS[attemptIdx]);
    }
    try {
      // Site + funnel generators run in parallel — neither depends on the
      // other's output. The brief already carries the offer (set by the
      // shell from capturedFacts.offer before this call).
      const sitePromise: Promise<SiteGenerationResult | null> = alreadyHasWebsite
        ? Promise.resolve(null)
        : (onProgress?.({ kind: 'generating-site' }), generateSiteStub(brief, { clientId }));

      const funnelPromise: Promise<FunnelGenerationResult | null> = alreadyHasFunnel
        ? Promise.resolve(null)
        : (onProgress?.({ kind: 'generating-funnel' }), generateFunnelStub(brief, { clientId }));

      const [siteResult, funnelResult] = await Promise.all([sitePromise, funnelPromise]);

      onProgress?.({ kind: 'persisting' });
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

      // Treat the attempt as successful when BOTH arms either created
      // assets, were skipped because assets already existed, or
      // pre-existed via the probe. A hard error on either arm goes back
      // through the retry loop.
      const websiteOk =
        result.websiteCreated || result.websiteSkipped || alreadyHasWebsite;
      const funnelOk =
        result.funnelCreated || result.funnelSkipped || alreadyHasFunnel;

      if (result.errors.website) {
        console.error('[conversation-gen] website persistence error', result.errors.website);
      }
      if (result.errors.funnel) {
        console.error('[conversation-gen] funnel persistence error', result.errors.funnel);
      }

      if (websiteOk && funnelOk) {
        const softError = result.errors.website ?? result.errors.funnel ?? undefined;
        if (softError) onProgress?.({ kind: 'soft-error', message: softError });
        return {
          ok: true,
          websiteId: result.websiteId,
          funnelId: result.funnelId,
          softError,
        };
      }

      lastError =
        result.errors.website ?? result.errors.funnel ?? 'unknown persistence failure';
      throw new Error(lastError);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[conversation-gen] attempt ${attemptIdx + 1} failed`, error);
      onProgress?.({ kind: 'attempt-failed', attempt: attemptIdx + 1, error: msg });
      lastError = msg;
      if (attemptIdx === ATTEMPT_DELAYS_MS.length - 1) {
        return { ok: false, error: msg };
      }
    }
  }

  // Unreachable — the loop returns or throws on every iteration. Here for
  // type completeness.
  return { ok: false, error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
