// =============================================================================
// /api/clients/[id]/wizard-assets
//
// POST — persist the wizard's generated website and/or funnel for a client.
//        Idempotent at the FLOW level: if a website or funnel already exists
//        for the client, the matching arm is skipped (not re-created). This
//        is the fix for the wizard previously creating duplicate websites
//        when a customer refreshed mid-flow.
//
// Why a server route (and not just a browser supabase call from the wizard):
//
//   - `funnels_insert` RLS requires `private.is_operator()` (migration 0014).
//     A client-role wizard user cannot INSERT into `funnels` via the browser
//     supabase client — every Pattern B wizard run prior to this route had
//     0 funnels persisted. Same gap for `funnel_versions_insert` (tenant-
//     scoped but the parent funnel row has to exist first).
//   - Even for `websites` (RLS widened for `editPages` cap in migration
//     0089), an idempotency check before the INSERT is cleaner server-side
//     — the wizard's own `generationStartedRef` cannot help across page
//     reloads or refresh-resume.
//
// We avoid the `requireOperatorForClient` route shape used for everything
// else under /api/clients/[id]/* in this file because the wizard runs as
// the customer themselves; `requireClientAccess` matches the established
// wizard-state route pattern next to this one.
//
// Auth: requireClientAccess — the customer for their own client; an operator
// (concierge) acting on the customer's behalf.
//
// Side effects:
//   - Writes via `getServiceClient()` (service-role; RLS bypass). The auth
//     check above is THE authorization boundary.
//   - On every successful website creation, also writes the brand row if
//     none exists yet (mirrors `createWebsiteForClient`'s brand-seed guard).
//
// SERVER-ONLY.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';
import type { FunnelGenerationResult } from '@/lib/funnel/generation-stub';
import { derivePalette } from '@/lib/website/color-derivation';
import { getBundleForIndustry } from '@/lib/website/industry-bundle-defaults';
import { offerToRow } from '@/lib/website/offer-generate';
import type { ClientBrief, SiteGenerationResult } from '@/lib/website/site-generation-stub';
import { MAX_NAV_LINKS } from '@/lib/website/types';

export type WizardAssetsRequest = {
  brief: ClientBrief;
  clientSlug: string;
  site?: SiteGenerationResult | null;
  funnel?: FunnelGenerationResult | null;
};

export type WizardAssetsResult = {
  ok: true;
  websiteCreated: boolean;
  websiteSkipped: boolean;
  websiteId: string | null;
  funnelCreated: boolean;
  funnelSkipped: boolean;
  funnelId: string | null;
  errors: { website?: string; funnel?: string };
};

