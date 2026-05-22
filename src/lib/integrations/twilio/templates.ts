// =============================================================================
// Twilio SMS — sms_templates data access.
//
// Phase 7 Twilio SMS session. Reads + upserts of the per-client SMS templates.
// The seed (migration 0060) gives every client the four defaults; the operator
// editor upserts an edited body through here. sms_templates is not in the
// generated Database type yet, so this reaches it through getIntegrationDb().
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import type { SmsTemplateKey } from '@/lib/sms/default-templates';

import type { SmsTemplateRow } from './types';

const TABLE = 'sms_templates';
const COLUMNS =
  'id, client_id, template_key, body, is_default, last_edited_at, last_edited_by, created_at';

/** Every template row for a client (typically the four seeded keys). */
export async function getTemplatesForClient(clientId: string): Promise<SmsTemplateRow[]> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId);
  if (error) throw new Error(`getTemplatesForClient: ${error.message}`);
  return (data as SmsTemplateRow[] | null) ?? [];
}

/** One template row by (client, key), or null when not seeded. */
export async function getTemplate(
  clientId: string,
  key: SmsTemplateKey,
): Promise<SmsTemplateRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .eq('template_key', key)
    .maybeSingle();
  if (error) throw new Error(`getTemplate: ${error.message}`);
  return (data as SmsTemplateRow | null) ?? null;
}

export type UpsertTemplateInput = {
  clientId: string;
  templateKey: SmsTemplateKey;
  body: string;
  /** The operator making the edit — recorded as last_edited_by. */
  editedBy: string;
};

/**
 * Save an operator-edited template body. Upsert keyed on (client_id,
 * template_key) — the seed row exists, so this is normally an update; the
 * onConflict makes it resilient to a missing seed. Sets is_default false (the
 * body is now operator-authored).
 */
export async function upsertTemplate(input: UpsertTemplateInput): Promise<SmsTemplateRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .upsert(
      {
        client_id: input.clientId,
        template_key: input.templateKey,
        body: input.body,
        is_default: false,
        last_edited_at: new Date().toISOString(),
        last_edited_by: input.editedBy,
      },
      { onConflict: 'client_id,template_key' },
    )
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`upsertTemplate: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as SmsTemplateRow;
}
