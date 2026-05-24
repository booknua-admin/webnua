// =============================================================================
// Custom-domain types — Phase 9.
//
// Hand-written until the generated Database type is regenerated against the
// 0081 migration. Mirrors the row shape and the application-side resolved
// values (e.g. relative age, status label).
// =============================================================================

export type CustomDomainStatus =
  | 'pending_dns'
  | 'verifying'
  | 'ssl_pending'
  | 'live'
  | 'failed'
  | 'removed';

/** The DNS records a customer must set at their registrar. Shape mirrors
 *  Vercel's verification records but is decoupled — we store TTL too so the
 *  UI can show a recommendation. */
export type DnsRecordRequirement = {
  type: string;
  name: string;
  value: string;
  ttl?: number;
};

/** A row from client_custom_domains. */
export type CustomDomainRow = {
  id: string;
  client_id: string;
  domain: string;
  status: CustomDomainStatus;
  vercel_domain_name: string | null;
  dns_records_required: DnsRecordRequirement[];
  verification_failed_reason: string | null;
  is_primary: boolean;
  added_at: string;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  added_by: string | null;
  removed_at: string | null;
};

/** Status-string vocabulary that maps to the operator-facing label + a
 *  description sentence the UI surfaces. */
export const STATUS_LABEL: Record<CustomDomainStatus, string> = {
  pending_dns: 'Pending DNS',
  verifying: 'Verifying',
  ssl_pending: 'SSL pending',
  live: 'Live',
  failed: 'Failed',
  removed: 'Removed',
};

export const STATUS_DESCRIPTION: Record<CustomDomainStatus, string> = {
  pending_dns: 'Add the DNS records below at your domain provider.',
  verifying: 'Checking your DNS records — usually takes 5-60 minutes after DNS is set.',
  ssl_pending: 'DNS verified — setting up the secure connection now.',
  live: 'Domain is live and serving your site over HTTPS.',
  failed: 'Verification failed. See details below or book a setup call for help.',
  removed: 'Domain has been removed.',
};

/** Lifecycle status states that the polling job continues to poll. */
export const IN_FLIGHT_STATUSES: CustomDomainStatus[] = [
  'pending_dns',
  'verifying',
  'ssl_pending',
];

/** Statuses where the domain *should* be serving traffic. */
export const SERVING_STATUSES: CustomDomainStatus[] = ['live'];
