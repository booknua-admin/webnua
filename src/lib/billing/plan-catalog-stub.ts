// =============================================================================
// plan-catalog store — in-memory cache hydrated from Supabase `plan_catalog`.
//
// The agency's catalog of billing plans. Seed ships Basic / Pro / Enterprise.
// Hydration overlays DB rows; writes optimistically update cache then UPSERT.
//
// Snapshot discipline (CLAUDE.md): getPlanCatalog() is reference-stable —
// version counter bumps on every write; snapshot cached against that.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import type { PolicyValueMap } from '@/lib/agency/types';
import type { Plan } from './types';

const CHANGE_EVENT = 'webnua:plan-catalog-change';

// --- Seed --------------------------------------------------------------------

/** Starting catalog — three tiers, each with a packaged policy bundle.
 *  Frozen so callers can't mutate the shared default. */
export const PLAN_CATALOG_SEED: readonly Plan[] = Object.freeze([
  {
    id: 'basic',
    name: 'Basic',
    description:
      'A single managed funnel and website. View-only builder access for the client team.',
    price: 149,
    currency: 'AUD',
    billingCycle: 'monthly',
    policy: {
      defaultSeatLimit: 2,
      defaultClientCapabilities: ['viewBuilder'],
      integrationDefaults: {
        sharedProviders: {
          resend: true,
          twilio: false,
          'meta-ads': false,
          gbp: false,
          vercel: true,
          anthropic: true,
        },
      },
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description:
      'Managed funnels plus self-serve copy and media editing, ad campaigns, and review automation.',
    price: 349,
    currency: 'AUD',
    billingCycle: 'monthly',
    policy: {
      defaultSeatLimit: 5,
      defaultClientCapabilities: ['viewBuilder', 'editCopy', 'editMedia'],
      integrationDefaults: {
        sharedProviders: {
          resend: true,
          twilio: true,
          'meta-ads': true,
          gbp: true,
          vercel: true,
          anthropic: true,
        },
      },
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description:
      'Uncapped seats, full builder access including SEO and AI drafting, and every integration.',
    price: 899,
    currency: 'AUD',
    billingCycle: 'monthly',
    policy: {
      defaultSeatLimit: null,
      defaultClientCapabilities: [
        'viewBuilder',
        'editCopy',
        'editMedia',
        'editSEO',
        'useAI',
      ],
      integrationDefaults: {
        sharedProviders: {
          resend: true,
          twilio: true,
          'meta-ads': true,
          gbp: true,
          vercel: true,
          anthropic: true,
        },
      },
    },
  },
]) as readonly Plan[];

// --- In-memory cache ---------------------------------------------------------

let cache: Plan[] = [...PLAN_CATALOG_SEED];
let version = 0;
let snapshotVersion = -1;
let snapshotValue: readonly Plan[] = PLAN_CATALOG_SEED;

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydratePlanCatalog(): Promise<void> {
  const { data, error } = await supabase
    .from('plan_catalog')
    .select('id, name, description, price, currency, billing_cycle, policy');

  if (error) {
    console.error('[plan-catalog] hydrate failed:', normalizeError(error).message);
    return;
  }

  if (!data || data.length === 0) {
    // No rows yet — keep the seed.
    return;
  }

  cache = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    currency: row.currency as string,
    billingCycle: row.billing_cycle as Plan['billingCycle'],
    policy: (row.policy ?? {}) as Partial<PolicyValueMap>,
  }));
  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** The full plan catalog. Reference-stable per version. */
export function getPlanCatalog(): readonly Plan[] {
  if (version === snapshotVersion) return snapshotValue;
  snapshotVersion = version;
  snapshotValue = [...cache];
  return snapshotValue;
}

/** One plan by id, or undefined when not in catalog. */
export function getPlan(planId: string): Plan | undefined {
  return cache.find((plan) => plan.id === planId);
}

// --- Writes ------------------------------------------------------------------

/** Add a new plan or replace an existing one (matched by id). */
export function upsertPlan(plan: Plan): void {
  const idx = cache.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    cache = cache.map((p) => (p.id === plan.id ? plan : p));
  } else {
    cache = [...cache, plan];
  }
  dispatch();

  void supabase
    .from('plan_catalog')
    .upsert(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billing_cycle: plan.billingCycle,
        policy: plan.policy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[plan-catalog] upsertPlan failed:', normalizeError(result.error).message);
      }
    });
}

/** Remove a plan from the catalog. */
export function removePlan(planId: string): void {
  if (!cache.some((p) => p.id === planId)) return;
  cache = cache.filter((p) => p.id !== planId);
  dispatch();

  void supabase
    .from('plan_catalog')
    .delete()
    .eq('id', planId)
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[plan-catalog] removePlan failed:', normalizeError(result.error).message);
      }
    });
}

/** Drop every overlay edit, reverting the catalog to the seed. */
export function resetPlanCatalog(): void {
  cache = [...PLAN_CATALOG_SEED];
  dispatch();
  // Note: does not delete DB rows — a true reset would require a DB migration.
}

export function subscribePlanCatalog(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
