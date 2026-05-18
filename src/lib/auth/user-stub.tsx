'use client';

// =============================================================================
// User resolution — Phase 2: real Supabase Auth.
//
// The *session user* is now resolved from a real Supabase session:
// `UserProvider` reads `supabase.auth` + the `public.users` profile +
// `capability_grants`, and `useUser` / `useRole` / `useCapabilities` resolve
// from that. The localStorage user-switch stub is gone — sign-in is real.
//
// The capability layer itself (`capabilities.ts`, `explainers.ts`,
// `resolver.ts`) is product code and did NOT move — only how the current
// user is *resolved* changed. `CapabilityOverrideProvider` also survives
// (wizard-frame lock — product behaviour).
//
// Still stub, pending Phase 3 cluster wiring (flagged, not load-bearing for
// auth): the `STUB_USER_DEFS` roster + the localStorage capability-grant
// overlay (`webnua.dev.grants`) that backs `/settings/access`'s editing grid,
// and `viewAs` impersonation, which still cycles that roster. These surfaces
// wire to live data per-cluster in Phase 3; the session user above does not
// depend on them.
//
// Filename kept (`user-stub.tsx`) so the ~50 import sites are untouched —
// every consumer hook keeps its exact shape.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { supabase } from '@/lib/supabase/client';

import {
  ADMIN_DEFAULTS,
  CLIENT_DEFAULTS,
  type Capability,
  type CapabilityGrant,
  type Role,
  type User,
} from './capabilities';

// ---- localStorage keys (remaining stub surfaces) ----

export const STUB_GRANTS_KEY = 'webnua.dev.grants';
export const STUB_VIEW_AS_KEY = 'webnua.dev.view-as-user-id';

// Website data lives in the real model (see `src/lib/website/data-stub.tsx`).
// Re-exported here only for callers transitioning import paths.
export { findWebsite, getWebsitesForClient } from '@/lib/website/data-stub';

// ---- Stub roster (backs /settings/access + viewAs — Phase 3 wires these) ----

type StubUserDef = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  defaultGrants: CapabilityGrant[];
  accessibleWebsiteIds: string[];
  clientId: string | null;
};

export const STUB_USER_DEFS: StubUserDef[] = [
  {
    id: 'user-admin-craig',
    displayName: 'Craig',
    email: 'craig@webnua.com',
    role: 'admin',
    defaultGrants: [],
    accessibleWebsiteIds: [],
    clientId: null,
  },
  {
    id: 'user-client-mark',
    displayName: 'Mark',
    email: 'mark@voltline.com.au',
    role: 'client',
    defaultGrants: [
      {
        userId: 'user-client-mark',
        websiteId: 'website-voltline',
        capabilities: ['editCopy', 'editMedia', 'editSEO', 'useAI'],
      },
    ],
    accessibleWebsiteIds: ['website-voltline'],
    clientId: 'voltline',
  },
  {
    id: 'user-client-liam',
    displayName: 'Liam',
    email: 'liam@voltline.com.au',
    role: 'client',
    defaultGrants: [],
    accessibleWebsiteIds: ['website-voltline'],
    clientId: 'voltline',
  },
  {
    id: 'user-client-anna',
    displayName: 'Anna',
    email: 'anna@freshhome.com.au',
    role: 'client',
    defaultGrants: [],
    accessibleWebsiteIds: ['website-freshhome'],
    clientId: 'freshhome',
  },
];

/** Stub user defs for a given client business. */
export function getUserDefsForClient(clientId: string): StubUserDef[] {
  return STUB_USER_DEFS.filter((u) => u.clientId === clientId);
}

/** Every client (non-admin) user def. */
export function getClientUserDefs(): StubUserDef[] {
  return STUB_USER_DEFS.filter((u) => u.role === 'client');
}

export const ROLE_LANDING: Record<Role, string> = {
  client: '/dashboard',
  admin: '/dashboard',
};

// ---- Grant resolution ----

function roleDefaultCaps(role: Role): readonly Capability[] {
  return role === 'admin' ? ADMIN_DEFAULTS : CLIENT_DEFAULTS;
}

function resolveCapabilities(
  role: Role,
  grants: CapabilityGrant[],
): Set<Capability> {
  const out = new Set<Capability>(roleDefaultCaps(role));
  for (const grant of grants) {
    for (const cap of grant.capabilities) {
      out.add(cap);
    }
  }
  return out;
}

function buildUser(def: StubUserDef, grants: CapabilityGrant[]): User {
  return {
    id: def.id,
    displayName: def.displayName,
    email: def.email,
    role: def.role,
    clientId: def.clientId,
    capabilities: resolveCapabilities(def.role, grants),
  };
}

// ---- Supabase session → User ----
//
// `clientId` resolves to the client's `slug` (`voltline`, `freshhome`, …) —
// the value the (still-stubbed) website/admin-client data layers join on.
// Phase 3 swaps those joins to the real client UUID per cluster.

