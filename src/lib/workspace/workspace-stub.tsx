'use client';

// =============================================================================
// workspace-context — agency vs sub-account mode (GoHighLevel-style).
//
// Active workspace is kept in localStorage (approved UI state — not moved to DB).
//   - missing / null → agency mode (cross-client birds-eye)
//   - clientId string (slug) → sub-account mode for that client
//
// `activeClient` resolves from the live clients-store cache, not the dead
// adminClients stub. The provider subscribes to clients-store so it
// re-resolves once clients hydrate.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import {
  getAdminClients,
  subscribeClients,
  type AdminClient,
} from '@/lib/clients/clients-store';

// Re-export for backward compatibility with callers that imported from here.
export type { AdminClient };

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
  window.addEventListener('webnua:clients-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(WORKSPACE_EVENT, callback);
    window.removeEventListener('webnua:clients-change', callback);
  };
}

type WorkspaceContextValue = {
  /** Active client id (slug), or null when in agency (cross-client) mode. */
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

  // Subscribe to the clients cache so activeClient resolves once hydrateClients fires.
  const clients = useSyncExternalStore(
    subscribeClients,
    getAdminClients,
    () => [] as AdminClient[],
  ) as AdminClient[];

  const activeClient = useMemo(() => {
    if (!storedId) return null;
    return clients.find((c: AdminClient) => c.id === storedId) ?? null;
  }, [storedId, clients]);

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
