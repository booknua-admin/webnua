// =============================================================================
// Stripe billing — live plan info.
//
// Phase 7 Stripe billing follow-up. Stripe is the single source of truth for
// the plan's name, price, currency and billing interval — the UI must NEVER
// hardcode these, or the displayed price could drift from what Stripe actually
// charges at checkout.
//
// getPlanInfo() fetches the Price object named by STRIPE_PRICE_ID_STANDARD
// (with its product expanded) through callExternal(), and caches the result
// for 5 minutes — a Price object changes rarely, so a per-request fetch would
// be wasteful. The browser reaches this through GET /api/integrations/stripe/
// plan-info.
//
// The optional "what's included" feature list is read from the Price's
// `features` metadata key (a JSON array of strings set in the Stripe
// dashboard) — so even the feature list is Stripe-sourced, with no code
// change needed to edit it.
//
// SERVER-ONLY — reads STRIPE_SECRET_KEY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

import type { PlanInfo } from './types';

/** A Stripe Price object with its product expanded — the slice this reads. */
type StripePriceExpanded = {
  id: string;
  unit_amount: number | null;
  currency: string;
  nickname: string | null;
  recurring: { interval?: string; interval_count?: number } | null;
  metadata: Record<string, string> | null;
  product:
    | string
    | {
        name?: string;
        description?: string | null;
        metadata?: Record<string, string> | null;
      };
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { value: PlanInfo; expiresAt: number } | null = null;

/** Parse the optional `features` Price-metadata key — a JSON array of strings.
 *  Anything missing or malformed yields an empty list (no feature list). */
function parseFeatures(metadata: Record<string, string> | null | undefined): string[] {
  const raw = metadata?.features;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  } catch {
    return [];
  }
}

/**
 * The current plan details, resolved live from Stripe. Returns null when Stripe
 * is not configured (no secret key / no Price id) or the fetch fails — callers
 * MUST handle null and never substitute a hardcoded price.
 *
 * The result is cached for 5 minutes; a failed fetch is NOT cached, so the next
 * call retries.
 */
export async function getPlanInfo(): Promise<PlanInfo | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const secretKey = env.STRIPE_SECRET_KEY;
  const priceId = env.STRIPE_PRICE_ID_STANDARD;
  if (!secretKey || !priceId) return null;

  const result = await callExternal<StripePriceExpanded>({
    provider: 'stripe',
    operation: 'get_price',
    url: `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`,
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!result.ok) {
    console.warn('[stripe/plan-info] could not fetch the Price object', result.error.message);
    return null;
  }

  const price = result.data;
  const product =
    typeof price.product === 'object' && price.product !== null ? price.product : null;
  const productName = product?.name?.trim() || 'Webnua subscription';

  const info: PlanInfo = {
    priceId: price.id,
    displayName: price.nickname?.trim() || productName,
    amount: price.unit_amount ?? 0,
    currency: price.currency,
    interval: price.recurring?.interval ?? 'month',
    intervalCount: price.recurring?.interval_count ?? 1,
    productName,
    productDescription: product?.description ?? null,
    features: parseFeatures(price.metadata),
  };
  cache = { value: info, expiresAt: Date.now() + CACHE_TTL_MS };
  return info;
}
