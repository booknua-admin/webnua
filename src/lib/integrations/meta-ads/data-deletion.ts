// =============================================================================
// Meta Ads — User Data Deletion compliance.
//
// Meta App Review requires every app that uses Facebook Login + sensitive
// permissions to provide a user-initiated deletion path AND a status
// confirmation URL. This module is the SERVER-ONLY orchestrator behind
// both entry points:
//
//   • /api/integrations/meta_ads/data-deletion       — Meta calls when a
//     user removes our app from their Facebook settings (signed_request)
//   • /api/integrations/meta_ads/data-deletion-self  — operator/customer
//     clicks "Disconnect & delete data" on /settings/integrations
//
// What gets deleted (Meta-sourced data only):
//   • meta_ads_insights         — daily per-campaign metrics
//   • meta_lead_forms           — form metadata snapshots
//   • meta_campaigns            — the Meta-side companion row (the
//                                 operator-facing public.campaigns row
//                                 stays — it may carry operator notes /
//                                 ticket references, and reads as "no
//                                 Meta data" the same way a manually-
//                                 created campaign does)
//   • client_meta_ad_accounts   — the ad-account assignment + partner
//                                 status columns
//   • integration_connections   — the OAuth row itself (after Vault
//                                 secret deletion + provider revocation)
//
// What is NOT deleted:
//   • public.campaigns          — operator data, see above
//   • public.leads              — customer submissions, not Meta data
//   • public.lead_events        — same
// =============================================================================

import { createHmac } from 'node:crypto';

import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { revokeConnection } from '@/lib/integrations/_shared/tokens';

// --- types -------------------------------------------------------------------

export type DeletionInitiator = 'meta_webhook' | 'in_app';

export type DeletionResult = {
  /** The opaque confirmation code surfaced on the status page. */
  code: string;
  /** Resource names that were removed — drives the status page summary. */
  deletedResources: string[];
  /** How many client tenants the deletion touched. The webhook path may
   *  process several (a Meta user could be admin of multiple Webnua
   *  clients); the in-app path always processes exactly one. */
  clientIdsCount: number;
};

// --- signed_request verification (webhook path) ------------------------------

export type SignedRequestPayload = {
  algorithm: string;
  expires?: number;
  issued_at?: number;
  user_id: string;
};

/** Verify Meta's signed_request and return the parsed payload, or null
 *  if the signature/algorithm fails. Meta posts signed_request as
 *  `{signature}.{payload}` where both halves are base64url. The
 *  signature is HMAC-SHA256(payload_bytes, app_secret). */
export function verifySignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  const dot = signedRequest.indexOf('.');
  if (dot < 0) return null;
  const sigB64u = signedRequest.slice(0, dot);
  const payloadB64u = signedRequest.slice(dot + 1);

  let payload: SignedRequestPayload;
  try {
    const payloadJson = Buffer.from(b64uToB64(payloadB64u), 'base64').toString('utf8');
    payload = JSON.parse(payloadJson) as SignedRequestPayload;
  } catch {
    return null;
  }
  if (payload.algorithm !== 'HMAC-SHA256') return null;
  if (typeof payload.user_id !== 'string' || payload.user_id.length === 0) return null;

  // Sign the *original base64url string* — NOT the decoded JSON. This is the
  // one part of Meta's spec that catches people; the signature covers the
  // wire-format payload bytes verbatim.
  const expected = createHmac('sha256', appSecret)
    .update(payloadB64u)
    .digest();
  const received = Buffer.from(b64uToB64(sigB64u), 'base64');
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  return payload;
}

