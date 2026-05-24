// =============================================================================
// /api/domains/[id] — GET single + DELETE (soft) one row.
// =============================================================================

import { NextResponse } from 'next/server';

import { authoriseDomainAction, unauthorisedResponse } from '../_auth';
import { getDomainById, removeDomain } from '@/lib/domains/manager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const row = await getDomainById(id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const auth = await authoriseDomainAction(request, row.client_id);
  if (!auth.ok) return unauthorisedResponse(auth);
  return NextResponse.json({ row });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const row = await getDomainById(id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const auth = await authoriseDomainAction(request, row.client_id);
  if (!auth.ok) return unauthorisedResponse(auth);
  const outcome = await removeDomain(id);
  if (outcome.kind === 'cannot_remove_only_primary') {
    return NextResponse.json(
      {
        error: 'cannot-remove-only-primary',
        message:
          'This is the only primary domain. Add another domain and set it primary first, or unset primary.',
      },
      { status: 409 },
    );
  }
  if (outcome.kind === 'not_found') {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