type ClientSlugRel = { slug: string } | { slug: string }[] | null;

function readClientSlug(rel: ClientSlugRel): string | null {
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.slug ?? null;
}

async function loadSessionUser(authUserId: string): Promise<User | null> {
  const { data: profile, error } = await supabase
    .from('users')
    // Disambiguate the embed: `users` and `clients` have two FK paths
    // (`users.client_id` and `clients.onboarded_by`), so the relationship is
    // pinned to the `users_client_id_fkey` constraint explicitly.
    .select('id, display_name, email, role, client:clients!users_client_id_fkey(slug)')
    .eq('id', authUserId)
    .single();

  if (error || !profile) {
    if (error) {
      console.error('Failed to load user profile:', error.message);
    }
    return null;
  }

  const { data: grantRows, error: grantsError } = await supabase
    .from('capability_grants')
    .select('website_id, capabilities')
    .eq('user_id', authUserId);

  if (grantsError) {
    console.error('Failed to load capability grants:', grantsError.message);
  }

  const role = profile.role as Role;
  const grants: CapabilityGrant[] = (grantRows ?? []).map((g) => ({
    userId: authUserId,
    websiteId: g.website_id ?? '*',
    capabilities: (g.capabilities ?? []) as Capability[],
  }));

  return {
    id: profile.id,
    displayName: profile.display_name,
    email: profile.email,
    role,
    clientId: readClientSlug(profile.client as ClientSlugRel),
    capabilities: resolveCapabilities(role, grants),
  };
}

// ---- External-store glue (grant overlay + viewAs — remaining stub) ----

const GRANTS_EVENT = 'webnua:grants-change';
const VIEW_AS_EVENT = 'webnua:view-as-change';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredViewAsId(): string | null {
  return safeRead(STUB_VIEW_AS_KEY);
}

function readStoredGrants(): Record<string, CapabilityGrant[]> | null {
  const raw = safeRead(STUB_GRANTS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, CapabilityGrant[]>;
  } catch {
    return null;
  }
}

function subscribeGrants(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(GRANTS_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(GRANTS_EVENT, callback);
  };
}

function subscribeViewAs(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(VIEW_AS_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(VIEW_AS_EVENT, callback);
  };
}

// ---- Context ----

