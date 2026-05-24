// =============================================================================
// Meta Ads — client_meta_ad_accounts data access.
//
// Phase 7 Meta Ads. Service-role reads + writes; tenant access is RLS-bound
// at the table level for the operator-UI hooks.
//
// SERVER-ONLY — getIntegrationDb() is the service-role client.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { ClientMetaAdAccountInsert, ClientMetaAdAccountRow } from './types';

const TABLE = 'client_meta_ad_accounts';

export async function findAdAccountByClientId(
  clientId: string,
): Promise<ClientMetaAdAccountRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    throw new Error(`findAdAccountByClientId failed: ${error.message}`);
  }
  return (data as ClientMetaAdAccountRow | null) ?? null;
}

export async function upsertAdAccount(
  insert: ClientMetaAdAccountInsert,
): Promise<ClientMetaAdAccountRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    // unique(client_id) — one ad account per client (V1 forcing function)
    .upsert(insert as unknown as never, { onConflict: 'client_id' })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`upsertAdAccount failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as ClientMetaAdAccountRow;
}

export async function updateAdAccountSyncState(
  clientId: string,
  patch: Partial<{
    ad_account_name: string;
    currency: string;
    account_status: number;
    amount_spent_cents: number;
    balance_cents: number;
    timezone_name: string;
    last_synced_at: string;
  }>,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .update(patch as unknown as never)
    .eq('client_id', clientId);
  if (error) {
    throw new Error(`updateAdAccountSyncState failed: ${error.message}`);
  }
}

export async function deleteAdAccountByClientId(clientId: string): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db.from(TABLE).delete().eq('client_id', clientId);
  if (error) {
    throw new Error(`deleteAdAccountByClientId failed: ${error.message}`);
  }
}
