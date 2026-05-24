// =============================================================================
// /api/domains — POST (attach) + GET (list) + DELETE (legacy).
//
// Two body shapes are supported on POST:
//
//   Phase 9 (new):    { client_id: string, domain: string }
//     → create a client_custom_domains row via lib/domains/manager.attachDomain.
//       Operator may attach for any accessible client; client may attach for
//       their own client only.
//
//   Legacy (Phase 6): { domain: string }
//     → operator-only direct Vercel call; the website row's domain_primary is
//       written separately by the caller via lib/website/mutations.setCustomDomain.
//       Kept for back-compat with components/shared/website/ConnectDomainButton.
//
// DELETE accepts the legacy { domain } shape (operator-only direct Vercel
// call); the new soft-delete-by-id path lives at /api/domains/[id].
//
// GET ?client_id=... returns the active (non-removed) domains for one client.
// =============================================================================

import { NextResponse } from 'next/server';

import { attachDomain, getActiveDomainsForClient } from '@/lib/domains/manager';
import {
  authoriseDomainAction,
  unauthorisedResponse,
} from './_auth';
import { getServiceClient } from '@/lib/supabase/server';
import { normalizeDomain } from '@/lib/website/domain';
import { addProjectDomain, removeProjectDomain } from '@/lib/website/vercel';

type LegacyBody = { domain: string };
type Phase9Body = { client_id: string; domain: string };

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPhase9Body(body: Record<string, unknown>): body is Phase9Body {
  return typeof body.client_id === 'string' && typeof body.domain === 'string';
}

function isLegacyBody(body: Record<string, unknown>): body is LegacyBody {
  return typeof body.domain === 'string' && body.client_id === undefined;
}

async function isOperator(request: Request): Promise<{ ok: boolean; userId: string | null }> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, userId: null };
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return { ok: false, userId: null };
  const { data: profile } = await svc
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();
  return { ok: profile?.role === 'admin', userId: data.user.id };
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (!body) {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  if (isPhase9Body(body)) {
    // Defensive: a slug here would cause an FK violation downstream. Surface
    // a clean 400 with the actual bad value rather than the raw PG error.
    if (!UUID_RE.test(body.client_id)) {
      return NextResponse.json(
        {
          error: 'invalid-client-id',
          message: `client_id must be a UUID, got "${body.client_id}".`,
        },
        { status: 400 },
      );
    }
    // Phase 9 — create a client_custom_domains row for `client_id`.
    const auth = await authoriseDomainAction(request, body.client_id);
    if (!auth.ok) return unauthorisedResponse(auth);

    let outcome;
    try {
      outcome = await attachDomain(body.client_id, body.domain, auth.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'attach failed';
      console.error('attachDomain crashed:', err);
      return NextResponse.json(
        { error: 'attach-failed', message },
        { status: 500 },
      );
    }

    switch (outcome.kind) {
      case 'ok':
        return NextResponse.json({ row: outcome.row });
      case 'not_configured':
        return NextResponse.json({
          row: outcome.row,
          notice: 'Vercel is not configured on this deployment — the domain is saved but needs to be added in the Vercel dashboard.',
        });
      case 'invalid_domain':
        return NextResponse.json(
          { error: 'invalid-domain', errors: outcome.errors },
          { status: 400 },
        );
      case 'already_attached':
        return NextResponse.json(
          {
            error: 'already-attached',
            message: outcome.toThisClient
              ? 'This domain is already attached to this client.'
              : 'This domain is already attached to another client.',
            sameClient: outcome.toThisClient,
          },
          { status: 409 },
        );
      case 'vercel_error':
        return NextResponse.json(
          { error: 'vercel-error', code: outcome.error.code, message: outcome.error.message },
          { status: outcome.error.status ?? 502 },
        );
    }
  }

  if (isLegacyBody(body)) {
    // Legacy — operator-only direct Vercel call. Used by ConnectDomainButton
    // on /website (the simple single-domain flow that predates Phase 9).
    const op = await isOperator(request);
    if (!op.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const domain = normalizeDomain(body.domain);
    if (!domain) return NextResponse.json({ error: 'invalid-domain' }, { status: 400 });
    const vercel = await addProjectDomain(domain);
    return NextResponse.json({ domain, vercel });
  }

  return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
}

export async function DELETE(request: Request): Promise<Response> {
  // Legacy direct-Vercel delete by domain string. Operator-only. The new
  // Phase 9 soft-delete-by-id lives at /api/domains/[id].
  const op = await isOperator(request);
  if (!op.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await readJson(request);
  if (!body || typeof body.domain !== 'string') {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const domain = normalizeDomain(body.domain);
  if (!domain) return NextResponse.json({ error: 'invalid-domain' }, { status: 400 });
  const vercel = await removeProjectDomain(domain);
  return NextResponse.json({ domain, vercel });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }
  const auth = await authoriseDomainAction(request, clientId);
  if (!auth.ok) return unauthorisedResponse(auth);
  const rows = await getActiveDomainsForClient(clientId);
  return NextResponse.json({ rows });
}
