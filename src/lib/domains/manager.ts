// =============================================================================
// Custom-domain manager — business logic for attach / check / remove / primary.
//
// Phase 9 custom-domain attachment. The single server-side entry point for
// every domain mutation. Vercel calls go through lib/integrations/vercel/
// domains; the row lives in client_custom_domains.
//
// Trust model:
//   • Every function takes a `userId` (who is doing this), captured on
//     `added_by` for an attach and surfaced in the audit trail. Authorisation
//     (operator-can-act-on-client OR client-on-own-client) is the route
//     handler's job — this module is the SOT for the persisted shape.
//   • Vercel-not-configured calls return a typed `{ kind: 'not_configured' }`
//     rather than throwing, so the row can still be created (status stays
//     pending_dns; operator finishes in the Vercel dashboard).
//
// SERVER-ONLY — service-role writes.
// =============================================================================

import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import {
  addDomain as vercelAddDomain,
  getDomain as vercelGetDomain,
  getDomainConfig as vercelGetDomainConfig,
  removeDomain as vercelRemoveDomain,
  type VercelDomainCallError,
  type VercelProjectDomain,
  type VercelVerificationRecord,
} from '@/lib/integrations/vercel/domains';

import { VERCEL_A_RECORD, VERCEL_CNAME_TARGET } from '@/lib/website/domain';

import {
  IN_FLIGHT_STATUSES,
  type CustomDomainRow,
  type CustomDomainStatus,
  type DnsRecordRequirement,
} from './types';
import { isApexDomain, validateDomain } from './validation';

// --- helpers -----------------------------------------------------------------

const TABLE = 'client_custom_domains';

/** The default DNS records Vercel asks for — used when Vercel doesn't return
 *  verification rows (typical for a newly-attached domain that doesn't need
 *  TXT proof). Same shape the legacy `dnsRecordsFor` in lib/website/domain.ts
 *  produces, with TTL hints. */
function defaultDnsRecords(domain: string): DnsRecordRequirement[] {
  const labels = domain.split('.');
  if (isApexDomain(domain)) {
    return [
      { type: 'A', name: '@', value: VERCEL_A_RECORD, ttl: 3600 },
      // Always show the www CNAME alongside so customers can set both — the
      // www variant is a sibling row, but they often want both.
      { type: 'CNAME', name: 'www', value: VERCEL_CNAME_TARGET, ttl: 3600 },
    ];
  }
  // Subdomain — CNAME of just the subdomain label.
  const subName = labels.slice(0, -2).join('.') || 'www';
  return [{ type: 'CNAME', name: subName, value: VERCEL_CNAME_TARGET, ttl: 3600 }];
}

/** Promote Vercel's verification entries (TXT proof, optional) to the same
 *  shape stored on the row. */
function verificationToDns(
  verification: VercelVerificationRecord[] | undefined,
): DnsRecordRequirement[] {
  if (!verification || verification.length === 0) return [];
  return verification.map((v) => ({
    type: v.type,
    name: v.domain,
    value: v.value,
    ttl: 3600,
  }));
}

/** Merge Vercel verification rows + the default A/CNAME pair. The defaults
 *  appear first since they are usually the action item; TXT rows fall below. */
function buildDnsRecords(
  domain: string,
  verification: VercelVerificationRecord[] | undefined,
): DnsRecordRequirement[] {
  return [...defaultDnsRecords(domain), ...verificationToDns(verification)];
}

/** Resolve the live status given Vercel's two views. */
function deriveStatus(opts: {
  verified: boolean;
  misconfigured: boolean;
  previousStatus: CustomDomainStatus;
}): CustomDomainStatus {
  if (opts.verified && !opts.misconfigured) return 'live';
  if (!opts.misconfigured && !opts.verified) return 'ssl_pending';
  if (opts.previousStatus === 'failed') return 'failed';
  // DNS still misconfigured.
  return opts.previousStatus === 'pending_dns' ? 'pending_dns' : 'verifying';
}

// --- result types ------------------------------------------------------------

export type AttachOutcome =
  | { kind: 'ok'; row: CustomDomainRow }
  | { kind: 'invalid_domain'; errors: string[] }
  | { kind: 'already_attached'; toThisClient: boolean }
  | { kind: 'vercel_error'; error: VercelDomainCallError }
  | { kind: 'not_configured'; row: CustomDomainRow };

export type CheckOutcome =
  | { kind: 'ok'; row: CustomDomainRow }
  | { kind: 'not_configured'; row: CustomDomainRow }
  | { kind: 'not_found' }
  | { kind: 'vercel_error'; row: CustomDomainRow; error: VercelDomainCallError };