/** Idempotency probe — the wizard hits this on mount to decide whether to
 *  run generation at all. Cheap (two COUNT-style reads); cached implicitly
 *  by the wizard's in-memory `generationStartedRef`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const svc = getServiceClient();
  const [webProbe, funProbe] = await Promise.all([
    svc.from('websites').select('id').eq('client_id', clientId).limit(1).maybeSingle(),
    svc.from('funnels').select('id').eq('client_id', clientId).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({
    hasWebsite: webProbe.data !== null,
    hasFunnel: funProbe.data !== null,
    websiteId: (webProbe.data as { id: string } | null)?.id ?? null,
    funnelId: (funProbe.data as { id: string } | null)?.id ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: WizardAssetsRequest;
  try {
    body = (await request.json()) as WizardAssetsRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !body.brief || !body.clientSlug) {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const svc = getServiceClient();
  const createdByUserId = auth.userId;
  const errors: { website?: string; funnel?: string } = {};

  // -- website -------------------------------------------------------------
  let websiteId: string | null = null;
  let websiteCreated = false;
  let websiteSkipped = false;

  // Idempotency probe: is there already a website for this client? If so,
  // skip the insert — a refresh / re-entry to /onboarding must not double
  // up.
  const { data: existingWebsite, error: webProbeErr } = await svc
    .from('websites')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle();
  if (webProbeErr) {
    console.error('[wizard-assets] website probe failed', webProbeErr);
    errors.website = `probe-failed: ${webProbeErr.message}`;
  } else if (existingWebsite) {
    websiteSkipped = true;
    websiteId = (existingWebsite as { id: string }).id;
  } else if (body.site) {
    try {
      websiteId = await persistWebsite({
        svc,
        clientId,
        clientSlug: body.clientSlug,
        brief: body.brief,
        site: body.site,
        createdByUserId,
      });
      websiteCreated = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[wizard-assets] website persistence failed', e);
      errors.website = msg;
    }
  } else {
    // No existing site AND no payload — caller must include `site` to
    // create one. Treat as skipped (the wizard will retry).
    websiteSkipped = true;
  }

  // -- funnel --------------------------------------------------------------
  let funnelId: string | null = null;
  let funnelCreated = false;
  let funnelSkipped = false;

  const { data: existingFunnel, error: funProbeErr } = await svc
    .from('funnels')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle();
  if (funProbeErr) {
    console.error('[wizard-assets] funnel probe failed', funProbeErr);
    errors.funnel = `probe-failed: ${funProbeErr.message}`;
  } else if (existingFunnel) {
    funnelSkipped = true;
    funnelId = (existingFunnel as { id: string }).id;
  } else if (body.funnel) {
    try {
      funnelId = await persistFunnel({
        svc,
        clientId,
        clientSlug: body.clientSlug,
        brief: body.brief,
        funnel: body.funnel,
        createdByUserId,
      });
      funnelCreated = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[wizard-assets] funnel persistence failed', e);
      errors.funnel = msg;
    }
  } else {
    funnelSkipped = true;
  }

  const result: WizardAssetsResult = {
    ok: true,
    websiteCreated,
    websiteSkipped,
    websiteId,
    funnelCreated,
    funnelSkipped,
    funnelId,
    errors,
  };
  return NextResponse.json(result);
}

// --- internals --------------------------------------------------------------

type ServiceClient = ReturnType<typeof getServiceClient>;

/** Insert the websites row + draft website_versions snapshot + draft pointer
 *  update. Mirrors the operator-concierge `createWebsiteForClient` write
 *  path in `lib/clients/create-client.ts` column-for-column. */
async function persistWebsite(args: {
  svc: ServiceClient;
  clientId: string;
  clientSlug: string;
  brief: ClientBrief;
  site: SiteGenerationResult;
  createdByUserId: string;
}): Promise<string> {
  const { svc, clientId, clientSlug, brief, site, createdByUserId } = args;

  // Brand-seed guard — same shape as `createWebsiteForClient`. The wizard
  // path's brand-step writes are independent; this is the defensive backfill
  // for a client whose brand row was never seeded.
  //
  // Phase 2 parity fix — bring this insert into lockstep with the operator
  // concierge path (`createClientWithGeneration` / `createWebsiteForClient`)
  // and the signup placeholder (`provisionPendingSignup`). All three paths
  // must seed: design_bundle_id (Bundle C2b-1 — picked from the industry),
  // derived_palette (pre-derived from primary + optional secondary), the
  // brand colour array, an optional tagline, and the default fonts. Without
  // these the wizard-assets fallback path produced visibly different brand
  // rows from the concierge path — same customer, same industry, different
  // design tokens at render time.
  const { data: existingBrand } = await svc
    .from('brands')
    .select('client_id')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!existingBrand) {
    const seedPrimary = brief.brand.accentColor || '#d24317';
    const seedBundle = getBundleForIndustry(brief.brand.industryCategory);
    const seedPalette = derivePalette({
      primary: seedPrimary,
      secondary: brief.brand.brandColors?.[1],
      industry: brief.brand.industryCategory,
    });
    const { error: brandErr } = await svc.from('brands').insert({
      client_id: clientId,
      accent_color: seedPrimary,
      brand_colors: brief.brand.brandColors ?? [],
      logo_url: brief.brand.logoUrl,
      favicon_url: brief.brand.faviconUrl,
      voice_formality: brief.brand.voice.formality,
      voice_urgency: brief.brand.voice.urgency,
      voice_technicality: brief.brand.voice.technicality,
      audience_line: brief.brand.audienceLine,
      industry_category: brief.brand.industryCategory,
      top_jobs_to_be_booked: brief.brand.topJobsToBeBooked,
      design_bundle_id: seedBundle,
      derived_palette: seedPalette as never,
      heading_font: 'inter-tight',
      body_font: 'inter-tight',
      // Session C.5 — seed brand.offer from the brief when the wizard's
      // defensive seed path fires for the first time. The primary Pattern
      // B path for writing offer to brand lands in Session C; this is the
      // backstop that keeps the defensive seed in lockstep with the
      // concierge insert (parity rule, claudemd "Pattern B critical-fixes
      // brand-seed parity" precedent).
      offer: brief.funnel.offer ? offerToRow(brief.funnel.offer) : null,
    });
    if (brandErr) {
      // Non-fatal — log but continue to the website insert.
      console.error(
        `[wizard-assets] brand seed failed for client ${clientId}: ${brandErr.message}`,
      );
    }
  }

  const { data: web, error: webErr } = await svc
    .from('websites')
    .insert({
      client_id: clientId,
      name: `${brief.business.name} website`,
      domain_primary: `${clientSlug}.webnua.dev`,
    })
    .select('id')
    .single();
  if (webErr || !web) {
    throw new Error(`websites insert failed: ${webErr?.message ?? 'unknown'}`);
  }
  const webId = (web as { id: string }).id;

  const pages = site.pages.map((p) => ({ ...p, websiteId: webId }));
  const snapshot = {
    pages,
    header: site.header,
    footer: site.footer,
    nav: pages.slice(0, MAX_NAV_LINKS).map((p) => ({
      label: p.title,
      target: { kind: 'page', pageId: p.id },
    })),
    pageOrder: pages.map((p) => p.id),
  };
  const { data: ver, error: verErr } = await svc
    .from('website_versions')
    .insert({
      website_id: webId,
      status: 'draft',
      snapshot: snapshot as unknown as never,
      created_by: createdByUserId,
    })
    .select('id')
    .single();
  if (verErr || !ver) {
    throw new Error(
      `website_versions insert failed: ${verErr?.message ?? 'unknown'}`,
    );
  }

  const { error: webUpdErr } = await svc
    .from('websites')
    .update({ draft_version_id: (ver as { id: string }).id })
    .eq('id', webId);
  if (webUpdErr) {
    throw new Error(
      `websites draft pointer update failed: ${webUpdErr.message}`,
    );
  }

  return webId;
}

