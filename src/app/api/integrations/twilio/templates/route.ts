// =============================================================================
// POST /api/integrations/twilio/templates — save a client's SMS template.
//
// Phase 7 Twilio SMS session. Operator-only. The operator edits a template
// body in the SMS template editor and saves; this route upserts the
// sms_templates row (service-role write — sms_templates is service-role-write,
// the editor never touches it directly).
//
// The 320-character limit (2 GSM-7 segments) is re-checked here — the editor
// blocks the save, but the route is the boundary that must enforce it.
//
// Reached by fetch() with the operator's Supabase access token on the
// Authorization header.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { upsertTemplate } from '@/lib/integrations/twilio/templates';
import { isSmsTemplateKey, MAX_TEMPLATE_LENGTH } from '@/lib/sms/default-templates';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; templateKey?: unknown; body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }
  if (!isSmsTemplateKey(body.templateKey)) {
    return NextResponse.json({ error: 'invalid-templateKey' }, { status: 400 });
  }
  if (typeof body.body !== 'string') {
    return NextResponse.json({ error: 'missing-body' }, { status: 400 });
  }

  const templateBody = body.body;
  if (templateBody.trim().length === 0) {
    return NextResponse.json({ error: 'empty-body' }, { status: 400 });
  }
  // The hard limit is on visible characters (code points), matching the
  // editor's count.
  if ([...templateBody].length > MAX_TEMPLATE_LENGTH) {
    return NextResponse.json(
      { error: 'too-long', detail: `Templates cannot exceed ${MAX_TEMPLATE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const row = await upsertTemplate({
    clientId,
    templateKey: body.templateKey,
    body: templateBody,
    editedBy: auth.userId,
  });
  return NextResponse.json({ template: row });
}