export type RemoveOutcome =
  | { kind: 'ok' }
  | { kind: 'not_found' }
  | { kind: 'cannot_remove_only_primary' };

// --- attach ------------------------------------------------------------------

/** Attach a domain to a client. Validates → checks uniqueness → calls Vercel
 *  → persists the row with the resulting DNS records + status. */
export async function attachDomain(
  clientId: string,
  rawDomain: string,
  userId: string | null,
): Promise<AttachOutcome> {
  const validation = validateDomain(rawDomain);
  if (!validation.valid) {
    return { kind: 'invalid_domain', errors: validation.errors };
  }
  const domain = validation.normalized;
  const db = getIntegrationDb();

  // Uniqueness — a domain in any non-removed state on ANY client blocks a
  // fresh add. The partial unique index would reject anyway, but a
  // pre-check produces a friendlier error than a 23505 violation.
  const existing = await db
    .from(TABLE)
    .select('*')
    .eq('domain', domain)
    .neq('status', 'removed')
    .maybeSingle();
  const existingRow = existing.data as CustomDomainRow | null;
  if (existingRow) {
    return {
      kind: 'already_attached',
      toThisClient: existingRow.client_id === clientId,
    };
  }

  // Call Vercel.
  const vercel = await vercelAddDomain(domain, clientId);
  if ('configured' in vercel) {
    // Vercel not configured for this deployment — still create the row so
    // the operator can see it + finish in the dashboard. Status stays
    // pending_dns; the polling job will skip it gracefully.
    const inserted = await insertDomainRow(db, {
      clientId,
      domain,
      status: 'pending_dns',
      vercelDomainName: null,
      dnsRecords: defaultDnsRecords(domain),
      addedBy: userId,
    });
    if (!inserted) throw new Error('attachDomain: insert failed');
    return { kind: 'not_configured', row: inserted };
  }

  if (!vercel.ok) {
    return { kind: 'vercel_error', error: vercel.error };
  }

  const projectDomain: VercelProjectDomain = vercel.data;
  const dnsRecords = buildDnsRecords(domain, projectDomain.verification);
  const initialStatus: CustomDomainStatus = projectDomain.verified ? 'ssl_pending' : 'pending_dns';

  const inserted = await insertDomainRow(db, {
    clientId,
    domain,
    status: initialStatus,
    vercelDomainName: projectDomain.name,
    dnsRecords,
    addedBy: userId,
  });
  if (!inserted) throw new Error('attachDomain: insert failed after Vercel add succeeded');
  return { kind: 'ok', row: inserted };
}

async function insertDomainRow(
  db: ReturnType<typeof getIntegrationDb>,
  input: {
    clientId: string;
    domain: string;
    status: CustomDomainStatus;
    vercelDomainName: string | null;
    dnsRecords: DnsRecordRequirement[];
    addedBy: string | null;
  },
): Promise<CustomDomainRow | null> {
  const { data, error } = await db
    .from(TABLE)
    .insert({
      client_id: input.clientId,
      domain: input.domain,
      status: input.status,
      vercel_domain_name: input.vercelDomainName,
      dns_records_required: input.dnsRecords as unknown as Record<string, unknown>[],
      added_by: input.addedBy,
    })
    .select('*')
    .single();
  if (error) throw new Error(`insertDomainRow: ${error.message}`);
  return (data as CustomDomainRow | null) ?? null;
}

// --- status check ------------------------------------------------------------

/** Reconcile a single row against Vercel. Updates status / verified_at /
 *  last_checked_at / last_error in-place. */
