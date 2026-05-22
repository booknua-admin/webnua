'use client';

// =============================================================================
// Twilio SMS — operator UI data layer.
//
// Phase 7 Twilio SMS session. Reads + mutations behind the SMS settings
// surface (the sender provisioning section + the template editors).
//
//   • useClientSmsSender    — the client's client_sms_senders row.
//   • useClientSmsTemplates — the client's sms_templates rows.
//     Both read straight from the browser Supabase client; the tables' RLS
//     scopes them to operators + their accessible clients, so no API route is
//     needed for the reads.
//   • useRegisterSmsSender / useRefreshSmsSender / useSaveSmsTemplate — POST
//     the operator-only API routes (writes go through service-role there).
//
// The three SMS tables are not in the generated Database type yet (their
// migrations ship in this PR), so the browser client is cast to untyped for
// these reads — same pattern as use-billing.ts / use-connections.ts.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import type { SmsTemplateKey } from '@/lib/sms/default-templates';
import { supabase } from '@/lib/supabase/client';

import type { ClientSmsSenderRow, SmsTemplateRow } from './types';

/** The browser client, untyped for the not-yet-generated tables. */
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const senderKey = (clientId: string | null) => ['sms-sender', clientId] as const;
const templatesKey = (clientId: string | null) => ['sms-templates', clientId] as const;

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

async function fetchTemplates(clientId: string): Promise<SmsTemplateRow[]> {
  const { data, error } = await db()
    .from('sms_templates')
    .select(
      'id, client_id, template_key, body, is_default, last_edited_at, last_edited_by, created_at',
    )
    .eq('client_id', clientId);
  if (error) throw normalizeError(error);
  return (data as SmsTemplateRow[] | null) ?? [];
}

/** A client's SMS templates. Disabled (idle) until a client UUID is set. */
export function useClientSmsTemplates(clientId: string | null) {
  return useQuery({
    queryKey: templatesKey(clientId),
    queryFn: () => fetchTemplates(clientId as string),
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

/** Map a route error code to an operator-facing message. */
function smsErrorMessage(code: string | undefined, status: number): string {
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
      return 'Twilio rejected the sender id. Try a different one, or check the Twilio account.';
    case 'too-long':
      return 'The template is over the 320-character limit.';
    case 'empty-body':
      return 'The template body cannot be empty.';
    case 'invalid-templateKey':
      return 'Unknown template.';
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
    throw new Error(smsErrorMessage(json.error as string | undefined, response.status));
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

/** Save an edited SMS template body. */
export function useSaveSmsTemplate(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { templateKey: SmsTemplateKey; body: string }) =>
      postJson('/api/integrations/twilio/templates', {
        clientId,
        templateKey: input.templateKey,
        body: input.body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templatesKey(clientId) });
    },
  });
}
