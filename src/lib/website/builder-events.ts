// =============================================================================
// Builder reactivity bus (Phase 4).
//
// The website publish family spans several React Query caches (versions,
// drafts, approvals, audit). A mutation in one place (publish, approve, …)
// must refresh every dependent surface. Rather than thread `queryClient`
// through every call site, mutations fire `BUILDER_EVENT`; the builder query
// hooks subscribe and refetch. Same event-bus pattern the rest of the
// codebase uses for cross-component reactivity.
// =============================================================================

export const BUILDER_EVENT = 'webnua:builder-change';

/** Fire after any builder mutation so dependent queries refetch. */
export function notifyBuilder(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(BUILDER_EVENT));
}

/** Subscribe to builder mutations (in-tab event + cross-tab storage). */
export function subscribeBuilder(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(BUILDER_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(BUILDER_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
