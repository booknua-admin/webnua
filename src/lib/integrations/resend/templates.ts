// =============================================================================
// Resend email — email_templates data access.
//
// Phase 7 Resend session. The send_email job reads templates here; a future
// operator editor (deferred — see CLAUDE.md) will also read + write here.
// email_templates (0062) is not in the generated Database type yet.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { EmailTemplateKey, EmailTemplateRow } from './types';

const TABLE = 'email_templates';
const COLUMNS =
  'id, client_id, template_key, subject, body_html, body_text, ' +
  'is_default, last_edited_at, last_edited_by, created_at';

/** The (client, template) row, or null when none exists — the send_email job
 *  then falls back to DEFAULT_EMAIL_TEMPLATES. */
export async function getTemplate(
  clientId: string,
  key: EmailTemplateKey,
): Promise<EmailTemplateRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .eq('template_key', key)
    .maybeSingle();
  if (error) throw new Error(`getTemplate: ${error.message}`);
  return (data as EmailTemplateRow | null) ?? null;
}

/** Every template row for a client — feeds a future editor's list view. */
export async function listTemplatesForClient(
  clientId: string,
): Promise<EmailTemplateRow[]> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .order('template_key', { ascending: true });
  if (error) throw new Error(`listTemplatesForClient: ${error.message}`);
  return (data as unknown as EmailTemplateRow[] | null) ?? [];
}
