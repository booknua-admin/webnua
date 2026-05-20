// =============================================================================
// create-client — writes a generated client to Supabase: a client row, its
// brand, and (optionally) a generated website + funnel with their draft
// versions. The created client is a first-class row — it flows through the
// roster, the picker, the website / funnel hubs, and the real editors.
//
// RLS: every insert here requires the signed-in user to be an operator
// (role = 'admin'). The create flow is operator-only, so that holds.
// =============================================================================

import { AppError, normalizeError } from '@/lib/errors';
import { generateFunnelSync } from '@/lib/funnel/generation-stub';
import { supabase } from '@/lib/supabase/client';
import { generateSiteStub, type ClientBrief } from '@/lib/website/site-generation-stub';
import { MAX_NAV_LINKS } from '@/lib/website/types';

import { hydrateClients } from './clients-store';

export type CreateClientInput = {
  brief: ClientBrief;
  wantWebsite: boolean;
  wantFunnel: boolean;
};

export type CreateClientResult = {
  clientSlug: string;
  websiteId: string | null;
  funnelId: string | null;
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'client'
  );
}

function rand(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function createClientWithGeneration(
  input: CreateClientInput,
): Promise<CreateClientResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { brief } = input;

  // The two NOT NULL client columns with no default. The modal gates these,
  // but guard at the data layer too so an empty string can never be written.
  const fields: Record<string, string> = {};
  if (!brief.business.name.trim()) fields.name = 'Business name is required.';
  if (!brief.industry.trim()) fields.industry = 'Trade / industry is required.';
  if (Object.keys(fields).length > 0) {
    throw AppError.validation(fields, 'Complete the required business details.');
  }

  // -- 1. client row (retry the slug on a unique clash) --
  const base = slugify(brief.business.name);
  let client: { id: string; slug: string } | null = null;
  for (const slug of [base, `${base}-${rand()}`, `${base}-${rand()}`]) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: brief.business.name,
        slug,
        industry: brief.industry,
        service_area: brief.business.serviceArea || null,
        primary_contact_name: brief.business.ownerName || null,
        primary_contact_email: brief.business.email || null,
        primary_contact_phone: brief.business.phone || null,
        onboarded_by: user.id,
      })
      .select('id, slug')
      .single();
    if (!error && data) {
      client = data;
      break;
    }
    if (error && error.code !== '23505') throw normalizeError(error);
  }
  if (!client) throw new Error('Could not allocate a unique client slug.');

  // -- 2. brand --
  const { error: brandErr } = await supabase.from('brands').insert({
    client_id: client.id,
    accent_color: brief.brand.accentColor,
    logo_url: brief.brand.logoUrl,
    favicon_url: brief.brand.faviconUrl,
    voice_formality: brief.brand.voice.formality,
    voice_urgency: brief.brand.voice.urgency,
    voice_technicality: brief.brand.voice.technicality,
    audience_line: brief.brand.audienceLine,
    industry_category: brief.brand.industryCategory,
    top_jobs_to_be_booked: brief.brand.topJobsToBeBooked,
  });
  if (brandErr) throw normalizeError(brandErr);

  let websiteId: string | null = null;
  let funnelId: string | null = null;

  // -- 3. website + draft version --
  if (input.wantWebsite) {
    // Real Claude generation via /api/generate-site; falls back to the
    // deterministic generator if ANTHROPIC_API_KEY is unset. Passing clientId
    // lets the route attribute generation_log rows to this client.
    const site = await generateSiteStub(brief, { clientId: client.id });
    const { data: web, error: webErr } = await supabase
      .from('websites')
      .insert({
        client_id: client.id,
        name: `${brief.business.name} website`,
        domain_primary: `${client.slug}.webnua.dev`,
      })
      .select('id')
      .single();
    if (webErr || !web) throw normalizeError(webErr ?? new Error('website insert failed'));
    websiteId = web.id;

    const pages = site.pages.map((p) => ({ ...p, websiteId: web.id }));
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
    const { data: ver, error: verErr } = await supabase
      .from('website_versions')
      .insert({
        website_id: web.id,
        status: 'draft',
        snapshot: snapshot as unknown as never,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (verErr || !ver) throw normalizeError(verErr ?? new Error('website version insert failed'));

    const { error: webUpdErr } = await supabase
      .from('websites')
      .update({ draft_version_id: ver.id })
      .eq('id', web.id);
    if (webUpdErr) throw normalizeError(webUpdErr);
  }

  // -- 4. funnel + draft version --
  if (input.wantFunnel) {
    const fr = generateFunnelSync(brief);
    // The funnel is served at {websiteHost}/{slug}; 'offer' is free because a
    // new client gets exactly one funnel. domain_primary is vestigial under
    // path-based routing — kept for the not-null column, set to the host.
    const { data: fn, error: fnErr } = await supabase
      .from('funnels')
      .insert({
        client_id: client.id,
        name: fr.funnel.name,
        slug: 'offer',
        domain_primary: `${client.slug}.webnua.dev`,
      })
      .select('id')
      .single();
    if (fnErr || !fn) throw normalizeError(fnErr ?? new Error('funnel insert failed'));
    funnelId = fn.id;

    const steps = fr.steps.map((s) => ({ ...s, funnelId: fn.id }));
    const snapshot = { steps, stepOrder: steps.map((s) => s.id) };
    const { data: fv, error: fvErr } = await supabase
      .from('funnel_versions')
      .insert({
        funnel_id: fn.id,
        status: 'draft',
        snapshot: snapshot as unknown as never,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (fvErr || !fv) throw normalizeError(fvErr ?? new Error('funnel version insert failed'));

    const { error: fnUpdErr } = await supabase
      .from('funnels')
      .update({ draft_version_id: fv.id })
      .eq('id', fn.id);
    if (fnUpdErr) throw normalizeError(fnUpdErr);
  }

  // Refresh the in-memory client cache so the new client appears in the
  // roster + sidebar picker immediately.
  await hydrateClients();

  return { clientSlug: client.slug, websiteId, funnelId };
}
