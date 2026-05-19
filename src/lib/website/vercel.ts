// =============================================================================
// Vercel project-domains API — SERVER-ONLY.
//
// Registering a custom domain with the Vercel project is what makes HTTPS
// work: Vercel issues an SSL cert and routes the host to this deployment.
// The middleware + resolver already serve any host once the cert exists.
//
// Reads VERCEL_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID from the server
// env. When those are unset every call returns `{ configured: false }` so the
// connect flow degrades gracefully — the domain is still saved on the website
// row, an operator just adds it in the Vercel dashboard by hand.
//
// This module must only ever be imported by server code (route handlers) —
// the token must never reach the browser.
// =============================================================================

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

function vercelEnv(): VercelEnv | null {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID || undefined };
}

function teamQuery(env: VercelEnv): string {
  return env.teamId ? `?teamId=${encodeURIComponent(env.teamId)}` : '';
}

type VercelDomainBody = {
  verified?: boolean;
  verification?: VercelVerification[];
  error?: { message?: string };
};

async function getProjectDomain(env: VercelEnv, domain: string): Promise<VercelDomainBody | null> {
  try {
    const res = await fetch(
      `${API}/v9/projects/${env.projectId}/domains/${domain}${teamQuery(env)}`,
      { headers: { Authorization: `Bearer ${env.token}` } },
    );
    return res.ok ? ((await res.json()) as VercelDomainBody) : null;
  } catch {
    return null;
  }
}

/** Attach a domain to the Vercel project. Idempotent — a domain already on
 *  the project (409) is treated as success and its current status returned. */
export async function addProjectDomain(domain: string): Promise<VercelDomainResult> {
  const env = vercelEnv();
  if (!env) return { configured: false };
  try {
    const res = await fetch(`${API}/v10/projects/${env.projectId}/domains${teamQuery(env)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });
    const body = (await res.json().catch(() => ({}))) as VercelDomainBody;
    if (!res.ok && res.status !== 409) {
      return {
        configured: true,
        ok: false,
        error: body.error?.message ?? `Vercel responded ${res.status}`,
      };
    }
    // On 409 the POST body is an error — fetch the live record instead.
    const record = res.status === 409 ? await getProjectDomain(env, domain) : body;
    return {
      configured: true,
      ok: true,
      verified: record?.verified ?? false,
      verification: record?.verification ?? [],
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : 'Vercel request failed',
    };
  }
}

/** Detach a domain from the Vercel project. A missing domain (404) is a
 *  no-op success. */
export async function removeProjectDomain(domain: string): Promise<VercelDomainResult> {
  const env = vercelEnv();
  if (!env) return { configured: false };
  try {
    const res = await fetch(
      `${API}/v9/projects/${env.projectId}/domains/${domain}${teamQuery(env)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${env.token}` } },
    );
    if (!res.ok && res.status !== 404) {
      const body = (await res.json().catch(() => ({}))) as VercelDomainBody;
      return {
        configured: true,
        ok: false,
        error: body.error?.message ?? `Vercel responded ${res.status}`,
      };
    }
    return { configured: true, ok: true, verified: false, verification: [] };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : 'Vercel request failed',
    };
  }
}
