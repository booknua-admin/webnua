// =============================================================================
// Vercel project-domains API — SERVER-ONLY.
//
// Registering a custom domain with the Vercel project is what makes HTTPS
// work: Vercel issues an SSL cert and routes the host to this deployment.
// The middleware + resolver already serve any host once the cert exists.
//
// Phase 7 Session 1: refactored to route every call through callExternal()
// (src/lib/integrations/_shared/call.ts) — the shared integration wrapper that
// adds timeout, 5xx/network retry, error classification, and integration_call_log
// logging. This module is the first validation of that foundation against a
// real integration. Vercel calls are platform-level (Webnua's own account, no
// tenant) so they are logged with client_id NULL.
//
// Credentials are read through the typed env module (src/lib/env.ts). When
// VERCEL_TOKEN / VERCEL_PROJECT_ID are unset every call returns
// `{ configured: false }` so the connect flow degrades gracefully — the domain
// is still saved on the website row, an operator just adds it in the Vercel
// dashboard by hand.
//
// This module must only ever be imported by server code (route handlers) —
// the token must never reach the browser.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationError } from '@/lib/integrations/_shared/call';

const API = 'https://api.vercel.com';

type VercelEnv = { token: string; projectId: string; teamId?: string };

/** A DNS verification record Vercel asks for when a domain needs proving. */
export type VercelVerification = {
  type: string;
  domain: string;
  value: string;
};

export type VercelDomainResult =
  | { configured: false }
  | {
      configured: true;
      ok: true;
      /** Vercel considers the domain verified / attached. */
      verified: boolean;
      verification: VercelVerification[];
    }
  | { configured: true; ok: false; error: string };

/** The slice of a Vercel domain response this module reads. */
type VercelDomainBody = {
  verified?: boolean;
  verification?: VercelVerification[];
  error?: { message?: string };
};

function vercelEnv(): VercelEnv | null {
  const token = env.VERCEL_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID };
}

function teamQuery(target: VercelEnv): string {
  return target.teamId ? `?teamId=${encodeURIComponent(target.teamId)}` : '';
}

function authHeaders(target: VercelEnv): Record<string, string> {
  return { Authorization: `Bearer ${target.token}` };
}

/** Best-effort human message from a failed Vercel call — prefers the body's
 *  `error.message`, falls back to the classified error message. */
function vercelErrorMessage(error: IntegrationError): string {
  const body = error.body as VercelDomainBody | undefined;
  if (body?.error?.message) return body.error.message;
  if (error.status) return `Vercel responded ${error.status}`;
  return error.message;
}

async function getProjectDomain(
  target: VercelEnv,
  domain: string,
): Promise<VercelDomainBody | null> {
  const result = await callExternal<VercelDomainBody>({
    provider: 'vercel',
    operation: 'get_project_domain',
    url: `${API}/v9/projects/${target.projectId}/domains/${domain}${teamQuery(target)}`,
    method: 'GET',
    headers: authHeaders(target),
  });
  return result.ok ? result.data : null;
}

/** Attach a domain to the Vercel project. Idempotent — a domain already on
 *  the project (409) is treated as success and its current status returned. */
export async function addProjectDomain(domain: string): Promise<VercelDomainResult> {
  const target = vercelEnv();
  if (!target) return { configured: false };

  const result = await callExternal<VercelDomainBody>({
    provider: 'vercel',
    operation: 'add_project_domain',
    url: `${API}/v10/projects/${target.projectId}/domains${teamQuery(target)}`,
    method: 'POST',
    headers: authHeaders(target),
    body: { name: domain },
  });

  if (result.ok) {
    return {
      configured: true,
      ok: true,
      verified: result.data.verified ?? false,
      verification: result.data.verification ?? [],
    };
  }

  // 409 — the domain is already attached to the project. Fetch the live record
  // for its current verification status and treat it as success.
  if (result.error.status === 409) {
    const record = await getProjectDomain(target, domain);
    return {
      configured: true,
      ok: true,
      verified: record?.verified ?? false,
      verification: record?.verification ?? [],
    };
  }

  return { configured: true, ok: false, error: vercelErrorMessage(result.error) };
}

/** Detach a domain from the Vercel project. A missing domain (404) is a
 *  no-op success. */
export async function removeProjectDomain(domain: string): Promise<VercelDomainResult> {
  const target = vercelEnv();
  if (!target) return { configured: false };

  const result = await callExternal<unknown>({
    provider: 'vercel',
    operation: 'remove_project_domain',
    url: `${API}/v9/projects/${target.projectId}/domains/${domain}${teamQuery(target)}`,
    method: 'DELETE',
    headers: authHeaders(target),
  });

  // Success, or a 404 (the domain was not on the project) — both are no-ops.
  if (result.ok || result.error.status === 404) {
    return { configured: true, ok: true, verified: false, verification: [] };
  }

  return { configured: true, ok: false, error: vercelErrorMessage(result.error) };
}
