// =============================================================================
// /api/domains/[id]/check — manually trigger a verification check.
//
// Same body as the polling job's per-row processing — calls Vercel
// getDomain + getDomainConfig and updates the row's status / DNS records /
// last_checked_at. Returns the updated row so the UI can refresh without a
// follow-up GET.
// =============================================================================

import { NextResponse } from 'next/server';

import { authoriseDomainAction, unauthorisedResponse } from '../../_auth';
import { checkDomainStatus, getDomainById } from '@/lib/domains/manager';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const row = await getDomainById(id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const auth = await authoriseDomainAction(request, row.client_id);
  if (!auth.ok) return unauthorisedResponse(auth);
  const outcome = await checkDomainStatus(id);
  if (outcome.kind === 'not_found') {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  if (outcome.kind === 'not_configured') {
    return NextResponse.json({
      row: outcome.row,
      notice: 'Vercel is not configured on this deployment.',
    });
  }
  if (outcome.kind === 'vercel_error') {
    return NextResponse.json(
      {
        row: outcome.row,
        error: 'vercel-error',
        code: outcome.error.code,
        message: outcome.error.message,
      },
      { status: outcome.error.status ?? 502 },
    );
  }
  return NextResponse.json({ row: outcome.row });
}
