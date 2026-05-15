'use client';

// =============================================================================
// STUB — user-resolution stand-in. Replaces the prior role-stub.
//
// Stub layer: three hardcoded users (one admin, two clients with different
// capability sets). Active user id lives in localStorage; switching is via
// <DevRoleSwitcher>. When real auth ships, replace this provider with the
// Supabase-backed equivalent — every consumer hook stays the same shape.
//
// Deletion points (when Supabase auth ships):
//   1. This file — src/lib/auth/user-stub.tsx
//   2. The <UserProvider> mount in src/app/layout.tsx
//   3. <DevRoleSwitcher> + its mounts in (client) + (admin) layouts
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
  type Role,
  type User,
} from './capabilities';

// ---- Stub data ----

export const STUB_ACTIVE_USER_KEY = 'webnua.dev.active-user-id';

const DEFAULT_USER_ID = 'user-admin-craig';

export const STUB_USERS: User[] = [
  {
    id: 'user-admin-craig',
    displayName: 'Craig',
    email: 'craig@webnua.com',
    role: 'admin',
    capabilities: new Set<Capability>(ADMIN_DEFAULTS),
  },
  {
    id: 'user-client-mark',
    displayName: 'Mark',
    email: 'mark@voltline.com.au',
    role: 'client',
    capabilities: new Set<Capability>([
      ...CLIENT_DEFAULTS,
      'editCopy',
      'editMedia',
      'editSEO',
      'useAI',
    ]),
  },
  {
    id: 'user-client-anna',
    displayName: 'Anna',
    email: 'anna@freshhome.com.au',
    role: 'client',
    capabilities: new Set<Capability>(CLIENT_DEFAULTS),
  },
];

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

function findUser(id: string | null): User | null {
  if (!id) return null;
  return STUB_USERS.find((u) => u.id === id) ?? null;
}

// ---- External-store glue ----

const USER_EVENT = 'webnua:active-user-change';

function readStoredUserId(): string | null {
  try {
    return window.localStorage.getItem(STUB_ACTIVE_USER_KEY);
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

// ---- Context ----

type UserContextValue = {
  user: User | null;
  hydrated: boolean;
  setUserId: (id: string) => void;
  clearUser: () => void;
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

  // Default to the admin user when no key is stored. Single-dev stub —
  // no migration logic from any prior key (per design plan §6).
  const resolvedId = storedId ?? (hydrated ? DEFAULT_USER_ID : null);
  const user = useMemo(() => findUser(resolvedId), [resolvedId]);

  const setUserId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STUB_ACTIVE_USER_KEY, id);
      window.dispatchEvent(new Event(USER_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const clearUser = useCallback(() => {
    try {
      window.localStorage.removeItem(STUB_ACTIVE_USER_KEY);
      window.dispatchEvent(new Event(USER_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, hydrated, setUserId, clearUser }}>
      {children}
    </UserContext.Provider>
  );
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

export function useCapabilities(): Set<Capability> {
  const user = useUser();
  return user?.capabilities ?? new Set<Capability>();
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

// ---- Hooks: legacy role surface ----
//
// Existing consumers expect useRole() => { role, hydrated, setRole, clearRole }.
// Kept verbatim; derived from the underlying user state.

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

// Re-export Role for callers that imported it from the prior role-stub.
export type { Role } from './capabilities';