function b64uToB64(s: string): string {
  return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// --- client lookup (webhook path) --------------------------------------------

/** Find every Webnua client whose Meta connection was authorised by the
 *  given Facebook user id. Most cases return one row; an operator who
 *  manages multiple Webnua sub-accounts under the same FB login could
 *  return several. */
export async function findClientIdsByMetaUserId(userId: string): Promise<string[]> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('integration_connections')
    .select('client_id')
    .eq('provider', 'meta_ads')
    .eq('provider_account_id', userId);
  if (error) {
    throw new Error(`findClientIdsByMetaUserId failed: ${error.message}`);
  }
  return ((data as { client_id: string }[] | null) ?? []).map((r) => r.client_id);
}

// --- the actual deletion -----------------------------------------------------

/** Delete every Meta-sourced row for one client + revoke the OAuth
 *  connection. Idempotent — running twice on the same client is a
 *  no-op on the second run. Never throws on a missing row; only throws
 *  on an actual DB error so the caller can surface it. */
export async function deleteMetaDataForClient(clientId: string): Promise<string[]> {
  const db = getIntegrationDb();
  const deleted: string[] = [];

  // Order matters only weakly — Meta-side tables have no FKs between
  // each other, so any order works. We go insights → forms →
  // campaigns → ad_account → connection so a partial-failure picture
  // is easier to read in the logs.
  const tablesToWipe = [
    'meta_ads_insights',
    'meta_lead_forms',
    'meta_campaigns',
    'client_meta_ad_accounts',
  ] as const;

  for (const table of tablesToWipe) {
    const { error, count } = await db
      .from(table)
      .delete({ count: 'exact' })
      .eq('client_id', clientId);
    if (error) {
      throw new Error(`deleteMetaDataForClient(${table}) failed: ${error.message}`);
    }
    if ((count ?? 0) > 0) deleted.push(table);
  }

  // Revoke the OAuth connection at Meta (and delete the Vault secret).
  // revokeConnection is idempotent against an already-revoked row.
  try {
    await revokeConnection(clientId, 'meta_ads');
  } catch (err) {
    // Provider-side revoke failure isn't a data-deletion failure — the
    // Vault secret is gone, the row will be deleted next. Log and proceed.
    console.warn(
      '[meta_ads/data-deletion] revokeConnection failed (proceeding):',
      err instanceof Error ? err.message : err,
    );
  }

  // Now actually delete the integration_connections row. revokeConnection
  // only marks it 'revoked' — for data-deletion compliance we remove the
  // metadata too. The Vault secret is already cleared at this point.
  const { error: connError, count: connCount } = await db
    .from('integration_connections')
    .delete({ count: 'exact' })
    .eq('client_id', clientId)
    .eq('provider', 'meta_ads');
  if (connError) {
    throw new Error(`deleteMetaDataForClient(integration_connections) failed: ${connError.message}`);
  }
  if ((connCount ?? 0) > 0) deleted.push('integration_connections');

  return deleted;
}

// --- audit log + result composition ------------------------------------------

/** Write one audit log row per deletion event + return the opaque
 *  confirmation code the status page reads. */
export async function logDeletion(args: {
  metaUserId: string | null;
  clientIdsCount: number;
  deletedResources: string[];
  initiatedBy: DeletionInitiator;
  initiatedByUser?: string | null;
}): Promise<string> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('meta_data_deletion_log')
    .insert({
      meta_user_id: args.metaUserId,
      client_ids_count: args.clientIdsCount,
      deleted_resources: args.deletedResources,
      initiated_by: args.initiatedBy,
      initiated_by_user: args.initiatedByUser ?? null,
    } as never)
    .select('code')
    .single();
  if (error || !data) {
    throw new Error(`logDeletion failed: ${error?.message ?? 'no row returned'}`);
  }
  return (data as { code: string }).code;
}

/** Compose the status-page URL Meta returns to the user in the webhook
 *  response. The base origin resolves the same way the app's
 *  self-addressing does. */
export function statusUrlForCode(code: string): string {
  const base =
    env.APP_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    (env.APP_HOST ? `https://${env.APP_HOST}` : null) ??
    'https://app.webnua.com';
  return `${base.replace(/\/+$/, '')}/data-deletion/${code}`;
}
