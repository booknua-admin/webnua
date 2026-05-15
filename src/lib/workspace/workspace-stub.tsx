'use client';

// =============================================================================
// STUB — workspace-context stand-in. Drives the agency vs sub-account
// two-tier model (GoHighLevel-style): operator's default view is the agency
// (cross-client birds-eye); drilling into a client via the picker switches
// the context to that sub-account.
//
// Active workspace lives in localStorage under `webnua.dev.active-client-id`.
//   - missing / null → agency mode (cross-client)
//   - clientId string → sub-account mode for that client
//
// For client-role users, this context has no effect — they only ever see
// their own workspace. The picker is hidden on the client side.
//
// Deletion points (when real auth ships):
//   1. This file — workspace resolution moves to backend membership lookups.
//   2. <WorkspaceProvider> mount in src/app/layout.tsx.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { type AdminClient, adminClients } from '@/lib/nav/admin-clients';

export const STUB_ACTIVE_CLIENT_KEY = 'webnua.dev.active-client-id';

const WORKSPACE_EVENT = 'webnua:active-client-change';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredClientId(): string | null {
  return safeRead(STUB_ACTIVE_CLIENT_KEY);
}

function subscribeWorkspace(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(WORKSPACE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(WORKSPACE_EVENT, callback);
  };
}

type WorkspaceContextValue = {
  /** Active client id, or null when in agency (cross-client) mode. */
  activeClientId: string | null;
  /** Resolved active client object, or null when in agency mode. */
  activeClient: AdminClient | null;
  /** True after first client-side render. */
  hydrated: boolean;
  /** Switch to sub-account mode for the given client. */
  setActiveClientId: (id: string) => void;
  /** Return to agency (cross-client) mode. */
  clearActiveClient: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const storedId = useSyncExternalStore(
    subscribeWorkspace,
    readStoredClientId,
    () => null,
  );
  const hydrated = useSyncExternalStore(
    subscribeWorkspace,
    () => true,
    () => false,
  );

  const activeClient = useMemo(() => {
    if (!storedId) return null;
    return adminClients.find((c) => c.id === storedId) ?? null;
  }, [storedId]);

  const setActiveClientId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STUB_ACTIVE_CLIENT_KEY, id);
      window.dispatchEvent(new Event(WORKSPACE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const clearActiveClient = useCallback(() => {
    try {
      window.localStorage.removeItem(STUB_ACTIVE_CLIENT_KEY);
      window.dispatchEvent(new Event(WORKSPACE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeClientId: activeClient?.id ?? null,
      activeClient,
      hydrated,
      setActiveClientId,
      clearActiveClient,
    }),
    [activeClient, hydrated, setActiveClientId, clearActiveClient],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  }
  return ctx;
}

export function useActiveClient(): AdminClient | null {
  return useWorkspace().activeClient;
}

/** True when the operator is in cross-client birds-eye mode. */
export function useIsAgencyMode(): boolean {
  return useWorkspace().activeClientId === null;
}
