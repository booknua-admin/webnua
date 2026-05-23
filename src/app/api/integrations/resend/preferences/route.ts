// =============================================================================
// POST /api/integrations/resend/preferences — operator notification recipient
// management.
//
// Phase 7 Resend session. Operator-only. Sub-account-mode settings UI uses
// this to add / edit / remove recipients for one client. Body actions:
//
//   action 'create' — add a new (clientId, operator_email) row.
//   action 'update' — update flags / digest frequency by preference id.
//   action 'delete' — remove a preference by id.
//
// All writes are service-role; the operator-auth check guards which client
// the caller may act on.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  deletePreference,
  insertPreference,
  updatePreference,
  type UpdatePreferencePatch,
} from '@/lib/integrations/resend/preferences';
import type { DigestFrequency } from '@/lib/integrations/resend/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asDigestFrequency(value: unknown): DigestFrequency | undefined {
  return value === 'immediate' || value === 'hourly' || value === 'daily'
    ? value
    : undefined;
}

export async function POST(request: Request): Promise<Response> {
  let body: {
    clientId?: unknown;
    action?: unknown;
    operatorEmail?: unknown;
    notifyOnNewLead?: unknown;
    notifyOnPaymentFailure?: unknown;
    notifyOnReviewReceived?: unknown;
    digestFrequency?: unknown;
    preferenceId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  switch (body.action) {
    case 'create': {
      if (typeof body.operatorEmail !== 'string' || !body.operatorEmail.trim()) {
        return NextResponse.json({ error: 'missing-email' }, { status: 400 });
      }
      const operatorEmail = body.operatorEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(operatorEmail)) {
        return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
      }
      try {
        const row = await insertPreference({
          client_id: clientId,
          operator_email: operatorEmail,
          notify_on_new_lead: body.notifyOnNewLead !== false,
          notify_on_payment_failure: body.notifyOnPaymentFailure !== false,
          notify_on_review_received: body.notifyOnReviewReceived !== false,
          digest_frequency: asDigestFrequency(body.digestFrequency) ?? 'immediate',
        });
        return NextResponse.json({ preference: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes('duplicate')) {
          return NextResponse.json({ error: 'preference-exists' }, { status: 409 });
        }
        console.error('[resend/preferences] insert failed', message);
        return NextResponse.json(
          { error: 'preference-insert-failed', detail: message },
          { status: 500 },
        );
      }
    }
    case 'update': {
      if (typeof body.preferenceId !== 'string' || !body.preferenceId) {
        return NextResponse.json({ error: 'missing-preferenceId' }, { status: 400 });
      }
      const patch: UpdatePreferencePatch = {};
      if (typeof body.notifyOnNewLead === 'boolean') {
        patch.notify_on_new_lead = body.notifyOnNewLead;
      }
      if (typeof body.notifyOnPaymentFailure === 'boolean') {
        patch.notify_on_payment_failure = body.notifyOnPaymentFailure;
      }
      if (typeof body.notifyOnReviewReceived === 'boolean') {
        patch.notify_on_review_received = body.notifyOnReviewReceived;
      }
      const frequency = asDigestFrequency(body.digestFrequency);
      if (frequency) patch.digest_frequency = frequency;
      try {
        const row = await updatePreference(body.preferenceId, patch);
        return NextResponse.json({ preference: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[resend/preferences] update failed', message);
        return NextResponse.json(
          { error: 'preference-update-failed', detail: message },
          { status: 500 },
        );
      }
    }
    case 'delete': {
      if (typeof body.preferenceId !== 'string' || !body.preferenceId) {
        return NextResponse.json({ error: 'missing-preferenceId' }, { status: 400 });
      }
      await deletePreference(body.preferenceId);
      return NextResponse.json({ deleted: true });
    }
    default:
      return NextResponse.json({ error: 'invalid-action' }, { status: 400 });
  }
}
