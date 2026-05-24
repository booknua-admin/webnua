'use client';

// =============================================================================
// ScaffoldWebsiteButton — context-aware "Scaffold a new website" affordance
// mounted on the /website empty state.
//
// Pattern B critical fixes · Session 2. Replaces the previous flat link to
// /clients/new which made wrong sense when an operator had already drilled
// into a client (it would create a NEW client, not a new website for the
// already-active one).
//
// Two modes, dispatched from the workspace context:
//
//   - AGENCY (no client picked) → Link to /clients/new. Creates a brand-new
//     client, brand, website, funnel — the existing flow.
//
//   - SUB-ACCOUNT (client picked, no website yet) → Button that calls
//     createWebsiteForClient against the existing client. Reads the
//     client's brand + identity to build a default ClientBrief, runs the
//     same website generator, then routes to /website. No new client row
//     is created — only the website + brand reuse.
//
// Cap-gated outside this component (the call site wraps in <CapabilityGate
// capability="editPages" mode="hide">). Operators hold the cap via
// ADMIN_DEFAULTS; clients via CLIENT_OWNER_DEFAULTS — though clients only
// see this empty state if their workspace genuinely has no website.
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { createWebsiteForClient } from '@/lib/clients/create-client';
import { useUser } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { VoiceToneAxis } from '@/lib/website/types';
import { VOICE_TONE_PRESETS } from '@/lib/website/types';
import type { ClientBrief } from '@/lib/website/site-generation-stub';

type Props = {
  /** The active client's slug (sub-account mode). `null` = agency mode. */
  activeClientSlug: string | null;
  /** The active client's display name — used for in-flight button copy. */
  activeClientName: string | null;
};

export function ScaffoldWebsiteButton({ activeClientSlug, activeClientName }: Props) {
  const user = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agency mode → fall back to the existing create-client flow.
  if (!activeClientSlug) {
    return (
      <Button asChild>
        <Link href="/clients/new">Scaffold a new website</Link>
      </Button>
    );
  }

  async function scaffold() {
    if (busy || !user || !activeClientSlug) return;
    setError(null);
    setBusy(true);

    try {
      // Resolve the client row first — its id is the FK for the brand read.
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select(
          'id, name, industry, service_area, primary_contact_name, primary_contact_email, primary_contact_phone',
        )
        .eq('slug', activeClientSlug)
        .single();
      if (clientErr || !client) {
        throw normalizeError(clientErr ?? new Error('client not found'));
      }

      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('client_id', client.id)
        .maybeSingle();

      const brief: ClientBrief = {
        business: {
          name: client.name,
          ownerName: client.primary_contact_name ?? '',
          email: client.primary_contact_email ?? '',
          phone: client.primary_contact_phone ?? '',
          serviceArea: client.service_area ?? '',
          offer: brand?.tagline ?? '',
          services: brand?.top_jobs_to_be_booked ?? [],
        },
        industry: client.industry,
        brand: {
          accentColor: brand?.accent_color ?? '#d24317',
          brandColors:
            brand?.brand_colors && brand.brand_colors.length > 0
              ? brand.brand_colors
              : brand?.accent_color
                ? [brand.accent_color]
                : ['#d24317'],
          logoUrl: brand?.logo_url ?? null,
          faviconUrl: brand?.favicon_url ?? null,
          voice: brand
            ? {
                formality: brand.voice_formality as VoiceToneAxis,
                urgency: brand.voice_urgency as VoiceToneAxis,
                technicality: brand.voice_technicality as VoiceToneAxis,
              }
            : VOICE_TONE_PRESETS.professional,
          audienceLine:
            brand?.audience_line ??
            `${client.name} customers in ${client.service_area || 'their service area'}`,
          industryCategory: brand?.industry_category ?? client.industry,
          topJobsToBeBooked: brand?.top_jobs_to_be_booked ?? [],
          headingFont: brand?.heading_font ?? undefined,
          bodyFont: brand?.body_font ?? undefined,
          headingColor: brand?.heading_color ?? undefined,
          bodyColor: brand?.body_color ?? undefined,
          backgroundColor: brand?.background_color ?? undefined,
        },
        // Sensible defaults — the scaffold flow doesn't carry the Q&A
        // answers a fresh signup runs through. The generator tolerates these.
        primaryIntent: { kind: 'book' },
        audience: 'mixed',
        funnel: {
          service: '',
          customerPain: '',
          guarantee: '',
          testimonials: [],
          offer: null,
        },
      };

      await createWebsiteForClient({
        clientId: client.id,
        clientSlug: activeClientSlug,
        brief,
        createdByUserId: user.id,
      });

      // Routes through the regular /website hub — the new draft renders
      // because the website hook refetches against the live tables.
      router.push('/website');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not scaffold the website.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={scaffold} disabled={busy}>
        {busy
          ? 'Generating…'
          : `Scaffold a website for ${activeClientName ?? 'this client'}`}
      </Button>
      {error ? (
        <p className="max-w-[420px] text-[12px] font-semibold text-warn">{error}</p>
      ) : null}
    </div>
  );
}
