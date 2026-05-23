'use client';

// =============================================================================
// Twilio SMS — operator UI data layer.
//
// Phase 7 Twilio SMS session. Reads + mutations behind the sender provisioning
// section on /settings/sms.
//
//   • useClientSmsSender   — the client's client_sms_senders row. Read straight
//     from the browser Supabase client; the table's RLS scopes it to operators
//     + their accessible clients, so no API route is needed for the read.
//   • useRegisterSmsSender / useRefreshSmsSender — POST the operator-only API
//     routes (writes go through service-role there).
//
// Template editing lives with the Automations feature (deferred until that
// feature is fully built); the per-client SMS templates are still seeded by
// migration 0060 so the send_sms job has a body to render, but there is no
// editor UI here.
//
// client_sms_senders is not in the generated Database type yet, so the browser
// client is cast to untyped for this read — same pattern as use-billing.ts /
// use-connections.ts.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { ClientSmsSenderRow } from './types';

/** The browser client, untyped for the not-yet-generated table. */
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const senderKey = (clientId: string | null) => ['sms-sender', clientId] as const;

// --- reads -------------------------------------------------------------------

async function fetchSender(clientId: string): Promise<ClientSmsSenderRow | null> {
  const { data, error } = await db()
    .from('client_sms_senders')
    .select('id, client_id, sender_id, registered_at, status, notes, twilio_registration_sid')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw normalizeError(error);
  return (data as ClientSmsSenderRow | null) ?? null;
}

/** A client's SMS sender row. Disabled (idle) until a client UUID is set. */
export function useClientSmsSender(clientId: string | null) {
  return useQuery({
    queryKey: senderKey(clientId),
    queryFn: () => fetchSender(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

// --- mutations ---------------------------------------------------------------

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again.');
  return token;
}

/** Map a route error code to an operator-facing message. Passes through the
 *  raw provider `detail` for the Twilio-side failures the operator needs to
 *  see verbatim (e.g. "AlphaSender already exists in this messaging service",
 *  "Alphanumeric Sender ID is not supported in the destination country"). */
function smsErrorMessage(
  code: string | undefined,
  status: number,
  detail?: string,
): string {
  switch (code) {
    case 'twilio-not-configured':
      return 'SMS is not configured yet — add the Twilio credentials to the deployment.';
    case 'invalid-senderId':
      return 'Sender id must be 1–11 letters/digits and contain at least one letter.';
    case 'missing-senderId':
      return 'Enter a sender id.';
    case 'sender-exists':
      return 'This client already has a sender id assigned.';
    case 'no-sender':
      return 'No sender id has been registered for this client yet.';
    case 'twilio-register-failed':
      return detail
        ? `Twilio rejected the sender id — ${detail}`
        : 'Twilio rejected the sender id. Check the Twilio account (alphanumeric senders need live credentials, may already exist in the pool, or may not be enabled for the destination country).';
    case 'forbidden':
    case 'forbidden-client':
      return 'You do not have access to this client.';
    case 'unauthenticated':
      return 'You are signed out — sign in again.';
    default:
      return `Something went wrong (${code ?? status}).`;
  }
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      smsErrorMessage(
        json.error as string | undefined,
        response.status,
        typeof json.detail === 'string' ? json.detail : undefined,
      ),
    );
  }
  return json;
}

/** Register an alphanumeric sender id for the client. */
export function useRegisterSmsSender(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (senderId: string) =>
      postJson('/api/integrations/twilio/sender', { clientId, senderId, action: 'register' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: senderKey(clientId) });
    },
  });
}

/** Poll Twilio for the sender's current status. */
export function useRefreshSmsSender(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/integrations/twilio/sender', { clientId, action: 'refresh' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: senderKey(clientId) });
    },
  });
}
