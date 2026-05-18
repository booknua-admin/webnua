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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars — set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example).',
  );
}

// Module-singleton — one client instance per browser tab.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
