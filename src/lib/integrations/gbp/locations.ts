// =============================================================================
// client_gbp_locations data access.
//
// Service-role reads + writes against client_gbp_locations (migration 0066).
// One row per client (UNIQUE on client_id); the operator UI calls into here
// after the OAuth callback to register which Google location is "this
// Webnua client's listing", and the sync job updates the cached fields on
// every run.
//
// SERVER-ONLY — pulls the service-role client via getIntegrationDb().
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  ClientGbpLocationInsert,
  ClientGbpLocationRow,
} from './types';

/** Fetch the connected GBP location row for one client. Returns null when
 *  the client has not yet picked a location (the OAuth connection may
 *  exist without one — they are decoupled). */
export async function findLocationByClientId(
  clientId: string,
): Promise<ClientGbpLocationRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('client_gbp_locations')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    throw new Error(`findLocationByClientId failed: ${error.message}`);
  }
  return (data as ClientGbpLocationRow | null) ?? null;
}

/** Upsert the connected location for a client. Either inserts a fresh row
 *  or updates the existing one in place (UNIQUE on client_id). */
export async function upsertLocation(
  insert: ClientGbpLocationInsert,
): Promise<ClientGbpLocationRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('client_gbp_locations')
    .upsert(insert, { onConflict: 'client_id' })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`upsertLocation failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as ClientGbpLocationRow;
}

/** Patch the cached metrics + last_synced_at after a successful sync. */
export async function updateLocationSyncState(
  clientId: string,
  patch: {
    location_title?: string;
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    review_link?: string | null;
    current_rating?: number | null;
    review_count?: number;
    last_synced_at: string;
  },
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('client_gbp_locations')
    .update(patch)
    .eq('client_id', clientId);
  if (error) {
    throw new Error(`updateLocationSyncState failed: ${error.message}`);
  }
}

/** Remove the connection between a client and any GBP location. Called by
 *  the disconnect flow (when the customer revokes the underlying OAuth
 *  connection the location selection is orphaned — wipe it so a reconnect
 *  re-prompts for a fresh pick). Safe to call when no row exists. */
export async function deleteLocationByClientId(clientId: string): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('client_gbp_locations')
    .delete()
    .eq('client_id', clientId);
  if (error) {
    throw new Error(`deleteLocationByClientId failed: ${error.message}`);
  }
}

/** Resolve the review link for a client — the URL `{{review.link}}`
 *  substitutes to in send_sms / send_email. Null when the client has no
 *  GBP location connected or no review URL is known. */
export async function getReviewLinkForClient(
  clientId: string,
): Promise<string | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('client_gbp_locations')
    .select('review_link')
    .eq('client_id', clientId)
    .maybeSingle();
  const row = data as { review_link?: string | null } | null;
  return row?.review_link ?? null;
}
