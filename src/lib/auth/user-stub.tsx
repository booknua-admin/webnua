'use client';

// =============================================================================
// User resolution — Phase 5: real Supabase Auth, end to end.
//
// `UserProvider` resolves the signed-in user from a real Supabase session:
// `supabase.auth` → the `public.users` profile → `capability_grants`. Every
// consumer hook (`useUser` / `useRole` / `useCapabilities` / `useCan…`)
// resolves from that.
//
// The localStorage stub layer is gone — there is no more user-switching,
// no view-as impersonation, and no localStorage capability-grant overlay.
// Capability grants are live `capability_grants` rows; the `/settings/access`
// editing grid writes them through `lib/auth/roster-queries.ts`.
//
// The capability layer itself (`capabilities.ts`, `explainers.ts`,
// `resolver.ts`) is product code — it did NOT move; only how the current
// user is *resolved* changed. `CapabilityOverrideProvider` also survives
// (the wizard-frame lock — product behaviour, not stub).
//
// Filename kept (`user-stub.tsx`) so the ~50 import sites are untouched.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

// Website data lives in the real model (see `src/lib/website/data-stub.tsx`).
// Re-exported here only for callers transitioning import paths.
export { findWebsite, getWebsitesForClient } from '@/lib/website/data-stub';

export const ROLE_LANDING: Record<Role, string> = {
  client: '/dashboard',
  admin: '/dashboard',
};

// ---- Grant resolution -------------------------------------------------------

function roleDefaultCaps(role: Role): readonly Capability[] {
  return role === 'admin' ? ADMIN_DEFAULTS : CLIENT_DEFAULTS;
}

/** Effective capability set = role defaults ∪ every granted capability. */
export function resolveCapabilities(
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

// ---- Supabase session → User ------------------------------------------------
//
// `clientId` resolves to the client's `slug` (`voltline`, `freshhome`, …) —
// the value the website/admin-client data layers join on.

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
  const grants: CapabilityGrant[] = (grantRows ?? []).map(
    (g: { website_id: string | null; capabilities: string[] | null }) => ({
      userId: authUserId,
      websiteId: g.website_id ?? '*',
      capabilities: (g.capabilities ?? []) as Capability[],
    }),
  );

  return {
    id: profile.id,
    displayName: profile.display_name,
    email: profile.email,
    role,
    clientId: readClientSlug(profile.client as ClientSlugRel),
    capabilities: resolveCapabilities(role, grants),
  };
}

// ---- Context ----------------------------------------------------------------

type UserContextValue = {
  /** The signed-in user, or null when there is no session. */
  user: User | null;
  /** The signed-in user's effective capability set. */
  effectiveCapabilities: Set<Capability>;
  /** True once the initial session resolution has completed. */
  hydrated: boolean;
  /** Sign the current session out. */
  clearUser: () => void;
  /** Re-resolve the session user from Supabase (after a grant change, etc.). */
  refreshUser: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

// ---- Capability override (wizard-frame mode) --------------------------------
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
  const [refreshTick, setRefreshTick] = useState(0);

  // Resolve the session user from Supabase: initial session + auth changes.
  useEffect(() => {
    let active = true;

    const resolve = async (authUserId: string | undefined) => {
      const next = authUserId ? await loadSessionUser(authUserId) : null;
      if (!active) return;
      setUser(next);
      setHydrated(true);
    };

    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string } } | null } }) => {
      void resolve(data.session?.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: unknown, session: { user: { id: string } } | null) => {
      void resolve(session?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshTick]);

  const clearUser = useCallback(() => {
    void supabase.auth.signOut();
  }, []);

  const refreshUser = useCallback(() => {
    setRefreshTick((t: number) => t + 1);
  }, []);

  const effectiveCapabilities = useMemo<Set<Capability>>(
    () => user?.capabilities ?? new Set<Capability>(),
    [user],
  );

  const value = useMemo<UserContextValue>(
    () => ({ user, effectiveCapabilities, hydrated, clearUser, refreshUser }),
    [user, effectiveCapabilities, hydrated, clearUser, refreshUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// ---- Hooks: capability layer ------------------------------------------------

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
 * subtree wins outright (wizard-frame mode); otherwise it is the signed-in
 * user's resolved set.
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

// ---- Hooks: legacy role surface ---------------------------------------------
//
// Consumers expect useRole() => { role, hydrated, setRole, clearRole }.
// Role comes from the signed-in profile; `setRole` is a no-op kept only so the
// long-standing context shape is unchanged for the ~20 layout consumers.

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
    console.warn('setRole is a no-op — sign in instead.');
  }, []);
  return {
    role,
    hydrated: ctx.hydrated,
    setRole,
    clearRole: ctx.clearUser,
  };
}

// Re-export Role for callers that imported it from the prior role-stub.
export type { Role } from './capabilities';
