'use client';

// =============================================================================
// STUB — user-resolution stand-in. Replaces the prior role-stub.
//
// Three hardcoded stub users (Craig admin / Mark@Voltline / Anna@FreshHome).
// Active user id + view-as override id + per-user grant overrides live in
// localStorage. Switching is via <DevRoleSwitcher>. When real auth ships,
// replace this provider with the Supabase-backed equivalent — every consumer
// hook stays the same shape.
//
// Deletion points (when Supabase auth ships):
//   1. This file — src/lib/auth/user-stub.tsx
//   2. The <UserProvider> mount in src/app/layout.tsx
//   3. <DevRoleSwitcher> + its mounts in (client) + (admin) + shared layouts
//   4. The /dev/capabilities verification route — src/app/dev/capabilities/
//
// Existing `useRole()` API surface preserved exactly — every consumer of
// the old role-stub continues to work unchanged.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import {
  ADMIN_DEFAULTS,
  CLIENT_DEFAULTS,
  type Capability,
  type CapabilityGrant,
  type Role,
  type User,
} from './capabilities';

// ---- Stub data ----

export const STUB_ACTIVE_USER_KEY = 'webnua.dev.active-user-id';
export const STUB_GRANTS_KEY = 'webnua.dev.grants';
export const STUB_VIEW_AS_KEY = 'webnua.dev.view-as-user-id';

const DEFAULT_USER_ID = 'user-admin-craig';

// Website data moved into the real model in Session 2 (see
// `src/lib/website/data-stub.tsx`). Helpers are re-exported here only for
// the brief moment between sessions where downstream code still imports
// from `@/lib/auth/user-stub`. Prefer importing directly from
// `@/lib/website/data-stub` going forward.
export { findWebsite, getWebsitesForClient } from '@/lib/website/data-stub';

type StubUserDef = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  // The default grants applied when the local store has no overrides.
  // Editing in /settings/access persists overrides under STUB_GRANTS_KEY.
  defaultGrants: CapabilityGrant[];
  // The website(s) this client user has access to. Operators (`role: admin`)
  // have implicit workspace-wide access — `accessibleWebsiteIds` is empty.
  accessibleWebsiteIds: string[];
  // Which client business this user belongs to. Operators have null.
  // Resolves to AdminClient.id (lib/nav/admin-clients.ts).
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

/** Stub user defs for a given client business, or all if `clientId` is null. */
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

// First stub user for each role — used by `setRole` for backwards compat
// with the existing login screen, which sets a role rather than a user.
const ROLE_DEFAULT_USER: Record<Role, string> = {
  admin: 'user-admin-craig',
  client: 'user-client-mark',
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
    capabilities: resolveCapabilities(def.role, grants),
  };
}

// ---- External-store glue ----

const USER_EVENT = 'webnua:active-user-change';
const GRANTS_EVENT = 'webnua:grants-change';
const VIEW_AS_EVENT = 'webnua:view-as-change';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredUserId(): string | null {
  return safeRead(STUB_ACTIVE_USER_KEY);
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

function subscribeUser(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(USER_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(USER_EVENT, callback);
  };
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
  /** All stub users with their currently-resolved grant overrides. */
  allUsers: User[];
  hydrated: boolean;
  setUserId: (id: string) => void;
  clearUser: () => void;
  setViewAsUserId: (id: string | null) => void;
  /** Replace the grant for (userId, websiteId) with these capabilities. */
  setUserGrant: (
    userId: string,
    websiteId: string,
    capabilities: Capability[],
  ) => void;
  resetGrants: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const storedId = useSyncExternalStore(
    subscribeUser,
    readStoredUserId,
    () => null,
  );
  const hydrated = useSyncExternalStore(
    subscribeUser,
    () => true,
    () => false,
  );
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

  // Default to the admin user when no key is stored.
  const resolvedId = storedId ?? (hydrated ? DEFAULT_USER_ID : null);

  // Build all users with their resolved grants.
  const allUsers = useMemo<User[]>(() => {
    return STUB_USER_DEFS.map((def) => {
      const override = grantsStore?.[def.id];
      const grants = override ?? def.defaultGrants;
      return buildUser(def, grants);
    });
  }, [grantsStore]);

  const user = useMemo(
    () => allUsers.find((u) => u.id === resolvedId) ?? null,
    [allUsers, resolvedId],
  );

  // Only honour viewAs when the actual user is an admin.
  const viewAsUser = useMemo(() => {
    if (!viewAsId || !user || user.role !== 'admin') return null;
    return allUsers.find((u) => u.id === viewAsId) ?? null;
  }, [allUsers, viewAsId, user]);

  const effectiveCapabilities = useMemo<Set<Capability>>(() => {
    if (viewAsUser) return viewAsUser.capabilities;
    return user?.capabilities ?? new Set<Capability>();
  }, [user, viewAsUser]);

  const setUserId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STUB_ACTIVE_USER_KEY, id);
      // Switching users always clears any view-as override — viewing as
      // someone-else-as-me makes no sense.
      window.localStorage.removeItem(STUB_VIEW_AS_KEY);
      window.dispatchEvent(new Event(USER_EVENT));
      window.dispatchEvent(new Event(VIEW_AS_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const clearUser = useCallback(() => {
    try {
      window.localStorage.removeItem(STUB_ACTIVE_USER_KEY);
      window.localStorage.removeItem(STUB_VIEW_AS_KEY);
      window.dispatchEvent(new Event(USER_EVENT));
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

        // Start from this user's existing grants (override or default),
        // replace the grant for the given website.
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

// ---- Hooks: new capability layer ----

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

/** Returns the effective capability set (viewAs override when active). */
export function useCapabilities(): Set<Capability> {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useCapabilities must be used within <UserProvider>');
  return ctx.effectiveCapabilities;
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
// Existing consumers expect useRole() => { role, hydrated, setRole, clearRole }.
// Kept verbatim; derived from the underlying user state. View-as does NOT
// flip the role — operators viewing as a client still get the operator nav
// shape (see design doc §1.5).

type RoleContextShape = {
  role: Role | null;
  hydrated: boolean;
  setRole: (role: Role) => void;
  clearRole: () => void;
};

export function useRole(): RoleContextShape {
  const ctx = useUserContext();
  const role = ctx.user?.role ?? null;
  const setRole = useCallback(
    (next: Role) => {
      ctx.setUserId(ROLE_DEFAULT_USER[next]);
    },
    [ctx],
  );
  return {
    role,
    hydrated: ctx.hydrated,
    setRole,
    clearRole: ctx.clearUser,
  };
}

// ---- Backwards-compat aliases ----

/**
 * @deprecated kept for any caller that imported the resolved-set list from
 * 1a. Use `useUserContext().allUsers` for the live list.
 */
export const STUB_USERS = STUB_USER_DEFS.map((def) => buildUser(def, def.defaultGrants));

// Re-export Role for callers that imported it from the prior role-stub.
export type { Role } from './capabilities';