export async function checkDomainStatus(domainId: string): Promise<CheckOutcome> {
  const db = getIntegrationDb();
  const { data } = await db.from(TABLE).select('*').eq('id', domainId).maybeSingle();
  const row = data as CustomDomainRow | null;
  if (!row) return { kind: 'not_found' };

  // Skip Vercel calls for already-terminal statuses but still bump
  // last_checked_at so the operator UI shows the recent check.
  if (row.status === 'removed') {
    return { kind: 'ok', row };
  }

  const lookupName = row.vercel_domain_name ?? row.domain;
  const [domainResult, configResult] = await Promise.all([
    vercelGetDomain(lookupName, row.client_id),
    vercelGetDomainConfig(lookupName, row.client_id),
  ]);

  // Both calls degraded to not-configured — Vercel is unset on this deploy.
  if (
    domainResult &&
    'configured' in domainResult &&
    !domainResult.configured &&
    'configured' in configResult &&
    !configResult.configured
  ) {
    const stamped = await stampChecked(db, row.id, { lastError: null });
    return { kind: 'not_configured', row: stamped };
  }

  // Domain not present on the Vercel project — flag as failed.
  if (domainResult === null) {
    const updated = await applyStatus(db, row, {
      status: 'failed',
      verificationFailedReason: 'Domain is no longer attached to the Vercel project.',
    });
    return { kind: 'ok', row: updated };
  }

  // Aggregate Vercel errors — surface the first one.
  if (domainResult && 'ok' in domainResult && domainResult.ok === false) {
    const updated = await stampChecked(db, row.id, { lastError: domainResult.error.message });
    return { kind: 'vercel_error', row: updated, error: domainResult.error };
  }
  if ('ok' in configResult && configResult.ok === false) {
    const updated = await stampChecked(db, row.id, { lastError: configResult.error.message });
    return { kind: 'vercel_error', row: updated, error: configResult.error };
  }

  const verified = 'data' in domainResult && domainResult.ok ? domainResult.data.verified : false;
  const misconfigured =
    'data' in configResult && configResult.ok ? configResult.data.misconfigured : true;
  // Carry over Vercel's per-domain error message if any.
  const vercelDomainError =
    'data' in domainResult && domainResult.ok ? domainResult.data.error?.message : null;

  const nextStatus = deriveStatus({
    verified,
    misconfigured,
    previousStatus: row.status,
  });

  // Re-fetch verification rows from the latest getDomain — Vercel may have
  // refined them between attach and now.
  const refreshedVerification =
    'data' in domainResult && domainResult.ok ? domainResult.data.verification : undefined;
  const refreshedDnsRecords = buildDnsRecords(row.domain, refreshedVerification);

  const updated = await applyStatus(db, row, {
    status: nextStatus,
    verificationFailedReason: vercelDomainError ?? null,
    dnsRecords: refreshedDnsRecords,
  });
  return { kind: 'ok', row: updated };
}

async function applyStatus(
  db: ReturnType<typeof getIntegrationDb>,
  row: CustomDomainRow,
  changes: {
    status: CustomDomainStatus;
    verificationFailedReason?: string | null;
    dnsRecords?: DnsRecordRequirement[];
  },
): Promise<CustomDomainRow> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: changes.status,
    last_checked_at: now,
    last_error: null,
  };
  if (changes.status === 'live' && !row.verified_at) {
    patch.verified_at = now;
  }
  if (changes.status === 'failed') {
    patch.verification_failed_reason = changes.verificationFailedReason ?? row.verification_failed_reason;
  }
  if (changes.dnsRecords) {
    patch.dns_records_required = changes.dnsRecords;
  }
  const { data, error } = await db
    .from(TABLE)
    .update(patch)
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw new Error(`applyStatus: ${error.message}`);

  // Sync the legacy `websites.domain_ssl_status` column so surfaces that
  // still read it (the /website hub indicator when no Phase 9 row is
  // explicitly resolved) self-heal. Maps Phase 9 status to the three-state
  // legacy enum: live → 'live', failed → 'error', everything else → 'pending'.
  await syncLegacyWebsiteSsl(db, row.client_id, row.domain, changes.status);

  return (data as CustomDomainRow) ?? row;
}

/** Phase 9 status → legacy `domain_ssl_status` mirror, applied to whichever
 *  `websites` row carries this client's domain on `domain_primary` (or in the
 *  alias array). Best-effort: a failed update is logged but doesn't undo the
 *  Phase 9 transition. */
async function syncLegacyWebsiteSsl(
  db: ReturnType<typeof getIntegrationDb>,
  clientId: string,
  domain: string,
  status: CustomDomainStatus,
): Promise<void> {
  const legacy: 'live' | 'pending' | 'error' =
    status === 'live' ? 'live' : status === 'failed' ? 'error' : 'pending';

  try {
    // Update by primary first — that's the canonical column.
    const byPrimary = await db
      .from('websites')
      .update({ domain_ssl_status: legacy })
      .eq('client_id', clientId)
      .eq('domain_primary', domain)
      .select('id');
    if (byPrimary.data && byPrimary.data.length > 0) return;
    // Otherwise the domain may be in the aliases array — match on contains.
    await db
      .from('websites')
      .update({ domain_ssl_status: legacy })
      .eq('client_id', clientId)
      .contains('domain_aliases', [domain]);
  } catch (err) {
    console.warn('syncLegacyWebsiteSsl: best-effort update failed', err);
  }
}

async function stampChecked(
  db: ReturnType<typeof getIntegrationDb>,
  id: string,
  changes: { lastError: string | null },
): Promise<CustomDomainRow> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      last_checked_at: new Date().toISOString(),
      last_error: changes.lastError,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`stampChecked: ${error.message}`);
  return data as CustomDomainRow;
}

