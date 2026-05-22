// =============================================================================
// Stripe billing — integration test.
//
// Run with:  npm run test:stripe   (or  node integration-tests/stripe.test.mjs)
//
// A minimal end-to-end check of the Stripe billing integration, written as a
// standalone Node script in the style of the RLS harness (tests/rls/) — the
// repo has no test-runner dependency.
//
// Two layered, independently-gated tests:
//
//   Test A — webhook → database. Builds a Stripe-signed customer.subscription
//     .created event and POSTs it to the running app's webhook route, then
//     verifies client_stripe_customers updated. Also asserts a bad signature
//     is rejected (400). Gated on STRIPE_WEBHOOK_SECRET + APP_BASE_URL (a
//     running app) + SUPABASE_SERVICE_ROLE_KEY (to seed / verify the row).
//
//   Test B — live Stripe API. Creates a TEST-mode customer, opens a checkout
//     session for STRIPE_PRICE_ID_STANDARD, then cleans up. Proves the Stripe
//     account + price are real and the request shapes are accepted. Gated on
//     STRIPE_SECRET_KEY (which MUST be a TEST-mode key — sk_test_…).
//
// Anything not configured is SKIPPED with an instruction, not failed. The
// process exits non-zero only on a real failure.
// =============================================================================

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- env loading (process env, then .env.local, then .env) -------------------

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

const root = resolve(process.cwd());
const ENV = {
  ...parseEnvFile(resolve(root, '.env')),
  ...parseEnvFile(resolve(root, '.env.local')),
  ...process.env,
};

// --- tiny reporter -----------------------------------------------------------

let failed = 0;
let passed = 0;
let skipped = 0;

function pass(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}
function failTest(name, detail) {
  failed += 1;
  console.log(`  FAIL  ${name}\n        ${detail}`);
}
function skip(name, reason) {
  skipped += 1;
  console.log(`  SKIP  ${name}\n        ${reason}`);
}
function assert(condition, name, detail) {
  if (condition) pass(name);
  else failTest(name, detail ?? 'assertion failed');
}

// --- Stripe form encoding (mirrors client.ts) --------------------------------

function encodeForm(value, prefix, pairs) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => encodeForm(item, `${prefix}[${i}]`, pairs));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, pairs);
    }
    return;
  }
  pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
}
function formBody(params) {
  const pairs = [];
  encodeForm(params, '', pairs);
  return pairs.join('&');
}

async function stripeApi(method, path, params, secretKey) {
  const headers = { Authorization: `Bearer ${secretKey}` };
  let body;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = formBody(params ?? {});
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// --- Stripe webhook signing (mirrors webhook-verify.ts) ----------------------

function signWebhook(rawBody, secret, timestamp) {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  return `t=${t},v1=${sig}`;
}

// --- Test A — webhook → database ---------------------------------------------

async function testWebhook() {
  console.log('\nTest A — webhook → database');
  const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;
  const appBaseUrl = ENV.APP_BASE_URL;
  const supabaseUrl = ENV.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = ENV.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !appBaseUrl || !supabaseUrl || !serviceKey) {
    skip(
      'webhook updates client_stripe_customers',
      'set STRIPE_WEBHOOK_SECRET, APP_BASE_URL (a running app), ' +
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run this test.',
    );
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find a client with no existing client_stripe_customers row, so the test
  // never clobbers real billing data.
  const { data: taken } = await db.from('client_stripe_customers').select('client_id');
  const takenIds = new Set((taken ?? []).map((r) => r.client_id));
  const { data: clients } = await db.from('clients').select('id, name');
  const client = (clients ?? []).find((c) => !takenIds.has(c.id));
  if (!client) {
    skip(
      'webhook updates client_stripe_customers',
      'no client without an existing client_stripe_customers row to test against.',
    );
    return;
  }

  const fakeCustomerId = `cus_test_${Math.random().toString(36).slice(2, 12)}`;
  const fakeSubId = `sub_test_${Math.random().toString(36).slice(2, 12)}`;
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  // Seed the mapping row the checkout route would have created.
  await db.from('client_stripe_customers').insert({
    client_id: client.id,
    stripe_customer_id: fakeCustomerId,
    status: 'incomplete',
  });

  try {
    const event = {
      id: `evt_test_${Math.random().toString(36).slice(2, 12)}`,
      type: 'customer.subscription.created',
      data: {
        object: {
          id: fakeSubId,
          customer: fakeCustomerId,
          status: 'active',
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: periodEnd, price: { id: 'price_test' } }] },
        },
      },
    };
    const rawBody = JSON.stringify(event);
    const url = `${appBaseUrl.replace(/\/+$/, '')}/api/integrations/stripe/webhook`;

    // Valid signature → 200 + the row should flip to 'active'.
    const okRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signWebhook(rawBody, webhookSecret),
      },
      body: rawBody,
    });
    assert(okRes.status === 200, 'signed webhook accepted (200)', `got ${okRes.status}`);

    const { data: row } = await db
      .from('client_stripe_customers')
      .select('status, stripe_subscription_id, current_period_end')
      .eq('client_id', client.id)
      .maybeSingle();
    assert(row?.status === 'active', 'row.status → active', `got ${row?.status}`);
    assert(
      row?.stripe_subscription_id === fakeSubId,
      'row.stripe_subscription_id stored',
      `got ${row?.stripe_subscription_id}`,
    );
    assert(row?.current_period_end != null, 'row.current_period_end stored', 'was null');

    // Bad signature → 400.
    const badRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=1,v1=deadbeef',
      },
      body: rawBody,
    });
    assert(badRes.status === 400, 'bad-signature webhook rejected (400)', `got ${badRes.status}`);
  } finally {
    await db.from('client_stripe_customers').delete().eq('client_id', client.id);
  }
}

