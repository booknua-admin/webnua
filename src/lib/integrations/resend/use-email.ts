'use client';

// =============================================================================
// Resend email — operator UI data layer.
//
// Phase 7 Resend session. Reads + mutations behind:
//   • /settings/email — the email-sender provisioning panel.
//   • /settings/notifications — operator notification recipients (sub-account
//     mode).
//   • The inbox reply composer (useReplyToLead lives in lib/leads/queries
//     since it's tied to the leads conversation, not the integration).
//
// client_email_senders + notification_preferences are not in the generated
// Database type yet — the browser client is cast to untyped for these reads,
// same pattern as use-sms.ts.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type {
  ClientEmailSenderRow,
  DigestFrequency,
  NotificationPreferenceRow,
} from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const senderKey = (clientId: string | null) => ['email-sender', clientId] as const;
const prefsKey = (clientId: string | null) =>
  ['notification-preferences', clientId] as const;

// --- reads -------------------------------------------------------------------

async function fetchSender(clientId: string): Promise<ClientEmailSenderRow | null> {
  const { data, error } = await db()
    .from('client_email_senders')
    .select('id, client_id, slug, display_name, status, custom_domain, created_at')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw normalizeError(error);
  return (data as ClientEmailSenderRow | null) ?? null;
}

export function useClientEmailSender(clientId: string | null) {
  return useQuery({
    queryKey: senderKey(clientId),
    queryFn: () => fetchSender(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function fetchPreferences(clientId: string): Promise<NotificationPreferenceRow[]> {
  const { data, error } = await db()
    .from('notification_preferences')
    .select(
      'id, client_id, operator_email, notify_on_new_lead, ' +
        'notify_on_payment_failure, notify_on_review_received, ' +
        'digest_frequency, created_at, updated_at',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as unknown as NotificationPreferenceRow[] | null) ?? [];
}

export function useNotificationPreferences(clientId: string | null) {
  return useQuery({
    queryKey: prefsKey(clientId),
    queryFn: () => fetchPreferences(clientId as string),
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

function errorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'resend-not-configured':
      return 'Email sending is not configured — add the Resend credentials to the deployment.';
    case 'invalid-slug':
      return 'Slug must be 1–30 characters: lowercase letters, digits, or hyphens.';
    case 'missing-slug':
      return 'Enter a slug for the sending address.';
    case 'slug-taken':
      return 'That slug is already in use by another client.';
    case 'sender-exists':
      return 'This client already has an email sender assigned.';
    case 'no-sender':
      return 'No email sender has been provisioned for this client yet.';
    case 'invalid-email':
      return 'Enter a valid email address.';
    case 'missing-email':
      return 'Enter the recipient email address.';
    case 'preference-exists':
      return 'A preference for that recipient already exists. Edit it instead.';
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
    throw new Error(errorMessage(json.error as string | undefined, response.status));
  }
  return json;
}

// ---- email sender mutations ----

export function useRegisterEmailSender(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; displayName: string }) =>
      postJson('/api/integrations/resend/sender', {
        clientId,
        action: 'register',
        slug: input.slug,
        displayName: input.displayName,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: senderKey(clientId) });
    },
  });
}

export function useUpdateEmailSender(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName?: string; status?: 'active' | 'suspended' }) =>
      postJson('/api/integrations/resend/sender', {
        clientId,
        action: 'update',
        displayName: input.displayName,
        status: input.status,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: senderKey(clientId) });
    },
  });
}

// ---- notification preferences mutations ----

export type CreatePreferenceInput = {
  operatorEmail: string;
  notifyOnNewLead: boolean;
  notifyOnPaymentFailure: boolean;
  notifyOnReviewReceived: boolean;
  digestFrequency: DigestFrequency;
};

export function useCreateNotificationPreference(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePreferenceInput) =>
      postJson('/api/integrations/resend/preferences', {
        clientId,
        action: 'create',
        ...input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: prefsKey(clientId) });
    },
  });
}

export type UpdatePreferenceInput = {
  preferenceId: string;
  notifyOnNewLead?: boolean;
  notifyOnPaymentFailure?: boolean;
  notifyOnReviewReceived?: boolean;
  digestFrequency?: DigestFrequency;
};

export function useUpdateNotificationPreference(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferenceInput) =>
      postJson('/api/integrations/resend/preferences', {
        clientId,
        action: 'update',
        ...input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: prefsKey(clientId) });
    },
  });
}

export function useDeleteNotificationPreference(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferenceId: string) =>
      postJson('/api/integrations/resend/preferences', {
        clientId,
        action: 'delete',
        preferenceId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: prefsKey(clientId) });
    },
  });
}

export function useTestNotification(clientId: string | null) {
  return useMutation({
    mutationFn: (recipientEmail: string) =>
      postJson('/api/integrations/resend/test-notification', {
        clientId,
        recipientEmail,
      }),
  });
}
