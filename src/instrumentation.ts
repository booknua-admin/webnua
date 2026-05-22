// =============================================================================
// Next.js instrumentation — the boot hook.
//
// register() runs once per server runtime at startup (before the first
// request). Importing the env module here forces the zod-validated env check
// to run at boot, so a misconfigured deployment fails loud and immediately
// rather than as an undefined deep inside a request handler.
//
// Guarded to the nodejs runtime: the edge runtime has no need for the
// server-secret schema, and validateEnv() touches process.env keys that only
// resolve in a Node server context.
// =============================================================================

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env');
    validateEnv();
  }
}