// --- Test B — live Stripe API ------------------------------------------------

async function testStripeApi() {
  console.log('\nTest B — live Stripe API (TEST mode)');
  const secretKey = ENV.STRIPE_SECRET_KEY;
  if (!secretKey) {
    skip(
      'Stripe customer + checkout session',
      'set STRIPE_SECRET_KEY (a sk_test_… key) to run this test.',
    );
    return;
  }
  if (!secretKey.startsWith('sk_test_')) {
    skip(
      'Stripe customer + checkout session',
      'STRIPE_SECRET_KEY is not a TEST-mode key (sk_test_…) — refusing to run live-mode API calls.',
    );
    return;
  }

  let customerId = null;
  try {
    const created = await stripeApi(
      'POST',
      '/customers',
      {
        email: 'webnua-stripe-test@example.com',
        name: 'Webnua Test',
        metadata: { client_id: 'integration-test' },
      },
      secretKey,
    );
    assert(
      created.status === 200 && !!created.json.id,
      'create customer',
      JSON.stringify(created.json).slice(0, 200),
    );
    customerId = created.json.id;
    if (!customerId) return;

    const priceId = ENV.STRIPE_PRICE_ID_STANDARD;
    if (!priceId) {
      skip(
        'create checkout session',
        'set STRIPE_PRICE_ID_STANDARD (a test-mode Price id) to run this test.',
      );
    } else {
      const session = await stripeApi(
        'POST',
        '/checkout/sessions',
        {
          mode: 'subscription',
          customer: customerId,
          success_url: 'https://example.com/ok',
          cancel_url: 'https://example.com/cancel',
          line_items: [{ price: priceId, quantity: 1 }],
        },
        secretKey,
      );
      assert(
        session.status === 200 && !!session.json.url,
        'create checkout session for the standard price',
        JSON.stringify(session.json).slice(0, 300),
      );
    }

    const fetched = await stripeApi('GET', `/customers/${customerId}`, undefined, secretKey);
    assert(fetched.status === 200, 'retrieve customer', `got ${fetched.status}`);
  } finally {
    if (customerId) {
      await stripeApi('DELETE', `/customers/${customerId}`, undefined, secretKey).catch(() => {});
    }
  }
}

// --- run ---------------------------------------------------------------------

async function main() {
  console.log('Stripe billing — integration test');
  try {
    await testWebhook();
  } catch (error) {
    failTest('Test A — webhook', error instanceof Error ? error.message : String(error));
  }
  try {
    await testStripeApi();
  } catch (error) {
    failTest('Test B — Stripe API', error instanceof Error ? error.message : String(error));
  }

  console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
