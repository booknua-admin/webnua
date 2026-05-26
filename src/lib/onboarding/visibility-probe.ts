// =============================================================================
// visibility-probe — confirm a client's website + funnel are visible to the
// customer's RLS-bound query before the post-generation CTA enables.
//
// The conversational signup's `runConversationGeneration` returns `ok: true`
// the moment the `wizard-assets` POST succeeds (server-side, service-role).
// That confirms the rows EXIST in the DB — it does NOT confirm the customer's
// own RLS-bound browser query can see them in the next React Query tick.
//
// Empirically a customer who clicks "View in editor" the instant
// `genPhase='ready'` lights up lands on /website with the operator-targeting
// empty state for 10-30s before React Query's background refetch picks the
// new rows up. That's an unrecoverable first impression for a customer who
// just paid (or is about to).
//
// This helper closes the gap. The blueprint overlay holds at the 'persisting'
// stage and we poll the SAME queries `/website` will run on landing. Only
// when both come back with data do we flip the blueprint to 'ready'.
//
// SERVER-NEVER — uses the browser Supabase client + the customer's JWT.
// =============================================================================

import { fetchFunnelsForClient } from '@/lib/funnel/queries';
import { fetchWebsiteForClient } from '@/lib/website/queries';

export type VisibilityProbeResult =
  | { ok: true; tookMs: number }
  | { ok: false; reason: 'timeout' | 'missing-asset' | 'error'; message: string };

export type VisibilityProbeOptions = {
  /** Whether to wait for a funnel as well. Conversational signup creates
   *  one by default; if a future flow ships site-only, pass false. */
  expectFunnel?: boolean;
  /** Total wait ceiling. The customer sees the blueprint hold here, so a
   *  too-long ceiling is worse than a slightly-early bail-out. 30s matches
   *  the worst observed RLS-refresh window. */
  timeoutMs?: number;
  /** Poll cadence. Short enough to feel responsive without hammering. */
  pollMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_MS = 1_500;

/** Poll the customer-side queries until both site + (optional) funnel are
 *  visible. The fetch functions reuse the same RLS-bound Supabase client
 *  `/website` and `/funnels` mount on landing, so a `null` return here
 *  reliably predicts the same `null` on the editor page. */
export async function pollUntilAssetsVisible(
  clientSlug: string,
  options: VisibilityProbeOptions = {},
): Promise<VisibilityProbeResult> {
  const expectFunnel = options.expectFunnel ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const [website, funnels] = await Promise.all([
        fetchWebsiteForClient(clientSlug),
        expectFunnel ? fetchFunnelsForClient(clientSlug) : Promise.resolve([] as unknown[]),
      ]);
      const websiteOk = website != null;
      const funnelOk = expectFunnel ? funnels.length > 0 : true;
      if (websiteOk && funnelOk) {
        return { ok: true, tookMs: Date.now() - startedAt };
      }
    } catch (error) {
      // Transient errors (network blip, brief RLS-policy refresh) are
      // expected during the probe — log + keep polling. A persistent
      // error eventually hits the timeout below and returns 'error'.
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[visibility-probe] poll error', message);
      if (Date.now() + pollMs >= deadline) {
        return { ok: false, reason: 'error', message };
      }
    }
    if (Date.now() + pollMs >= deadline) break;
    await sleep(pollMs);
  }

  return {
    ok: false,
    reason: 'timeout',
    message: `assets not visible within ${timeoutMs}ms`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
