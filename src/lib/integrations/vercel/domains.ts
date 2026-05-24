// =============================================================================
// Vercel Domains API — Phase 9 custom-domain attachment.
//
// Five typed wrappers around the Vercel API that the domain manager uses.
// Every call routes through callExternal() (timeout / retry / structured
// logging via integration_call_log). The previous lib/website/vercel.ts adapter
// stays in place for the legacy single-domain `connect-domain` flow on
// `/website`; this module is the per-row-status flow.
//
// Two Vercel surfaces are involved:
//
//   • Project domains: POST/GET/DELETE /v{9,10}/projects/{id}/domains —
//     attach + remove + read the per-project record.
//   • Domain config: GET /v6/domains/{name}/config — Vercel's DNS-side
//     view ("is the A record pointing here?"). Distinct from getDomain's
//     project-side view.
//
// The two views progress independently for an attached domain:
//   1. POST domain → Vercel project records it, verified=false.
//   2. DNS records set at registrar → Vercel detects, getDomainConfig
//      flips misconfigured: true → false.
//   3. Vercel issues an SSL cert (separate timing, ~1-2 min after DNS).
//   4. getDomain returns verified=true once the project side syncs.
//
// SERVER-ONLY — reads the Vercel API token. The token must never reach the
// browser; this module is only imported by route handlers + the job handler.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

import type {
  NotConfigured,
  VercelCallResult,
  VercelDomainCallError,
  VercelDomainConfig,
  VercelDomainErrorCode,
  VercelProjectDomain,
  VercelVerificationRecord,
} from './domains-types';

const API = 'https://api.vercel.com';

type VercelCreds = { token: string; projectId: string; teamId?: string };

function vercelCreds(): VercelCreds | null {
  const token = env.VERCEL_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID };
}

function teamQuery(creds: VercelCreds): string {
  return creds.teamId ? `?teamId=${encodeURIComponent(creds.teamId)}` : '';
}

function authHeaders(creds: VercelCreds): Record<string, string> {
  return { Authorization: `Bearer ${creds.token}` };
}

/** Classify a Vercel error body into a UI-friendly error code. Vercel's
 *  error codes vary between endpoints; this covers the documented set. */
function classifyVercelError(
  status: number | undefined,
  body: unknown,
  message: string,
): VercelDomainCallError {
  const errBody =
    body && typeof body === 'object'
      ? (body as { error?: { code?: string; message?: string } }).error
      : undefined;
  const code = errBody?.code;
  const userMessage = errBody?.message ?? message;

  if (status === 429) {
    return { code: 'rate_limited', message: 'Vercel rate limit hit — try again shortly.', status };
  }
  if (status === 403 || code === 'forbidden') {
    return {
      code: 'forbidden',
      message: 'Vercel rejected the request — check the API token has domain access.',
      status,
    };
  }
  if (
    code === 'domain_already_in_use' ||
    code === 'domain_taken' ||
    code === 'domain_already_in_use_by_another_project'
  ) {
    return {
      code: 'domain_already_in_use',
      message: 'This domain is already attached to another Vercel project.',
      status,
    };
  }
  if (
    code === 'invalid_domain' ||
    code === 'invalid_name' ||
    code === 'invalid_uid' ||
    code === 'domain_invalid'
  ) {
    return { code: 'invalid_domain', message: userMessage || 'Domain is not valid.', status };
  }
  const mappedCode: VercelDomainErrorCode = 'unknown';
  return { code: mappedCode, message: userMessage, status };
}

/** Add a domain to the Vercel project. Idempotent on 409 — a domain already
 *  attached returns its current status, treated as success. */
export async function addDomain(
  domain: string,
  clientId: string | null = null,
): Promise<NotConfigured | VercelCallResult<VercelProjectDomain>> {
  const creds = vercelCreds();
  if (!creds) return { configured: false };

  const result = await callExternal<VercelProjectDomain>({
    provider: 'vercel',
    operation: 'add_project_domain',
    url: `${API}/v10/projects/${creds.projectId}/domains${teamQuery(creds)}`,
    method: 'POST',
    headers: authHeaders(creds),
    body: { name: domain },
    clientId,
  });

  if (result.ok) {
    return {
      ok: true,
      data: {
        name: result.data.name ?? domain,
        verified: result.data.verified ?? false,
        verification: result.data.verification ?? [],
      },
    };
  }
  // 409 = already attached. Vercel returns 409 with the existing record's
  // shape sometimes, but to be safe we re-fetch.
  if (result.error.status === 409) {
    const fetched = await getDomain(domain, clientId);
    if (fetched && 'ok' in fetched && fetched.ok) return fetched;
    return {
      ok: false,
      error: {
        code: 'domain_already_in_use',
        message: 'This domain is already attached to another Vercel project.',
        status: 409,
      },
    };
  }
  return {
    ok: false,
    error: classifyVercelError(result.error.status, result.error.body, result.error.message),
  };
}

