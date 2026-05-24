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

/** Ingest a lead form discovered during `meta_sync_campaigns`. Idempotent
 *  on `meta_form_id` — re-runs refresh the cached name + page id +
 *  question array without inserting duplicates.
 *
 *  V1 doesn't model archival from Meta's side (Meta's `status` field can
 *  return 'ARCHIVED' / 'DELETED' / 'DRAFT'); we treat all observed forms
 *  as active. A future cleanup can sweep forms that haven't been
 *  re-confirmed in a while and set `archived_at`. */
export async function upsertLeadFormFromMeta(args: {
  clientId: string;
  metaFormId: string;
  formName: string;
  metaPageId: string | null;
  fields: unknown;
}): Promise<{ row: MetaLeadFormRow; inserted: boolean }> {
  const existing = await findLeadFormByMetaId(args.metaFormId);
  if (existing) {
    const db = getIntegrationDb();
    const { data, error } = await db
      .from(TABLE)
      .update({
        form_name: args.formName,
        meta_page_id: args.metaPageId,
        fields: args.fields,
        archived_at: null,
      } as unknown as never)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(
        `upsertLeadFormFromMeta update failed: ${error?.message ?? 'no row'}`,
      );
    }
    return { row: data as MetaLeadFormRow, inserted: false };
  }
  const row = await insertLeadForm({
    client_id: args.clientId,
    meta_form_id: args.metaFormId,
    meta_page_id: args.metaPageId,
    form_name: args.formName,
    fields: args.fields,
    archived_at: null,
  });
  return { row, inserted: true };
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
