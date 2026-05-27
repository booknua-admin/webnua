// =============================================================================
// GET /api/integrations/twilio/health — Twilio credentials health check.
//
// Operator-only. Hits a cheap Twilio endpoint (the Account fetch) to verify
// TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are valid BEFORE the operator burns
// a real sender-registration attempt. Surfaces a typed problem code so the
// operator UI can render a precise diagnostic ("credentials invalid" vs
// "Messaging Service unset" vs "service unavailable").
//
// Why this exists: the registration failure investigated in PR A traced back
// to invalid TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in production env. The
// operator saw "Authenticate" (Twilio's bare 20003 message) with no context.
// This route exists so credential mistakes surface at "Test connection" time,
// not at "Submit sender" time.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { isTwilioConfigured } from '@/lib/integrations/twilio/client';

/** Agency-level operator check — verifies the bearer token resolves to an
 *  admin-role user. Distinct from `requireOperatorForClient` (which also
 *  scopes to one accessible client); this route is workspace-wide. */
async function requireAgencyOperator(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };
  const svc = getIntegrationDb();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, status: 401, error: 'unauthenticated' };
  const userId = userData.user.id;
  const { data: profile } = await svc
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, userId };
}

type HealthProblem =
  | 'env_missing'
  | 'auth_failed'
  | 'messaging_service_missing'
  | 'messaging_service_invalid'
  | 'service_unavailable';

type HealthResponse =
  | { ok: true; accountFriendlyName: string | null; accountStatus: string | null }
  | { ok: false; problem: HealthProblem; detail: string };

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAgencyOperator(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isTwilioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'env_missing',
        detail:
          'TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN are not set in the deployment environment.',
      } satisfies HealthResponse,
      { status: 200 },
    );
  }

  const accountSid = env.TWILIO_ACCOUNT_SID!;
  const authToken = env.TWILIO_AUTH_TOKEN!;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

  // Account fetch is the cheapest authenticated endpoint Twilio exposes.
  const accountResult = await callExternal<{
    sid?: string;
    friendly_name?: string;
    status?: string;
  }>({
    provider: 'twilio',
    operation: 'health_check_account',
    method: 'GET',
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
    headers: { Authorization: authHeader },
    clientId: null,
    // No retry — a health check that retries hides credential failures.
    retry: { maxAttempts: 1 },
  });

  if (!accountResult.ok) {
    const error = accountResult.error;
    const status = error.status;
    if (status === 401 || error.class === 'auth_failed') {
      return NextResponse.json(
        {
          ok: false,
          problem: 'auth_failed',
          detail:
            'Twilio rejected the credentials. TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN are invalid for this Twilio account.',
        } satisfies HealthResponse,
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        problem: 'service_unavailable',
        detail: `Twilio account fetch failed: ${error.message}`,
      } satisfies HealthResponse,
      { status: 200 },
    );
  }

  // Verify the Messaging Service is set + accessible.
  const serviceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!serviceSid) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'messaging_service_missing',
        detail:
          'TWILIO_MESSAGING_SERVICE_SID is not set. Alphanumeric sender registration writes to a Messaging Service AlphaSender pool; the SID is required.',
      } satisfies HealthResponse,
      { status: 200 },
    );
  }

  const serviceResult = await callExternal<{ sid?: string }>({
    provider: 'twilio',
    operation: 'health_check_messaging_service',
    method: 'GET',
    url: `https://messaging.twilio.com/v1/Services/${encodeURIComponent(serviceSid)}`,
    headers: { Authorization: authHeader },
    clientId: null,
    retry: { maxAttempts: 1 },
  });

  if (!serviceResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'messaging_service_invalid',
        detail: `The Messaging Service SID does not resolve on this Twilio account: ${serviceResult.error.message}`,
      } satisfies HealthResponse,
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      accountFriendlyName: accountResult.data.friendly_name ?? null,
      accountStatus: accountResult.data.status ?? null,
    } satisfies HealthResponse,
    { status: 200 },
  );
}
