// =============================================================================
// POST /api/integrations/[provider]/connect — start a per-tenant OAuth flow.
//
// Phase 7 Session 2 + Phase 7 GBP UI consolidation. Auth depends on the
// provider: Google Business Profile is the customer's own listing, so a
// client-role user (or the operator on their behalf) may initiate connect;
// Meta Ads stays operator-only (governance over an ad account is the
// operator's contract decision, not the customer's).
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
import { requireClientAccess, requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';

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

  // GBP is the customer's own listing — allow client-or-operator. Meta
  // Ads stays operator-only (the operator owns the ad-account contract).
  const auth =
    provider === 'google_business_profile'
      ? await requireClientAccess(request, clientId)
      : await requireOperatorForClient(request, clientId);
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
