// =============================================================================
// POST /api/generate-funnel — the real Claude-backed funnel generator.
//
// Body: a GenerateFunnelRequest — the ClientBrief (with its funnel block + the
//   Session-2 offer) plus an optional clientId so generation_log entries can
//   be attributed to a client row. The id is optional because dev preview
//   surfaces may run without a created client.
// Response: a FunnelGenerationResult — the same shape generateFunnelSync
//   returns, so the client can swap the stub for this transparently.
//
// The browser reaches this through funnel/generation-stub.ts's
// `generateFunnelStub`. Fallback policy lives there; the route just returns
// 503 (key not configured), 400 (bad body), or 500 (real failure with
// { name, status, detail }).
//
// Observability: every fallback field from the validation pipeline is
// recorded to public.generation_log via the service-role client. Same uuid
// pattern as /api/generate-site — one uuid per request, shared across all
// fallback rows for the run.
//
// Structure: TWO parallel Opus calls — one for the lead-capture landing (Step
// 1: 7 sections), one for the qualification page (Step 2: 4 sections). The
// thanks step is deterministic chrome built by funnel/generation-stub.ts. See
// the CLAUDE.md parked decision "Funnel vs offer generator model choice".
// =============================================================================

import { NextResponse } from 'next/server';

import { checkAndRecord } from '@/lib/rate-limit';
import {
  generateFunnelLandingLive,
  generateFunnelQualificationLive,
} from '@/lib/website/generate-funnel-live';
import {
  thanksStepSections,
  buildFunnelSkeleton,
  type FunnelGenerationResult,
} from '@/lib/funnel/generation-stub';
import type { FallbackLogEntry } from '@/lib/website/generation-stub';
import type { ClientBrief } from '@/lib/website/site-generation-stub';
import { getServiceClient } from '@/lib/supabase/server';

// Single Opus call with thinking; same envelope as /api/generate-site.
export const maxDuration = 300;

type GenerateFunnelRequest = ClientBrief & { clientId?: string };

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not an error — the client falls back to the deterministic generator.
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: GenerateFunnelRequest;
  try {
    body = (await request.json()) as GenerateFunnelRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const { clientId, ...brief } = body;

  // Pattern B per-workspace AI rate limit — 3 funnel-gens per client per 24h.
  // Same shape as /api/generate-site. Skipped when no clientId (dev preview).
  if (clientId) {
    const decision = await checkAndRecord('ai_funnel_gen', { key: clientId, clientId });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: 'rate-limited', detail: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
        { status: 429 },
      );
    }
  }


  const generationId = crypto.randomUUID();

  try {
    const liveBrief = {
      brand: brief.brand,
      funnel: brief.funnel,
      phone: brief.business.phone ?? '',
      serviceArea: brief.business.serviceArea ?? '',
      industry: brief.industry,
      businessName: brief.business.name,
    };

    // Two parallel Opus calls — landing (Step 1) + qualification (Step 2).
    const [landing, qualification] = await Promise.all([
      generateFunnelLandingLive(liveBrief, generationId),
      generateFunnelQualificationLive(liveBrief, generationId),
    ]);

    const result: FunnelGenerationResult = buildFunnelSkeleton(brief, {
      landing: landing.sections,
      qualification: qualification.sections,
      thanks: thanksStepSections(),
    });

    // Fire-and-forget — observability shouldn't block the response. Combined
    // fallback log across both Claude calls shares the same generationId.
    const allFallbacks = [...landing.fallbackLog, ...qualification.fallbackLog];
    if (clientId && allFallbacks.length > 0) {
      void writeGenerationLog(clientId, generationId, allFallbacks);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[generate-funnel] generation failed', error);
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

/** Persist fallback-field entries from the validation pipeline to
 *  public.generation_log. Same service-role pattern as the website route. */
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
    // Cast — `reason` widened in migration 0093 to include
    // `'variant-reassigned'` (Bundle C2b-2); regenerate `Database` types
    // after the migration applies to drop this cast.
    const { error } = await supabase.from('generation_log').insert(rows as never);
    if (error) {
      console.error('[generate-funnel] generation_log insert failed', error);
    }
  } catch (error) {
    console.error('[generate-funnel] generation_log write threw', error);
  }
}