type UserContextValue = {
  /** The actually-signed-in user (not the view-as override). */
  user: User | null;
  /** The user being impersonated via view-as, if active. */
  viewAsUser: User | null;
  /** Effective capability set — viewAsUser when active, else user. */
  effectiveCapabilities: Set<Capability>;
  /** Stub roster with currently-resolved grant overrides (Phase 3 wires). */
  allUsers: User[];
  hydrated: boolean;
  /** No-op — user switching is gone (real sign-in replaces it). */
  setUserId: (id: string) => void;
  /** Signs the current session out. */
  clearUser: () => void;
  setViewAsUserId: (id: string | null) => void;
  /** Replace the grant for (userId, websiteId) — stub roster overlay. */
  setUserGrant: (
    userId: string,
    websiteId: string,
    capabilities: Capability[],
  ) => void;
  resetGrants: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

// ---- Capability override (wizard-frame mode) ----
//
// A subtree can lock the effective capability set to a fixed list, regardless
// of the signed-in user — used by the onboarding wizard's draft-walk step.
// `useCapabilities()` consults this first; when present it wins.

const CapabilityOverrideContext = createContext<Set<Capability> | null>(null);

export function CapabilityOverrideProvider({
  capabilities,
  children,
}: {
  capabilities: readonly Capability[];
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => new Set<Capability>(capabilities),
    [capabilities],
  );
  return (
    <CapabilityOverrideContext.Provider value={value}>
      {children}
    </CapabilityOverrideContext.Provider>
  );
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Resolve the session user from Supabase: initial session + auth changes.
  useEffect(() => {
    let active = true;

    const resolve = async (authUserId: string | undefined) => {
      const next = authUserId ? await loadSessionUser(authUserId) : null;
      if (!active) return;
      setUser(next);
      setHydrated(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      void resolve(data.session?.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // viewAs impersonation + the grant overlay still read localStorage.
  const grantsStore = useSyncExternalStore(
    subscribeGrants,
    readStoredGrants,
    () => null,
  );
  const viewAsId = useSyncExternalStore(
    subscribeViewAs,
    readStoredViewAsId,
    () => null,
  );

  // Stub roster — backs /settings/access + the viewAs cycle (Phase 3 wires).
  const allUsers = useMemo<User[]>(() => {
    return STUB_USER_DEFS.map((def) => {
      const override = grantsStore?.[def.id];
      const grants = override ?? def.defaultGrants;
      return buildUser(def, grants);
    });
  }, [grantsStore]);

  // Only honour viewAs when the actual user is an admin.
  const viewAsUser = useMemo(() => {
    if (!viewAsId || !user || user.role !== 'admin') return null;
    return allUsers.find((u) => u.id === viewAsId) ?? null;
  }, [allUsers, viewAsId, user]);

  const effectiveCapabilities = useMemo<Set<Capability>>(() => {
    if (viewAsUser) return viewAsUser.capabilities;
    return user?.capabilities ?? new Set<Capability>();
  }, [user, viewAsUser]);

  const setUserId = useCallback(() => {
    // User switching is gone — real sign-in replaces it. Kept for the
    // unchanged context shape; no consumer should still call it.
    console.warn('setUserId is a no-op since Phase 2 — sign in instead.');
  }, []);

  const clearUser = useCallback(() => {
    void supabase.auth.signOut();
    try {
      window.localStorage.removeItem(STUB_VIEW_AS_KEY);
      window.dispatchEvent(new Event(VIEW_AS_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setViewAsUserId = useCallback((id: string | null) => {
    try {
      if (id == null) {
        window.localStorage.removeItem(STUB_VIEW_AS_KEY);
      } else {
        window.localStorage.setItem(STUB_VIEW_AS_KEY, id);
      }
      window.dispatchEvent(new Event(VIEW_AS_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setUserGrant = useCallback(
    (userId: string, websiteId: string, capabilities: Capability[]) => {
      try {
        const current = readStoredGrants() ?? {};
        const def = STUB_USER_DEFS.find((u) => u.id === userId);
        if (!def) return;

        const baseline = current[userId] ?? def.defaultGrants;
        const filtered = baseline.filter((g) => g.websiteId !== websiteId);
        const next =
          capabilities.length > 0
            ? [...filtered, { userId, websiteId, capabilities }]
            : filtered;

        const nextStore = { ...current, [userId]: next };
        window.localStorage.setItem(STUB_GRANTS_KEY, JSON.stringify(nextStore));
        window.dispatchEvent(new Event(GRANTS_EVENT));
      } catch {
        // localStorage unavailable
      }
    },
    [],
  );

  const resetGrants = useCallback(() => {
    try {
      window.localStorage.removeItem(STUB_GRANTS_KEY);
      window.dispatchEvent(new Event(GRANTS_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      viewAsUser,
      effectiveCapabilities,
      allUsers,
      hydrated,
      setUserId,
      clearUser,
      setViewAsUserId,
      setUserGrant,
      resetGrants,
    }),
    [
      user,
      viewAsUser,
      effectiveCapabilities,
      allUsers,
      hydrated,
      setUserId,
      clearUser,
      setViewAsUserId,
      setUserGrant,
      resetGrants,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// ---- Hooks: capability layer ----

export function useUser(): User | null {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within <UserProvider>');
  return ctx.user;
}

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within <UserProvider>');
  return ctx;
}

/**
 * Returns the effective capability set. A `<CapabilityOverrideProvider>`
 * subtree wins outright (wizard-frame mode); otherwise it's the viewAs
 * override when active, else the signed-in user's set.
 */
export function useCapabilities(): Set<Capability> {
  const override = useContext(CapabilityOverrideContext);
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error('useCapabilities must be used within <UserProvider>');
  return override ?? ctx.effectiveCapabilities;
}

export function useCan(cap: Capability): boolean {
  return useCapabilities().has(cap);
}

export function useCanAny(...caps: Capability[]): boolean {
  const userCaps = useCapabilities();
  return caps.some((c) => userCaps.has(c));
}

export function useCanAll(...caps: Capability[]): boolean {
  const userCaps = useCapabilities();
  return caps.every((c) => userCaps.has(c));
}

/** True when the active session has a view-as override applied. */
export function useIsViewingAs(): boolean {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useIsViewingAs must be used within <UserProvider>');
  return ctx.viewAsUser != null;
}

// ---- Hooks: legacy role surface ----
//
// Consumers expect useRole() => { role, hydrated, setRole, clearRole }.
// Kept verbatim; derived from the underlying user state. View-as does NOT
// flip the role — operators viewing as a client keep the operator nav shape.

type RoleContextShape = {
  role: Role | null;
  hydrated: boolean;
  setRole: (role: Role) => void;
  clearRole: () => void;
};

export function useRole(): RoleContextShape {
  const ctx = useUserContext();
  const role = ctx.user?.role ?? null;
  const setRole = useCallback(() => {
    // Role is no longer chosen — it comes from the signed-in profile.
    console.warn('setRole is a no-op since Phase 2 — sign in instead.');
  }, []);
  return {
    role,
    hydrated: ctx.hydrated,
    setRole,
    clearRole: ctx.clearUser,
  };
}

// ---- Backwards-compat aliases ----

/**
 * The stub roster pre-resolved with default grants. Backs the viewAs cycle
 * + /dev surfaces; Phase 3 wires these to live data.
 */
export const STUB_USERS = STUB_USER_DEFS.map((def) =>
  buildUser(def, def.defaultGrants),
);

// Re-export Role for callers that imported it from the prior role-stub.
export type { Role } from './capabilities';
