// =============================================================================
// STUB — plan catalog store (Cluster 9 · Session 1).
//
// The agency's catalog of billing plans. The seed ships Basic / Pro /
// Enterprise; the localStorage overlay holds operator edits made on the
// /settings/plans tab (Cluster 9 · Session 2).
//
// When real auth ships, replaced by reads/writes against a `plans` table; the
// accessor surface keeps its shape.
//
// Snapshot discipline (CLAUDE.md): readers used through useSyncExternalStore
// must be reference-stable, so the parsed catalog is cached keyed on the raw
// localStorage string.
// =============================================================================

import type { Plan } from './types';

const STORE_KEY = 'webnua.dev.plan-catalog';
const CHANGE_EVENT = 'webnua:plan-catalog-change';

// --- Seed --------------------------------------------------------------------

/** The starting catalog — three tiers, each with a packaged policy bundle.
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

// --- localStorage overlay ----------------------------------------------------

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

let cacheRaw: string | null | undefined;
let cacheValue: readonly Plan[] = PLAN_CATALOG_SEED;

function readCatalog(): readonly Plan[] {
  const raw = safeRead();
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  if (!raw) {
    cacheValue = PLAN_CATALOG_SEED;
    return cacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as Plan[];
    cacheValue = Array.isArray(parsed) ? parsed : PLAN_CATALOG_SEED;
  } catch {
    cacheValue = PLAN_CATALOG_SEED;
  }
  return cacheValue;
}

function writeCatalog(plans: readonly Plan[]): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(plans));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

// --- Reads -------------------------------------------------------------------

/** The full plan catalog. Reference-stable per overlay state. */
export function getPlanCatalog(): readonly Plan[] {
  return readCatalog();
}

/** One plan by id, or undefined when it isn't in the catalog. */
export function getPlan(planId: string): Plan | undefined {
  return readCatalog().find((plan) => plan.id === planId);
}

// --- Writes ------------------------------------------------------------------

/** Add a new plan or replace an existing one (matched by id). */
export function upsertPlan(plan: Plan): void {
  const catalog = readCatalog();
  const next = catalog.some((p) => p.id === plan.id)
    ? catalog.map((p) => (p.id === plan.id ? plan : p))
    : [...catalog, plan];
  writeCatalog(next);
}

/** Remove a plan from the catalog. */
export function removePlan(planId: string): void {
  const catalog = readCatalog();
  if (!catalog.some((p) => p.id === planId)) return;
  writeCatalog(catalog.filter((p) => p.id !== planId));
}

/** Drop every overlay edit, reverting the catalog to the seed. */
export function resetPlanCatalog(): void {
  try {
    window.localStorage.removeItem(STORE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

export function subscribePlanCatalog(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
