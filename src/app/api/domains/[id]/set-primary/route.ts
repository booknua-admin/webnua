// =============================================================================
// /api/domains/[id]/set-primary — mark a domain as the client's primary.
//
// Demotes siblings via lib/domains/manager.setPrimaryDomain. Operator or
// own-client. The primary domain drives the 301-from-{slug}.webnua.dev
// redirect in lib/public-site/resolve.ts.
// =============================================================================

import { NextResponse } from 'next/server';

import { authoriseDomainAction, unauthorisedResponse } from '../../_auth';
import { getDomainById, setPrimaryDomain } from '@/lib/domains/manager';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const row = await getDomainById(id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const auth = await authoriseDomainAction(request, row.client_id);
  if (!auth.ok) return unauthorisedResponse(auth);
  const updated = await setPrimaryDomain(id);
  if (!updated) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ row: updated });
}
