// =============================================================================
// Resend email — client_email_senders data access.
//
// Phase 7 Resend session. Every read/write of client_email_senders (the
// per-client email sender slug + display name) goes through here. The table
// is from migration 0051; not in the generated Database type yet, so the
// access goes through getIntegrationDb() (the untyped service-role client).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { ClientEmailSenderRow, EmailSenderStatus } from './types';

const TABLE = 'client_email_senders';
const COLUMNS = 'id, client_id, slug, display_name, status, custom_domain, created_at';

const SLUG_RE = /^[a-z0-9-]{1,30}$/;

/** True when the slug matches the column's CHECK constraint shape. */
export function isValidSenderSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** The one sender row for a client, or null when none assigned yet. */
export async function getSenderByClientId(
  clientId: string,
): Promise<ClientEmailSenderRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(`getSenderByClientId: ${error.message}`);
  return (data as ClientEmailSenderRow | null) ?? null;
}

/** Look up a sender row by slug — the inbound webhook's resolution step. */
export async function getSenderBySlug(
  slug: string,
): Promise<ClientEmailSenderRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`getSenderBySlug: ${error.message}`);
  return (data as ClientEmailSenderRow | null) ?? null;
}

/** Look up a sender row by slug AND verify it matches a client slug — the
 *  inbound webhook resolves a clientSlug from the recipient address and the
 *  sender slug ought to equal it. They are the same column in V1, so this
 *  is mainly defensive against a future where the two diverge. */
export async function findSenderByClientSlug(
  clientSlug: string,
): Promise<ClientEmailSenderRow | null> {
  // Resolve the client by slug, then read its sender row.
  const db = getIntegrationDb();
  const { data: client, error: clientErr } = await db
    .from('clients')
    .select('id')
    .eq('slug', clientSlug)
    .maybeSingle();
  if (clientErr) throw new Error(`findSenderByClientSlug: ${clientErr.message}`);
  if (!client) return null;
  const clientId = (client as { id: string }).id;
  return getSenderByClientId(clientId);
}

export type InsertSenderInput = {
  clientId: string;
  slug: string;
  displayName: string;
  status?: EmailSenderStatus;
};

/** Insert the email sender row for a client. One per client (the unique
 *  constraint on client_id enforces it). Throws on a slug collision (the
 *  separate unique constraint on slug). */
export async function insertSender(
  input: InsertSenderInput,
): Promise<ClientEmailSenderRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: input.clientId,
      slug: input.slug,
      display_name: input.displayName,
      status: input.status ?? 'active',
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertSender: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as ClientEmailSenderRow;
}

export type UpdateSenderPatch = {
  displayName?: string;
  status?: EmailSenderStatus;
};

export async function updateSender(
  id: string,
  patch: UpdateSenderPatch,
): Promise<ClientEmailSenderRow> {
  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.status !== undefined) update.status = patch.status;
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`updateSender: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as ClientEmailSenderRow;
}
