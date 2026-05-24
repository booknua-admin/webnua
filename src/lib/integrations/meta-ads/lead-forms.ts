// =============================================================================
// Meta Ads — meta_lead_forms data access.
//
// Phase 7 Meta Ads. Service-role; one row per real Meta lead form.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { MetaLeadFormInsert, MetaLeadFormRow } from './types';

const TABLE = 'meta_lead_forms';

export async function findLeadFormByMetaId(
  metaFormId: string,
): Promise<MetaLeadFormRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('meta_form_id', metaFormId)
    .maybeSingle();
  if (error) throw new Error(`findLeadFormByMetaId failed: ${error.message}`);
  return (data as MetaLeadFormRow | null) ?? null;
}

export async function findLeadFormById(id: string): Promise<MetaLeadFormRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`findLeadFormById failed: ${error.message}`);
  return (data as MetaLeadFormRow | null) ?? null;
}

export async function insertLeadForm(
  insert: MetaLeadFormInsert,
): Promise<MetaLeadFormRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .insert(insert as unknown as never)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`insertLeadForm failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as MetaLeadFormRow;
}

export async function archiveLeadForm(id: string): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .update({ archived_at: new Date().toISOString() } as unknown as never)
    .eq('id', id);
  if (error) throw new Error(`archiveLeadForm failed: ${error.message}`);
}
