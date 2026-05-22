// =============================================================================
// Integration tables — hand-written row types + an untyped DB accessor.
//
// The integration tables (integration_call_log, integration_jobs, the three
// client-assignment tables, notifications_outbound) ship their migrations in
// this PR (0047–0053) but are NOT yet in the generated Database type
// (src/lib/types/database.ts regenerates against the live schema post-deploy).
//
// Until then, integration code reaches these tables through an untyped view of
// the service-role client and asserts results against the row types here. When
// the Database type is regenerated, a future session can drop these and use the
// generated types directly.
//
// SERVER-ONLY — this imports the service-role client.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceClient } from '@/lib/supabase/server';
import type {
  IntegrationConnectionStatus,
  OAuthProviderId,
  TokenModel,
} from '@/lib/integrations/connections';

// --- integration_call_log ----------------------------------------------------

export type IntegrationCallDirection = 'outbound' | 'inbound';
export type IntegrationCallErrorClass =
  | 'retryable'
  | 'non_retryable'
  | 'auth_failed'
  | 'rate_limited';

/** The insert shape for a integration_call_log row. */
export type IntegrationCallLogInsert = {
  provider: string;
  operation: string;
  direction: IntegrationCallDirection;
  request_shape: unknown;
  response_status: number | null;
  response_shape: unknown;
  latency_ms: number | null;
  error_class: IntegrationCallErrorClass | null;
  error_message: string | null;
  client_id: string | null;
  correlation_id: string | null;
};

// --- integration_jobs --------------------------------------------------------

export type IntegrationJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** A integration_jobs row as read back from the database. */
export type IntegrationJobRow = {
  id: string;
  created_at: string;
  run_after: string;
  started_at: string | null;
  completed_at: string | null;
  status: IntegrationJobStatus;
  attempts: number;
  max_attempts: number;
  provider: string | null;
  job_type: string;
  payload: unknown;
  result: unknown;
  error_message: string | null;
  error_class: string | null;
  client_id: string | null;
  correlation_id: string | null;
};

/** The insert shape for a new integration_jobs row. */
export type IntegrationJobInsert = {
  job_type: string;
  payload: unknown;
  provider: string | null;
  run_after: string;
  max_attempts: number;
  client_id: string | null;
  correlation_id: string | null;
};

// --- integration_connections (Session 2) -------------------------------------

/** An integration_connections row as read back from the database. */
export type IntegrationConnectionRow = {
  id: string;
  client_id: string;
  provider: OAuthProviderId;
  provider_account_id: string;
  token_secret_id: string | null;
  access_token_cached: string | null;
  access_token_expires_at: string | null;
  token_model: TokenModel;
  scopes: string[];
  status: IntegrationConnectionStatus;
  connected_at: string;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  last_failure_notified_at: string | null;
};

/** The insert shape for a new integration_connections row. */
export type IntegrationConnectionInsert = {
  client_id: string;
  provider: OAuthProviderId;
  provider_account_id: string;
  token_secret_id: string;
  access_token_cached: string | null;
  access_token_expires_at: string | null;
  token_model: TokenModel;
  scopes: string[];
  status?: IntegrationConnectionStatus;
};

// --- accessor ----------------------------------------------------------------

/**
 * The service-role Supabase client, viewed without the generated Database
 * generic so the not-yet-typed integration tables can be addressed by name.
 * Service role bypasses RLS — every integration table is service-role-write,
 * and integration_jobs is service-role-everything.
 */
export function getIntegrationDb(): SupabaseClient {
  return getServiceClient() as unknown as SupabaseClient;
}
