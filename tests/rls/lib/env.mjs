// =============================================================================
// RLS test harness — environment loading.
//
// The harness signs in as real Supabase Auth users and exercises RLS exactly
// as the browser does, so it needs the same connection vars the app uses:
//   NEXT_PUBLIC_SUPABASE_URL        — the project URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY   — the publishable / anon key
// and, optionally:
//   SUPABASE_SERVICE_ROLE_KEY       — enables the service-role-bypass category
//                                     and the ephemeral junior-operator fixture
//   RLS_TEST_PASSWORD               — the shared test-user password
//                                     (default: webnua-dev-2026)
//
// Values are read from the process environment first, then from `.env.local`,
// then `.env` — the same files the Next.js app reads. No dotenv dependency:
// a six-line parser covers the `KEY=VALUE` subset these files use.
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_PASSWORD = 'webnua-dev-2026';

function parseEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadConfig() {
  const root = resolve(process.cwd());
  // Process env wins; then .env.local; then .env. (Same precedence Next uses.)
  const merged = {
    ...parseEnvFile(resolve(root, '.env')),
    ...parseEnvFile(resolve(root, '.env.local')),
    ...process.env,
  };

  const url = merged.NEXT_PUBLIC_SUPABASE_URL || merged.RLS_TEST_SUPABASE_URL;
  const anonKey =
    merged.NEXT_PUBLIC_SUPABASE_ANON_KEY || merged.RLS_TEST_SUPABASE_ANON_KEY;
  const serviceKey = merged.SUPABASE_SERVICE_ROLE_KEY || null;
  const password = merged.RLS_TEST_PASSWORD || DEFAULT_PASSWORD;

  if (!url || !anonKey) {
    throw new Error(
      'RLS harness: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.\n' +
        'Set them in .env.local (the same file the app uses) or in the environment.\n' +
        'See reference/rls-test-suite.md for setup.',
    );
  }

  return { url, anonKey, serviceKey, password };
}