/** Insert the funnels row + draft funnel_versions snapshot + draft pointer
 *  update. Mirrors the operator-concierge funnel persistence in
 *  `lib/clients/create-client.ts:151-196` column-for-column. */
async function persistFunnel(args: {
  svc: ServiceClient;
  clientId: string;
  clientSlug: string;
  brief: ClientBrief;
  funnel: FunnelGenerationResult;
  createdByUserId: string;
}): Promise<string> {
  const { svc, clientId, clientSlug, brief, funnel, createdByUserId } = args;

  const { data: fn, error: fnErr } = await svc
    .from('funnels')
    .insert({
      client_id: clientId,
      name: funnel.funnel.name,
      slug: 'offer',
      domain_primary: `${clientSlug}.webnua.dev`,
      funnel_service: brief.funnel.service || null,
      funnel_customer_pain: brief.funnel.customerPain || null,
      funnel_guarantee: brief.funnel.guarantee || null,
      funnel_testimonials: brief.funnel.testimonials,
      funnel_offer: brief.funnel.offer ? offerToRow(brief.funnel.offer) : null,
    })
    .select('id')
    .single();
  if (fnErr || !fn) {
    throw new Error(`funnels insert failed: ${fnErr?.message ?? 'unknown'}`);
  }
  const funnelId = (fn as { id: string }).id;

  const steps = funnel.steps.map((s) => ({ ...s, funnelId }));
  const snapshot = { steps, stepOrder: steps.map((s) => s.id) };
  const { data: fv, error: fvErr } = await svc
    .from('funnel_versions')
    .insert({
      funnel_id: funnelId,
      status: 'draft',
      snapshot: snapshot as unknown as never,
      created_by: createdByUserId,
    })
    .select('id')
    .single();
  if (fvErr || !fv) {
    throw new Error(
      `funnel_versions insert failed: ${fvErr?.message ?? 'unknown'}`,
    );
  }

  const { error: fnUpdErr } = await svc
    .from('funnels')
    .update({ draft_version_id: (fv as { id: string }).id })
    .eq('id', funnelId);
  if (fnUpdErr) {
    throw new Error(
      `funnels draft pointer update failed: ${fnUpdErr.message}`,
    );
  }

  return funnelId;
}
