export type AdminClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  badge?: { text: string; tone?: 'default' | 'muted' };
  /** Legacy two-value bucket — kept for surfaces that just want to know
   *  "is this client in setup vs not". `lifecycleStatus` below is the raw
   *  enum value the `lib/auth/lifecycle.ts` helpers consume — prefer it
   *  for new code (Pattern B dispatch reads it). */
  status?: 'active' | 'setup';
  /** The raw `clients.lifecycle_status` enum value. Drives Pattern B
   *  dispatching (pending_verification / preview / active / banned / …)
   *  via the `lib/auth/lifecycle.ts` helpers. */
  lifecycleStatus: string;
};

// The seat limit is no longer carried here — it is the `defaultSeatLimit`
// policy key (Cluster 8 · Session 4b). The former per-client seed values
// migrated into SUB_ACCOUNT_OVERRIDE_SEED in lib/agency/override-stub.ts.
//
// Phase 5: adminClients is now an empty array — the live source is
// clients-store (getAdminClients / useAdminClients). This stub remains so
// the ~10 import sites that import the TYPE continue to compile without
// changes; consumers that READ the list at render time have been updated to
// call getAdminClients() or useAdminClients() from clients-store.
export const adminClients: AdminClient[] = [];
