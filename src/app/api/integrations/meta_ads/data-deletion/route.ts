// =============================================================================
// POST /api/integrations/meta_ads/data-deletion
//
// Meta-initiated User Data Deletion webhook. Meta calls this URL (configured
// in the Meta App dashboard) when a user removes our app from their
// Facebook account → Settings & Privacy → Apps and Websites. The body
// is form-encoded with a single `signed_request` field that we HMAC-verify
// using META_APP_SECRET.
//
// Required response shape per Meta spec:
//   { url: <status-page-URL>, confirmation_code: <opaque code> }
//
// The status page must remain valid for at least 90 days; ours lives at
// /data-deletion/[code] and reads the meta_data_deletion_log table.
//
// Auth model: the signed_request IS the auth (HMAC of the FB app secret).
// No bearer / session token — Meta is anonymous from our perspective.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import {
  deleteMetaDataForClient,
  findClientIdsByMetaUserId,
  logDeletion,
  statusUrlForCode,
  verifySignedRequest,
} from '@/lib/integrations/meta-ads/data-deletion';

export async function POST(request: Request): Promise<Response> {
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    // Without the app secret we can't verify the signature — refuse rather
    // than process unauthenticated webhooks. Operator should set META_APP_SECRET.
    return NextResponse.json({ error: 'meta-not-configured' }, { status: 503 });
  }

  // Meta posts application/x-www-form-urlencoded.
  let signedRequest: string | null;
  try {
    const form = await request.formData();
    const raw = form.get('signed_request');
    signedRequest = typeof raw === 'string' ? raw : null;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  if (!signedRequest) {
    return NextResponse.json({ error: 'missing-signed-request' }, { status: 400 });
  }

  const payload = verifySignedRequest(signedRequest, appSecret);
  if (!payload) {
    // Failed signature OR malformed payload — both are 400s with the same
    // message so a bad actor can't distinguish which (would leak info
    // about which inputs we accept).
    return NextResponse.json({ error: 'invalid-signed-request' }, { status: 400 });
  }

  let clientIds: string[];
  try {
    clientIds = await findClientIdsByMetaUserId(payload.user_id);
  } catch (err) {
    console.error('[meta_ads/data-deletion] lookup failed', err);
    return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
  }

  const allResources = new Set<string>();
  for (const clientId of clientIds) {
    try {
      const removed = await deleteMetaDataForClient(clientId);
      removed.forEach((r) => allResources.add(r));
    } catch (err) {
      // Log per-client failures but keep processing other clients — Meta
      // expects a single confirmation per webhook call.
      console.error(
        `[meta_ads/data-deletion] delete failed for client ${clientId}`,
        err,
      );
    }
  }

  // Always log + return a confirmation — even if there was nothing to
  // delete (a Meta user with no Webnua connection). Meta's webhook
  // contract is "confirm you handled the deletion request"; that includes
  // "we had nothing of yours."
  let code: string;
  try {
    code = await logDeletion({
      metaUserId: payload.user_id,
      clientIdsCount: clientIds.length,
      deletedResources: Array.from(allResources),
      initiatedBy: 'meta_webhook',
    });
  } catch (err) {
    console.error('[meta_ads/data-deletion] audit log failed', err);
    return NextResponse.json({ error: 'audit-log-failed' }, { status: 500 });
  }

  return NextResponse.json({
    url: statusUrlForCode(code),
    confirmation_code: code,
  });
}
