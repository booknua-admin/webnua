export type AdminClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  badge?: { text: string; tone?: 'default' | 'muted' };
  status?: 'active' | 'setup';
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
