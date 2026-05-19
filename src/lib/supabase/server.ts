// =============================================================================
// Supabase server client — service-role, server-only.
//
// The public-site renderer (app/published/*) must read published website /
// funnel content for visitors who are NOT signed in. The builder tables are
// RLS-scoped to `authenticated` + the caller's accessible clients, so the
// anon browser client cannot read them — and granting `anon` table access is
// forbidden (it would defeat every RLS policy).
//
// Instead the renderer reads with the service-role key, server-side only.
// Service role BYPASSES RLS, so the "published only" filtering is done in
// application code (see lib/public-site/resolve.ts). The key is read from a
// non-NEXT_PUBLIC_ env var and never reaches the browser — this module must
// only ever be imported by server code (route handlers / server components /
// middleware).
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/types/database';

let cached: SupabaseClient<Database> | null = null;

/** The service-role Supabase client. Throws if the env vars are unset — it is
 *  only ever called at request time, so this never aborts the build. */
export function getServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'getServiceClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        'must both be set for the public-site renderer to read published content.',
    );
  }
  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
