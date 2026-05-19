// =============================================================================
// POST /api/generate-site — the real Claude-backed website generator.
//
// Body: a ClientBrief (the create-client modal's captured brief).
// Response: a SiteGenerationResult — the same shape generateSiteSync returns,
// so the client can swap the stub for this transparently.
//
// The browser reaches this through site-generation-stub.ts's generateSiteStub,
// which falls back to the deterministic stub if this route is unconfigured
// (no ANTHROPIC_API_KEY) or fails. The Anthropic API key stays server-side.
// =============================================================================

import { NextResponse } from 'next/server';

import { fillFooterSection, fillHeaderSection } from '@/lib/website/generation-stub';
import { generatePageLive } from '@/lib/website/generate-live';
import {
  briefToGenerationContext,
  type ClientBrief,
  type SiteGenerationResult,
} from '@/lib/website/site-generation-stub';
import type { PageType } from '@/lib/website/types';

// Four parallel Opus calls with adaptive thinking — give the function room.
export const maxDuration = 300;

const SITE_PAGE_TYPES: readonly PageType[] = ['home', 'services', 'about', 'contact'];

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not an error — the client falls back to the deterministic generator.
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let brief: ClientBrief;
  try {
    brief = (await request.json()) as ClientBrief;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  try {
    const pages = await Promise.all(
      SITE_PAGE_TYPES.map(async (pageType) => {
        const result = await generatePageLive(briefToGenerationContext(brief, pageType));
        return result.page;
      }),
    );
    const chrome = briefToGenerationContext(brief, 'home');
    const result: SiteGenerationResult = {
      generationId: `site-live-${Date.now().toString(36)}`,
      pages,
      header: fillHeaderSection(chrome),
      footer: fillFooterSection(chrome),
    };
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
