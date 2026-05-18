// =============================================================================
// Supabase browser client — the single typed client for the app.
//
// Phase 2 (real auth). The whole app renders client-side ('use client'
// layouts), so a browser client with the default localStorage-backed session
// persistence is all that is needed; the App Router server-client / middleware
// session-refresh pattern is deliberately deferred until a surface needs
// server-side reads (Phase 3+).
//
// Row access is enforced by RLS, not by hiding the key — the publishable
// (anon) key is safe to ship to the browser.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// NEXT_PUBLIC_* vars are inlined at build time. If they are missing the app
// cannot authenticate — but a module-scope `throw` would also abort the static
// prerender of pages that never touch auth (the build crashes on the first
// prerendered route). Warn loudly and fall back to an inert placeholder so the
// build completes; real auth still requires these to be set — locally in
// `.env.local`, on the host (e.g. Vercel) in the project's env settings.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — ' +
      'Supabase auth will not work until these env vars are set.',
  );
}

// Module-singleton — one client instance per browser tab.
export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
);