// --- remove ------------------------------------------------------------------

/** Soft-delete a domain. Calls Vercel removeDomain; on success, marks the
 *  row removed. Refuses to remove the only primary domain (caller must
 *  demote OR add another first). */
export async function removeDomain(domainId: string): Promise<RemoveOutcome> {
  const db = getIntegrationDb();
  const { data } = await db.from(TABLE).select('*').eq('id', domainId).maybeSingle();
  const row = data as CustomDomainRow | null;
  if (!row || row.status === 'removed') return { kind: 'not_found' };

  // If this is the only live domain attached to the client AND it's primary,
  // refuse. (Otherwise the client falls through to {slug}.webnua.dev, which
  // is fine — only the primary-removal-with-no-fallback case is blocked.)
  if (row.is_primary) {
    const { data: siblings } = await db
      .from(TABLE)
      .select('id, is_primary, status')
      .eq('client_id', row.client_id)
      .neq('status', 'removed');
    const otherActive = ((siblings as { id: string; is_primary: boolean; status: string }[]) ?? [])
      .filter((s) => s.id !== row.id);
    if (otherActive.length === 0) {
      return { kind: 'cannot_remove_only_primary' };
    }
  }

  // Call Vercel — failures don't block the soft-delete; we still want the
  // domain off the client's record. Vercel-side cleanup happens via the
  // dashboard if needed.
  await vercelRemoveDomain(row.vercel_domain_name ?? row.domain, row.client_id);

  const now = new Date().toISOString();
  await db
    .from(TABLE)
    .update({
      status: 'removed',
      removed_at: now,
      is_primary: false,
    })
    .eq('id', row.id);

  return { kind: 'ok' };
}

// --- primary ----------------------------------------------------------------

/** Mark a domain as the client's primary, demoting any sibling. */
export async function setPrimaryDomain(domainId: string): Promise<CustomDomainRow | null> {
  const db = getIntegrationDb();
  const { data } = await db.from(TABLE).select('*').eq('id', domainId).maybeSingle();
  const row = data as CustomDomainRow | null;
  if (!row || row.status === 'removed') return null;

  // Demote siblings first.
  await db
    .from(TABLE)
    .update({ is_primary: false })
    .eq('client_id', row.client_id)
    .neq('id', row.id);

  const { data: updated, error } = await db
    .from(TABLE)
    .update({ is_primary: true })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw new Error(`setPrimaryDomain: ${error.message}`);
  return updated as CustomDomainRow;
}

// --- reads -------------------------------------------------------------------

export async function getActiveDomainsForClient(clientId: string): Promise<CustomDomainRow[]> {
  const db = getIntegrationDb();
  const { data } = await db
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'removed')
    .order('is_primary', { ascending: false })
    .order('added_at', { ascending: false });
  return (data as CustomDomainRow[] | null) ?? [];
}

export async function getDomainById(id: string): Promise<CustomDomainRow | null> {
  const db = getIntegrationDb();
  const { data } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  return (data as CustomDomainRow | null) ?? null;
}

/** Resolve the canonical (primary live) domain for a client. Falls back to
 *  null when none exists — the caller renders the {slug}.webnua.dev URL. */
export async function getCanonicalDomainForClient(clientId: string): Promise<string | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from(TABLE)
    .select('domain')
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .eq('status', 'live')
    .maybeSingle();
  return data ? (data as { domain: string }).domain : null;
}

/** Resolve every live domain for a client — used by the middleware to know
 *  which custom domains map back to which client (no DB call per request;
 *  the resolver caches via React `cache()`). */
export async function findClientByDomain(
  domain: string,
): Promise<{ clientId: string; row: CustomDomainRow } | null> {
  const db = getIntegrationDb();
  const { data } = await db
    .from(TABLE)
    .select('*')
    .eq('domain', domain.toLowerCase())
    .neq('status', 'removed')
    .maybeSingle();
  const row = data as CustomDomainRow | null;
  if (!row) return null;
  return { clientId: row.client_id, row };
}

/** Pull the in-flight rows the polling job processes. Batched by env-config
 *  size; default 50. Orders by oldest-checked-first so a freshly-added row
 *  doesn't starve while an old `pending_dns` waits days. */
export async function listInFlightDomains(
  batchSize: number = Number(env.DOMAIN_CHECK_BATCH_SIZE),
): Promise<CustomDomainRow[]> {
  const db = getIntegrationDb();
  const { data } = await db
    .from(TABLE)
    .select('*')
    .in('status', IN_FLIGHT_STATUSES)
    // nullsFirst: a row never checked is first up; then oldest-checked.
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(batchSize);
  return (data as CustomDomainRow[] | null) ?? [];
}
