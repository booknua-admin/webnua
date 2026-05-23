// =============================================================================
// Twilio SMS — sms_templates data access.
//
// Phase 7 Twilio SMS session. Read of the per-client SMS template body the
// send_sms job renders at send time. The seed (migration 0060) gives every
// client the four default bodies; an editor UI for customising them is
// deferred to the Automations feature, so this module only exposes a read.
// sms_templates is not in the generated Database type yet, so this reaches it
// through getIntegrationDb().
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import type { SmsTemplateKey } from '@/lib/sms/default-templates';

import type { SmsTemplateRow } from './types';

const TABLE = 'sms_templates';
const COLUMNS =
  'id, client_id, template_key, body, is_default, last_edited_at, last_edited_by, created_at';

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
