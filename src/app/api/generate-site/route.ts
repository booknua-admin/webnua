// =============================================================================
// POST /api/generate-site — the real Claude-backed website generator.
//
// Body: a SiteGenerationRequest — a ClientBrief plus an optional clientId
//   so generation_log entries can be attributed to a client row. The id is
//   optional because dev preview surfaces may run without a created client.
// Response: a SiteGenerationResult — the same shape generateSiteSync returns,
//   so the client can swap the stub for this transparently.
//
// The browser reaches this through site-generation-stub.ts's generateSiteStub.
// Fallback policy lives there; the route just returns 503 (key not configured),
// 400 (bad body), or 500 (real failure with { name, status, detail }).
//
// Observability: every fallback field from the §4.4 validation pipeline is
// recorded to public.generation_log via the service-role client. One uuid is
// minted per request and shared across all four page generations, so a whole
// site-generation run is queryable as a single generation_id group.
// =============================================================================

import { NextResponse } from 'next/server';

import { checkAndRecord } from '@/lib/rate-limit';
import { fillFooterSection, fillHeaderSection } from '@/lib/website/generation-stub';
import type { FallbackLogEntry } from '@/lib/website/generation-stub';
import { generatePageLive } from '@/lib/website/generate-live';
import {
  briefToGenerationContext,
  type ClientBrief,
  type SiteGenerationResult,
} from '@/lib/website/site-generation-stub';
import type { PageType } from '@/lib/website/types';
import { getServiceClient } from '@/lib/supabase/server';

// Four parallel Opus calls with adaptive thinking — give the function room.
export const maxDuration = 300;

const SITE_PAGE_TYPES: readonly PageType[] = ['home', 'services', 'about', 'contact'];

type GenerateSiteRequest = ClientBrief & { clientId?: string };

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not an error — the client falls back to the deterministic generator.
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: GenerateSiteRequest;
  try {
    body = (await request.json()) as GenerateSiteRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const { clientId, ...brief } = body;

  // Pattern B per-workspace AI rate limit — 3 site-gens per client per 24h.
  // The check happens AFTER body parsing so a malformed request doesn't
  // consume quota. Limit is only enforced for requests carrying a clientId;
  // the dev preview surface (no clientId) is unmetered.
  if (clientId) {
    const decision = await checkAndRecord('ai_site_gen', { key: clientId, clientId });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: 'rate-limited', detail: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
        { status: 429 },
      );
    }
  }

  // One id per site-generation run; all four per-page calls share it so the
  // generation_log rows are queryable as one group (schema 0011's intent).
  const generationId = crypto.randomUUID();

  try {
    const results = await Promise.all(
      SITE_PAGE_TYPES.map((pageType) =>
        generatePageLive(briefToGenerationContext(brief, pageType), generationId),
      ),
    );
    const chrome = briefToGenerationContext(brief, 'home');
    const result: SiteGenerationResult = {
      generationId,
      pages: results.map((r) => r.page),
      header: fillHeaderSection(chrome),
      footer: fillFooterSection(chrome),
    };

    // Fire-and-forget — observability shouldn't block the response.
    const allFallbacks = results.flatMap((r) => r.fallbackLog);
    if (clientId && allFallbacks.length > 0) {
      void writeGenerationLog(clientId, generationId, allFallbacks);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[generate-site] generation failed', error);
    // Surface the real error so it is visible in the Network tab without
    // digging through host function logs.
    const detail = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;
    return NextResponse.json(
      { error: 'generation-failed', name, status, detail },
      { status: 500 },
    );
  }
}

/** Persist fallback-field entries from the §4.4 validation pipeline to
 *  public.generation_log. Service-role insert because the RLS write policy
 *  requires `is_operator()` + accessible client — both true via the cookie
 *  session that reached the route, but the route handler runs without that
 *  session in scope, so we use service role (the comment in migration 0011
 *  explicitly accommodates this: "real generation runs as service_role,
 *  bypassing RLS"). */
async function writeGenerationLog(
  clientId: string,
  generationId: string,
  fallbacks: FallbackLogEntry[],
): Promise<void> {
  try {
    const supabase = getServiceClient();
    const rows = fallbacks.map((f) => ({
      generation_id: generationId,
      client_id: clientId,
      section_type: f.sectionType,
      field_name: f.fieldName,
      reason: f.reason,
      model_value: f.modelValue !== undefined ? String(f.modelValue).slice(0, 2000) : null,
    }));
    const { error } = await supabase.from('generation_log').insert(rows);
    if (error) {
      console.error('[generate-site] generation_log insert failed', error);
    }
  } catch (error) {
    // Never let an observability error escape — the generation itself
    // succeeded; just log and move on.
    console.error('[generate-site] generation_log write threw', error);
  }
}
