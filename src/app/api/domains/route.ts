// =============================================================================
// POST / DELETE /api/domains — register or remove a custom domain on the
// Vercel project.
//
// Operator-only: the caller's Supabase access token (Authorization: Bearer)
// is verified server-side and the user's role must be `operator`. The route
// only talks to Vercel — persisting the domain on the website row is done by
// the operator's browser session (lib/website/mutations.ts setCustomDomain),
// where the operator-only `websites` RLS already applies.
//
// The Vercel token is read server-side only (lib/website/vercel.ts) and never
// reaches the browser.
// =============================================================================

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';
import { normalizeDomain } from '@/lib/website/domain';
import { addProjectDomain, removeProjectDomain } from '@/lib/website/vercel';

/** True when the request carries a valid operator's bearer token. */
async function isOperator(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: profile } = await svc.from('users').select('role').eq('id', data.user.id).single();
  // The operator role is stored as `admin` in the users table.
  return profile?.role === 'admin';
}

async function readDomain(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { domain?: unknown };
    return typeof body.domain === 'string' ? normalizeDomain(body.domain) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isOperator(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const domain = await readDomain(request);
  if (!domain) {
    return NextResponse.json({ error: 'invalid-domain' }, { status: 400 });
  }
  const vercel = await addProjectDomain(domain);
  return NextResponse.json({ domain, vercel });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!(await isOperator(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const domain = await readDomain(request);
  if (!domain) {
    return NextResponse.json({ error: 'invalid-domain' }, { status: 400 });
  }
  const vercel = await removeProjectDomain(domain);
  return NextResponse.json({ domain, vercel });
}