/** Read the per-project domain record. Returns null on a 404 (the domain is
 *  not attached). */
export async function getDomain(
  domain: string,
  clientId: string | null = null,
): Promise<NotConfigured | VercelCallResult<VercelProjectDomain> | null> {
  const creds = vercelCreds();
  if (!creds) return { configured: false };

  const result = await callExternal<VercelProjectDomain>({
    provider: 'vercel',
    operation: 'get_project_domain',
    url: `${API}/v9/projects/${creds.projectId}/domains/${encodeURIComponent(domain)}${teamQuery(creds)}`,
    method: 'GET',
    headers: authHeaders(creds),
    clientId,
  });

  if (result.ok) {
    return {
      ok: true,
      data: {
        name: result.data.name ?? domain,
        verified: result.data.verified ?? false,
        verification: result.data.verification ?? [],
        error: result.data.error,
      },
    };
  }
  if (result.error.status === 404) return null;
  return {
    ok: false,
    error: classifyVercelError(result.error.status, result.error.body, result.error.message),
  };
}

/** Read the DNS-side config for a domain. Tells whether the customer's DNS
 *  records are pointing at Vercel correctly — independent of the per-project
 *  verification state. */
export async function getDomainConfig(
  domain: string,
  clientId: string | null = null,
): Promise<NotConfigured | VercelCallResult<VercelDomainConfig>> {
  const creds = vercelCreds();
  if (!creds) return { configured: false };

  const result = await callExternal<VercelDomainConfig>({
    provider: 'vercel',
    operation: 'get_domain_config',
    url: `${API}/v6/domains/${encodeURIComponent(domain)}/config${teamQuery(creds)}`,
    method: 'GET',
    headers: authHeaders(creds),
    clientId,
  });

  if (result.ok) {
    return {
      ok: true,
      data: {
        misconfigured: result.data.misconfigured ?? true,
        configuredBy: result.data.configuredBy ?? null,
      },
    };
  }
  return {
    ok: false,
    error: classifyVercelError(result.error.status, result.error.body, result.error.message),
  };
}

/** Re-trigger Vercel-side verification (idempotent — safe to call any time). */
export async function verifyDomain(
  domain: string,
  clientId: string | null = null,
): Promise<NotConfigured | VercelCallResult<VercelProjectDomain>> {
  const creds = vercelCreds();
  if (!creds) return { configured: false };

  const result = await callExternal<VercelProjectDomain>({
    provider: 'vercel',
    operation: 'verify_project_domain',
    url: `${API}/v9/projects/${creds.projectId}/domains/${encodeURIComponent(domain)}/verify${teamQuery(creds)}`,
    method: 'POST',
    headers: authHeaders(creds),
    clientId,
  });

  if (result.ok) {
    return {
      ok: true,
      data: {
        name: result.data.name ?? domain,
        verified: result.data.verified ?? false,
        verification: result.data.verification ?? [],
      },
    };
  }
  return {
    ok: false,
    error: classifyVercelError(result.error.status, result.error.body, result.error.message),
  };
}

/** Detach a domain. 404 = already gone = success. */
export async function removeDomain(
  domain: string,
  clientId: string | null = null,
): Promise<NotConfigured | VercelCallResult<{ removed: true }>> {
  const creds = vercelCreds();
  if (!creds) return { configured: false };

  const result = await callExternal<unknown>({
    provider: 'vercel',
    operation: 'remove_project_domain',
    url: `${API}/v9/projects/${creds.projectId}/domains/${encodeURIComponent(domain)}${teamQuery(creds)}`,
    method: 'DELETE',
    headers: authHeaders(creds),
    clientId,
  });

  if (result.ok || result.error.status === 404) {
    return { ok: true, data: { removed: true } };
  }
  return {
    ok: false,
    error: classifyVercelError(result.error.status, result.error.body, result.error.message),
  };
}

/** Re-export the shapes consumers need. */
export type {
  NotConfigured,
  VercelCallResult,
  VercelDomainCallError,
  VercelDomainConfig,
  VercelDomainErrorCode,
  VercelProjectDomain,
  VercelVerificationRecord,
};
