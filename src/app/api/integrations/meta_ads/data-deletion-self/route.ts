// =============================================================================
// POST /api/integrations/meta_ads/data-deletion-self
//
// In-app User Data Deletion — the operator or the customer themselves
// clicks "Disconnect & delete data" on /settings/integrations. Same
// orchestrator as the Meta webhook, but client-or-operator authenticated
// (the user is already signed into Webnua, no signed_request needed).
//
// Returns the same shape as the webhook so the UI can deep-link to the
// status page for confirmation.
// =============================================================================

import { NextResponse } from 'next/server';

import {
  deleteMetaDataForClient,
  logDeletion,
  statusUrlForCode,
} from '@/lib/integrations/meta-ads/data-deletion';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Capture the Meta user id BEFORE the delete so the audit log has it.
  let metaUserId: string | null = null;
  try {
    const db = getIntegrationDb();
    const { data } = await db
      .from('integration_connections')
      .select('provider_account_id')
      .eq('provider', 'meta_ads')
      .eq('client_id', clientId)
      .maybeSingle();
    metaUserId = (data as { provider_account_id?: string } | null)?.provider_account_id ?? null;
  } catch {
    // Non-fatal — the audit row just won't have the user id.
  }

  let deletedResources: string[];
  try {
    deletedResources = await deleteMetaDataForClient(clientId);
  } catch (err) {
    console.error('[meta_ads/data-deletion-self] delete failed', err);
    return NextResponse.json(
      {
        error: 'delete-failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }

  let code: string;
  try {
    code = await logDeletion({
      metaUserId,
      clientIdsCount: 1,
      deletedResources,
      initiatedBy: 'in_app',
      initiatedByUser: auth.userId,
    });
  } catch (err) {
    console.error('[meta_ads/data-deletion-self] audit log failed', err);
    return NextResponse.json({ error: 'audit-log-failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: statusUrlForCode(code),
    confirmation_code: code,
  });
}
