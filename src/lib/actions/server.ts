// =============================================================================
// Suggested actions — server-side write helpers.
//
// SERVER-ONLY (service-role client). Job handlers + routes create actions
// through `createSuggestedAction`; the dedupe contract (one OPEN action per
// dedupe_key per client) is enforced here by expiring the stale pending row
// before insert — a fresh draft replaces the old one instead of stacking.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  SuggestedActionKind,
  SuggestedActionRow,
  SuggestedActionUrgency,
} from './types';

export type CreateSuggestedActionInput = {
  clientId: string;
  kind: SuggestedActionKind;
  title: string;
  body?: string;
  explanation?: string;
  payload?: Record<string, unknown>;
  sourceEntityType?: string;
  sourceEntityId?: string;
  /** One open action per (client, dedupe_key); a new draft replaces the old. */
  dedupeKey?: string;
  urgency?: SuggestedActionUrgency;
  /** Actions go stale — default 7 days; pass null for no expiry. */
  expiresInHours?: number | null;
};

const DEFAULT_EXPIRY_HOURS = 24 * 7;

/** Insert a suggested action, replacing any open action with the same
 *  dedupe key. Returns the new row id. */
export async function createSuggestedAction(
  input: CreateSuggestedActionInput,
): Promise<string> {
  const db = getIntegrationDb();

  if (input.dedupeKey) {
    // Expire the previous open draft for this dedupe key — the new analysis
    // supersedes it. (The partial unique index would otherwise reject the
    // insert.)
    await db
      .from('suggested_actions')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .eq('client_id', input.clientId)
      .eq('dedupe_key', input.dedupeKey)
      .eq('status', 'pending');
  }

  const expiresInHours =
    input.expiresInHours === undefined ? DEFAULT_EXPIRY_HOURS : input.expiresInHours;

  const { data, error } = await db
    .from('suggested_actions')
    .insert({
      client_id: input.clientId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? '',
      explanation: input.explanation ?? '',
      payload: input.payload ?? {},
      source_entity_type: input.sourceEntityType ?? null,
      source_entity_id: input.sourceEntityId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      urgency: input.urgency ?? 'normal',
      expires_at:
        expiresInHours === null
          ? null
          : new Date(Date.now() + expiresInHours * 3_600_000).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`createSuggestedAction: insert failed — ${error?.message ?? 'no row'}`);
  }
  return (data as { id: string }).id;
}

/** Load one action by id (service-role — callers must auth separately). */
export async function findSuggestedAction(
  id: string,
): Promise<SuggestedActionRow | null> {
  const { data, error } = await getIntegrationDb()
    .from('suggested_actions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`findSuggestedAction: ${error.message}`);
  return (data as SuggestedActionRow | null) ?? null;
}

/** Flip an action to a terminal status with attribution + the dispatch result. */
export async function resolveSuggestedAction(
  id: string,
  status: 'approved' | 'dismissed' | 'expired',
  resolvedBy: string | null,
  resolution: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await getIntegrationDb()
    .from('suggested_actions')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution,
    })
    .eq('id', id);
  if (error) throw new Error(`resolveSuggestedAction: ${error.message}`);
}
