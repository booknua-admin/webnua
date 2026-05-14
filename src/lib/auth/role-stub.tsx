'use client';

// =============================================================================
// STUB — role-resolution stand-in. Delete when Supabase auth ships.
//
// Three deletion points (see CLAUDE.md "Open decisions / parked"):
//   1. This file — `src/lib/auth/role-stub.tsx`
//   2. The <RoleProvider> mount in `src/app/layout.tsx`
//   3. The <DevRoleSwitcher /> mount in (client) + (admin) layouts
//      (`src/components/shared/DevRoleSwitcher.tsx` is the component itself)
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react';

export type Role = 'client' | 'admin';

export const STUB_ROLE_KEY = 'webnua.dev.role';

export const ROLE_LANDING: Record<Role, string> = {
  client: '/dashboard',
  admin: '/clients',
};

type RoleContextValue = {
  role: Role | null;
  hydrated: boolean;
  setRole: (role: Role) => void;
  clearRole: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const ROLE_EVENT = 'webnua:role-change';

function readStoredRole(): Role | null {
  try {
    const stored = window.localStorage.getItem(STUB_ROLE_KEY);
    return stored === 'client' || stored === 'admin' ? stored : null;
  } catch {
    return null;
  }
}

function subscribeRole(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(ROLE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(ROLE_EVENT, callback);
  };
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(
    subscribeRole,
    readStoredRole,
    () => null,
  );
  const hydrated = useSyncExternalStore(
    subscribeRole,
    () => true,
    () => false,
  );

  const setRole = useCallback((next: Role) => {
    try {
      window.localStorage.setItem(STUB_ROLE_KEY, next);
      window.dispatchEvent(new Event(ROLE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const clearRole = useCallback(() => {
    try {
      window.localStorage.removeItem(STUB_ROLE_KEY);
      window.dispatchEvent(new Event(ROLE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <RoleContext.Provider value={{ role, hydrated, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within <RoleProvider>');
  }
  return ctx;
}
