// =============================================================================
// POST /api/integrations/[provider]/connect — start a per-tenant OAuth flow.
//
// Phase 7 Session 2 + GBP UI consolidation + Meta client-or-operator flip.
// Auth is client-or-operator for every per-tenant OAuth provider — the
// customer owns the third-party account (their GBP listing, their Meta
// ad account), so they can connect it themselves OR the operator can
// connect on their behalf. Campaign launch + status flips stay operator-
// only (those live on the meta_ads/campaigns route, not here).
//
// Returns JSON { authorizationUrl } — NOT an HTTP redirect. Authenticated by
// the caller's Supabase access token on the Authorization header (the app
// has no cookie-based server auth — same as /api/domains), so it must be
// reached by fetch(), not a browser navigation. A fetch cannot follow a 302
// to accounts.google.com (CORS), so the route hands back the URL and the
// caller's browser navigates to it.
//
// The signed `state` token (oauth.ts) carries the tenant + the initiating
// user across the OAuth round-trip — it is the callback's only proof of
// authenticated context, since a provider redirect arrives with no header.
// =============================================================================

import { NextResponse } from 'next/server';

import { isOAuthProviderId } from '@/lib/integrations/connections';
import { generateAuthorizationUrl, buildRedirectUri, signOAuthState } from '@/lib/integrations/_shared/oauth';
import { isOAuthProviderConfigured } from '@/lib/integrations/_shared/oauth-providers';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: rawProvider } = await params;
  if (!isOAuthProviderId(rawProvider)) {
    return NextResponse.json({ error: 'unknown-provider' }, { status: 404 });
  }
  const provider = rawProvider;

  let clientId: unknown;
  try {
    ({ clientId } = (await request.json()) as { clientId?: unknown });
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  // Every per-tenant OAuth provider is the customer's own third-party
  // account, so the customer may connect it themselves OR the operator
  // may connect on their behalf. (Meta campaign launch + status flips
  // are operator-only — but those live on the meta_ads/campaigns route.)
  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isOAuthProviderConfigured(provider)) {
    // The OAuth app credentials are not set — the flow cannot start.
    return NextResponse.json({ error: 'provider-not-configured' }, { status: 503 });
  }

  try {
    const redirectUri = buildRedirectUri(provider);
    const state = signOAuthState({ provider, clientId, operatorId: auth.userId });
    const authorizationUrl = generateAuthorizationUrl(provider, { redirectUri, state });
    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    console.error('[oauth/connect] could not build authorization URL', error);
    return NextResponse.json({ error: 'oauth-misconfigured' }, { status: 500 });
  }
}
