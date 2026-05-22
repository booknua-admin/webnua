// =============================================================================
// GET /api/integrations/stripe/plan-info — the live plan details.
//
// Phase 7 Stripe billing follow-up. The browser bridge to getPlanInfo() (which
// is server-only — it reads STRIPE_SECRET_KEY). Returns the plan's name, price,
// currency and interval resolved live from the Stripe Price object, so the UI
// never hardcodes them.
//
// No auth: plan pricing is public information — it is shown to anyone at Stripe
// Checkout — and the response carries only non-sensitive plan display data.
// Cache-Control mirrors the 5-minute server-side cache window.
// =============================================================================

import { NextResponse } from 'next/server';

import { getPlanInfo } from '@/lib/integrations/stripe/plan-info';

export async function GET(): Promise<Response> {
  const info = await getPlanInfo();
  if (!info) {
    // Stripe unconfigured or unreachable — the UI shows an error state rather
    // than a (possibly wrong) hardcoded price.
    return NextResponse.json({ error: 'plan-info-unavailable' }, { status: 503 });
  }
  return NextResponse.json(info, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
