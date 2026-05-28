'use client';

// =============================================================================
// GenerateAdsView — the single-screen "Generate my ads" magic moment.
//
// Phase 7.5 · Session 2.1. Replaces the wizard as the *primary* entry to
// /campaigns/launch. One button → 3 Claude-generated angles → pick → existing
// orchestrator launches.
//
// Four phases (one component, internal state machine):
//   • idle      — brand summary card + big rust "✦ Generate my ads" button.
//                 If the brief is incomplete (soft missing fields), the
//                 explainer renders inline + the button stays enabled
//                 (Sonnet falls back to qualitative defaults). Hard blocks
//                 (no published site, no Meta ad account) render a
//                 remediation card and hide the button entirely.
//   • generating— rust spinner + "Drafting three angles…" splash. Sonnet
//                 typically returns in 10-30s.
//   • picker    — three AnglePickerCards + a launch summary band at the
//                 bottom. Auto-selects all three; operator unticks any
//                 they don't want. Launch CTA fires the existing
//                 orchestrator (one ad set per picked angle's variants —
//                 Session 1.4a matrix architecture).
//   • launching — rust spinner + "Setting up your campaign on Meta…" while
//                 the orchestrator runs (8-step Meta chain — can take
//                 30-60s).
//
// On launch success, calls `onLaunched` which the page handler uses to
// route back to /campaigns + invalidate caches.
//
// Out of scope for 2.1 (deliberately):
//   • Brief-completion chat for soft blocks (Session 2.2).
//   • Per-angle image overrides + multi-upload (V1.1).
//   • Post-generation tree visualization (Session 2.3).
//   • Show-details targeting/budget expansion. Operators who need to
//     override the defaults pick "Open classic builder →" which routes
//     to /campaigns/launch?mode=classic.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AnglePickerCards } from './AnglePickerCards';
import { MetaAdPreview } from './MetaAdPreview';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import {
  useBriefCompleteness,
  type BriefCompleteness,
  type BriefField,
  BRIEF_FIELD_LABEL,
} from '@/lib/campaigns/brief-completeness';
import { generateMetaAdAngles, type GeneratedAngle } from '@/lib/integrations/meta-ads/generate-angles';
import {
  templateForIndustry,
  type MetaAdTemplate,
} from '@/lib/integrations/meta-ads/templates';
import {
  useClientMetaAdAccount,
  useLaunchMetaCampaign,
  type LaunchCampaignPayload,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import { resolveIndustryTemplate } from '@/lib/website/industry-templates';
import { supabase } from '@/lib/supabase/client';

// --- props ------------------------------------------------------------------

export type GenerateAdsViewProps = {
  clientId: string;
  /** Display name for the brand summary header. */
  clientName: string;
  /** Operator's escape hatch to the full wizard. */
  classicBuilderHref: string;
  /** Cancel — handler routes back to /campaigns. */
  onCancel: () => void;
  /** Fired on successful launch — handler invalidates caches + routes. */
  onLaunched: (result: { metaCampaignDbId: string; campaignId: string }) => void;
};

// --- phase machine ---------------------------------------------------------

type Phase =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'picker'; angles: GeneratedAngle[] }
  | { kind: 'launching'; angles: GeneratedAngle[] };

type GenerateError = {
  message: string;
  detail?: string;
};

// --- main component --------------------------------------------------------

export function GenerateAdsView({
  clientId,
  clientName,
  classicBuilderHref,
  onCancel,
  onLaunched,
}: GenerateAdsViewProps) {
  const user = useUser();
  const completeness = useBriefCompleteness(clientId);
  const adAccount = useClientMetaAdAccount(clientId);
  const launchMutation = useLaunchMetaCampaign();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set());
  const [generateError, setGenerateError] = useState<GenerateError | null>(null);
  const [launchError, setLaunchError] = useState<GenerateError | null>(null);

  const brief = useBriefContext(clientId);

  // --- Generate handler ----------------------------------------------------

  async function handleGenerate() {
    setGenerateError(null);
    setPhase({ kind: 'generating' });
    try {
      const angles = await generateMetaAdAngles({ clientId });
      if (angles.length === 0) {
        setGenerateError({
          message: 'Generation returned no angles. Try again.',
        });
        setPhase({ kind: 'idle' });
        return;
      }
      // Auto-select all returned angles — the operator unticks any they
      // don't want. Three is the standard pick; if Sonnet returned fewer
      // we still pre-select them all.
      setSelectedAngles(new Set(angles.map((a) => a.id)));
      setPhase({ kind: 'picker', angles });
    } catch (error) {
      setGenerateError({
        message:
          error instanceof Error ? error.message : 'Generation failed unexpectedly.',
      });
      setPhase({ kind: 'idle' });
    }
  }

  function handleToggleAngle(angleId: string, selected: boolean) {
    setSelectedAngles((prev) => {
      const next = new Set(prev);
      if (selected) next.add(angleId);
      else next.delete(angleId);
      return next;
    });
  }

  function handleRegenerate() {
    setSelectedAngles(new Set());
    setPhase({ kind: 'idle' });
  }

  // --- Launch handler ------------------------------------------------------

  async function handleLaunch() {
    if (phase.kind !== 'picker') return;
    if (!brief.data) return;
    if (!adAccount.data) return;
    if (!user) return;

    const pickedAngles = phase.angles.filter((a) => selectedAngles.has(a.id));
    if (pickedAngles.length === 0) return;
    if (!brief.data.primaryDomain) return;

    setLaunchError(null);
    setPhase({ kind: 'launching', angles: phase.angles });

    const template = templateForIndustry(brief.data.industry);
    const industry = resolveIndustryTemplate(brief.data.industry);
    const stockImages = industry.stockImages;
    // V1 image set — hero + first 2 gallery photos. The orchestrator
    // posts each one to Meta's /adimages; image_hash dedupe makes the
    // call idempotent if the operator re-launches with the same URLs.
    // Width/height are unknown for stock URLs (no probe), so null —
    // the launch payload type accepts null and Meta infers from the
    // image itself.
    const imageUrls = [stockImages.hero, ...stockImages.gallery.slice(0, 2)];

    // Each angle contributes ALL of its variants. Per Session 1.4a's
    // matrix architecture this means each variant becomes its own ad
    // set (CBO at the campaign level distributes spend) — angle is the
    // copy axis. Cap at 5 variants total (Meta's optimisation algorithm
    // dilutes past that; the orchestrator caps at 10 for safety).
    const allVariants = pickedAngles
      .flatMap((a) => a.variants)
      .slice(0, 5)
      .map((v) => ({
        headline: v.headline,
        primaryText: v.primaryText,
        description:
          v.description && v.description.length > 0 ? v.description : null,
        ctaType: v.ctaType,
      }));

    const linkUrl = `https://${brief.data.primaryDomain}`;
    const privacyPolicyUrl = `https://${brief.data.primaryDomain}/privacy`;

    const payload: LaunchCampaignPayload = {
      clientId,
      templateSlug: template.slug,
      campaignName: defaultCampaignName(clientName, template),
      campaignObjective: 'lead_form_meta',
      pixelId: null,
      targeting: {
        geoCenter: null,
        radiusKm: null,
        cities: [],
        interests: [],
        ageMin: template.defaultAgeMin,
        ageMax: template.defaultAgeMax,
        interestTokens: [...template.interestTokens],
        countries: [inferCountryFromServiceArea(brief.data.serviceArea)],
      },
      dailyBudgetCents: template.defaultDailyBudgetCents,
      startTimeIso: new Date().toISOString(),
      endTimeIso: null,
      creative: {
        adFormat: 'single_image',
        images: imageUrls.map((imageUrl) => ({
          imageUrl,
          imageWidth: null,
          imageHeight: null,
        })),
        variants: allVariants,
        linkUrl,
        privacyPolicyUrl,
      },
      isFirstLaunch: false,
      goLive: true,
    };

    try {
      const result = await launchMutation.mutateAsync(payload);
      onLaunched({
        metaCampaignDbId: result.metaCampaignDbId,
        campaignId: result.campaignId,
      });
    } catch (error) {
      setLaunchError({
        message:
          error instanceof Error
            ? error.message
            : 'Launch failed — Meta rejected the campaign or the network blipped.',
      });
      setPhase({ kind: 'picker', angles: phase.angles });
    }
  }

  // --- Render --------------------------------------------------------------

  // Loading states — the four queries (completeness + adAccount + brief)
  // resolve in parallel; show a thin spinner until they all land.
  if (completeness.isLoading || adAccount.isLoading || brief.isLoading) {
    return <LoadingFrame label="Loading your brand…" />;
  }

  const completenessData = completeness.data;
  if (!completenessData) {
    return <LoadingFrame label="Loading your brand…" />;
  }

  if (!completenessData.ready && 'hardBlock' in completenessData) {
    return (
      <HardBlockCard
        hardBlock={completenessData.hardBlock}
        clientName={clientName}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-8 md:px-10 md:py-10">
      <Header clientName={clientName} brief={brief.data ?? null} />

      {phase.kind === 'idle' && (
        <IdleState
          completeness={completenessData}
          generateError={generateError}
          onGenerate={handleGenerate}
          onCancel={onCancel}
          classicBuilderHref={classicBuilderHref}
        />
      )}

      {phase.kind === 'generating' && (
        <SplashState label="Drafting three angles…" sub="Sonnet is reading your brand, audience, and offer." />
      )}

      {phase.kind === 'picker' && (
        <PickerState
          angles={phase.angles}
          selected={selectedAngles}
          onToggle={handleToggleAngle}
          onLaunch={handleLaunch}
          onRegenerate={handleRegenerate}
          onCancel={onCancel}
          launchError={launchError}
          brief={brief.data ?? null}
          launchPending={launchMutation.isPending}
          classicBuilderHref={classicBuilderHref}
        />
      )}

      {phase.kind === 'launching' && (
        <SplashState
          label="Setting up your campaign on Meta…"
          sub="One ad set per angle. This can take 30-60 seconds — Meta runs through approvals at each step."
        />
      )}
    </div>
  );
}

// --- sub-components ---------------------------------------------------------

function Header({
  clientName,
  brief,
}: {
  clientName: string;
  brief: BriefContext | null;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// GENERATE ADS · ONE BUTTON'}
      </div>
      <h1 className="text-[28px] font-semibold tracking-tight text-ink md:text-[32px]">
        {clientName}
      </h1>
      {brief?.audienceLine ? (
        <p className="max-w-2xl text-[14px] leading-snug text-ink-soft">
          {brief.audienceLine}
        </p>
      ) : null}
    </header>
  );
}

function IdleState({
  completeness,
  generateError,
  onGenerate,
  onCancel,
  classicBuilderHref,
}: {
  completeness: BriefCompleteness;
  generateError: GenerateError | null;
  onGenerate: () => void;
  onCancel: () => void;
  classicBuilderHref: string;
}) {
  const softMissing =
    !completeness.ready && 'missing' in completeness
      ? completeness.missing
      : null;
  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-rule bg-card px-6 py-7 md:px-10 md:py-10">
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink md:text-[22px]">
          Three angles, one click.
        </h2>
        <p className="max-w-xl text-[14px] leading-relaxed text-ink-soft">
          We&rsquo;ll draft a <strong className="font-semibold text-ink">pain-led</strong>,
          an <strong className="font-semibold text-ink">outcome-led</strong>, and a
          {' '}
          <strong className="font-semibold text-ink">trust-led</strong> version
          of your ad — same offer, three angles. Pick the ones you want to test
          and we launch them all on Meta.
        </p>
      </div>

      {softMissing && softMissing.length > 0 ? (
        <SoftMissingExplainer missing={softMissing} />
      ) : null}

      {generateError ? (
        <ErrorPanel error={generateError} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onGenerate}
          className="h-12 px-7 text-[14px] font-semibold"
        >
          ✦ Generate my ads
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto">
          <Link
            href={classicBuilderHref}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline"
          >
            Open classic builder →
          </Link>
        </span>
      </div>
    </section>
  );
}

function SoftMissingExplainer({ missing }: { missing: readonly BriefField[] }) {
  return (
    <div className="rounded-md border border-rust-soft bg-rust-soft/40 px-4 py-3">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// HEADS UP'}
      </div>
      <p className="text-[13px] leading-snug text-ink-soft">
        Generation works best when we know more about you. We&rsquo;ll fall
        back to qualitative defaults for: {missing.map((f) => BRIEF_FIELD_LABEL[f]).join(', ')}.
        You can edit your brand profile any time at{' '}
        <Link
          href="/settings/brand"
          className="font-medium text-rust underline-offset-4 hover:underline"
        >
          /settings/brand
        </Link>
        .
      </p>
    </div>
  );
}

function PickerState({
  angles,
  selected,
  onToggle,
  onLaunch,
  onRegenerate,
  onCancel,
  launchError,
  brief,
  launchPending,
  classicBuilderHref,
}: {
  angles: GeneratedAngle[];
  selected: Set<string>;
  onToggle: (id: string, selected: boolean) => void;
  onLaunch: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  launchError: GenerateError | null;
  brief: BriefContext | null;
  launchPending: boolean;
  classicBuilderHref: string;
}) {
  const pickedCount = selected.size;
  const totalAds = angles
    .filter((a) => selected.has(a.id))
    .reduce((sum, a) => sum + a.variants.length, 0);

  // First selected angle's first variant — used as the live Meta-feed
  // preview underneath the cards. Helps the operator picture what's
  // about to ship without opening the classic builder.
  const previewAngle =
    angles.find((a) => selected.has(a.id)) ?? angles[0] ?? null;
  const previewVariant = previewAngle?.variants[0] ?? null;
  const industry = brief ? resolveIndustryTemplate(brief.industry) : null;
  const previewImage = industry?.stockImages.hero ?? null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          Pick your angles
        </h2>
        <p className="text-[13px] leading-snug text-ink-soft">
          All three are selected by default. Untick any you don&rsquo;t want to
          test — Meta runs each picked angle as its own ad set.
        </p>
      </div>

      <AnglePickerCards
        angles={angles}
        selected={selected}
        onToggle={onToggle}
      />

      {previewVariant && previewImage ? (
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// LIVE PREVIEW · '}
            <span className="text-rust">{previewAngle?.label}</span>
          </div>
          <div className="max-w-[420px]">
            <MetaAdPreview
              pageName={brief?.businessName ?? 'Your business'}
              pageLogoUrl={null}
              primaryText={previewVariant.primaryText}
              headline={previewVariant.headline}
              description={previewVariant.description}
              ctaType={previewVariant.ctaType}
              imageUrl={previewImage}
              linkHost={brief?.primaryDomain ?? undefined}
            />
          </div>
        </div>
      ) : null}

      {launchError ? <ErrorPanel error={launchError} /> : null}

      <LaunchSummaryBand
        pickedCount={pickedCount}
        totalAds={totalAds}
        onLaunch={onLaunch}
        onRegenerate={onRegenerate}
        onCancel={onCancel}
        launchDisabled={pickedCount === 0 || launchPending}
        launchPending={launchPending}
        classicBuilderHref={classicBuilderHref}
      />
    </section>
  );
}

function LaunchSummaryBand({
  pickedCount,
  totalAds,
  onLaunch,
  onRegenerate,
  onCancel,
  launchDisabled,
  launchPending,
  classicBuilderHref,
}: {
  pickedCount: number;
  totalAds: number;
  onLaunch: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  launchDisabled: boolean;
  launchPending: boolean;
  classicBuilderHref: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-2xl border border-rule bg-ink px-5 py-4 text-paper shadow-card md:flex-row md:items-center md:gap-5 md:px-6 md:py-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {'// READY TO LAUNCH'}
        </span>
        <span className="text-[15px] font-medium leading-snug">
          {pickedCount > 0 ? (
            <>
              {pickedCount} angle{pickedCount === 1 ? '' : 's'} ·{' '}
              <strong className="font-semibold text-paper">{totalAds}</strong>{' '}
              ad{totalAds === 1 ? '' : 's'} launching together
            </>
          ) : (
            <span className="text-paper/70">Pick at least one angle to launch.</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <Button
          type="button"
          variant="ghost"
          onClick={onRegenerate}
          disabled={launchPending}
          className="text-paper hover:bg-paper/10 hover:text-paper"
        >
          Regenerate
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={launchPending}
          className="text-paper hover:bg-paper/10 hover:text-paper"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onLaunch}
          disabled={launchDisabled}
          className="h-11 px-6 text-[14px] font-semibold"
        >
          {launchPending ? 'Launching…' : 'Launch →'}
        </Button>
        <Link
          href={classicBuilderHref}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/70 underline-offset-4 hover:text-paper hover:underline"
        >
          Classic builder →
        </Link>
      </div>
    </div>
  );
}

function SplashState({ label, sub }: { label: string; sub: string }) {
  return (
    <section className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-rule bg-card px-6 py-12 text-center">
      <RustSpinner />
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// GENERATING ✦'}
      </div>
      <h2 className="text-[18px] font-semibold tracking-tight text-ink">
        {label}
      </h2>
      <p className="max-w-md text-[13px] leading-snug text-ink-soft">{sub}</p>
    </section>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-200px)] w-full max-w-[1080px] items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-3">
        <RustSpinner />
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// '}
          {label}
        </div>
      </div>
    </div>
  );
}

function HardBlockCard({
  hardBlock,
  clientName,
  onCancel,
}: {
  hardBlock: 'no_published_site' | 'no_ad_account';
  clientName: string;
  onCancel: () => void;
}) {
  const copy =
    hardBlock === 'no_published_site'
      ? {
          eyebrow: '// PUBLISH YOUR SITE FIRST',
          title: 'No published website yet.',
          body: 'Meta lead-form ads point at a real customer-facing URL — we use it for the landing link and the privacy policy. Publish your site, then come back here.',
          cta: { label: 'Open website builder →', href: '/website' },
        }
      : {
          eyebrow: '// CONNECT META FIRST',
          title: 'Meta isn’t wired up yet.',
          body: 'We post your campaign to the customer’s own Meta ad account — connect it on the integrations tab and pick the ad account, then come back here.',
          cta: { label: 'Open integrations →', href: '/settings/integrations' },
        };
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 py-12 md:px-10 md:py-16">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {copy.eyebrow}
      </div>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink md:text-[30px]">
        {copy.title}
      </h1>
      <p className="text-[14px] leading-relaxed text-ink-soft">{copy.body}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button asChild>
          <Link href={copy.cta.href}>{copy.cta.label}</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back to campaigns
        </Button>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
        Client: <span className="text-ink">{clientName}</span>
      </p>
    </div>
  );
}

function ErrorPanel({ error }: { error: GenerateError }) {
  return (
    <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn-soft/40 px-4 py-3">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
        {'// SOMETHING WENT WRONG'}
      </div>
      <p className="text-[13px] leading-snug text-ink">{error.message}</p>
      {error.detail ? (
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">{error.detail}</p>
      ) : null}
    </div>
  );
}

function RustSpinner() {
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-2 border-rust/20 border-t-rust"
      role="status"
      aria-label="Loading"
    />
  );
}

// --- brief context resolution ----------------------------------------------

/** Lightweight read of the customer's name + industry + service area +
 *  audience-line + primary domain — used by the header summary AND the
 *  launch payload assembly. Mirrors the wizard's resolveClientContext
 *  but trimmed (no voice axes / hero copy / tagline; those live on the
 *  server route's brief loader). */
type BriefContext = {
  businessName: string;
  industry: string;
  serviceArea: string;
  audienceLine: string;
  primaryDomain: string | null;
};

function useBriefContext(clientId: string) {
  // Inline the query so we don't pull in another hook file just for a
  // small read — same untyped-cast pattern as use-meta-ads.ts.
  return useBriefContextQuery(clientId);
}

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function useBriefContextQuery(clientId: string) {
  return useQuery({
    queryKey: ['generate-ads-brief', clientId],
    queryFn: async (): Promise<BriefContext> => {
      const [brandRes, clientRes, websiteRes] = await Promise.all([
        db()
          .from('brands')
          .select('audience_line, industry_category')
          .eq('client_id', clientId)
          .maybeSingle(),
        db()
          .from('clients')
          .select('name, industry, service_area')
          .eq('id', clientId)
          .maybeSingle(),
        db()
          .from('websites')
          .select('domain_primary')
          .eq('client_id', clientId)
          .maybeSingle(),
      ]);
      const brand = (brandRes.data ?? null) as {
        audience_line?: string | null;
        industry_category?: string | null;
      } | null;
      const client = (clientRes.data ?? null) as {
        name?: string | null;
        industry?: string | null;
        service_area?: string | null;
      } | null;
      const website = (websiteRes.data ?? null) as {
        domain_primary?: string | null;
      } | null;
      return {
        businessName: client?.name ?? 'Your business',
        industry: brand?.industry_category ?? client?.industry ?? 'generic',
        serviceArea: client?.service_area ?? '',
        audienceLine: brand?.audience_line ?? '',
        primaryDomain: website?.domain_primary ?? null,
      };
    },
    enabled: clientId.length > 0,
  });
}

// --- helpers ---------------------------------------------------------------

function defaultCampaignName(clientName: string, template: MetaAdTemplate): string {
  const ts = new Date().toISOString().slice(0, 10);
  return `${clientName} · ${template.label} · ${ts}`;
}

/** Heuristic — pull a country code out of a freeform service-area string
 *  the same way the wizard does (the default is 'AU' since Webnua is
 *  Perth-based; service areas mentioning IE / GB / US suburbs land on
 *  those instead). Operators with non-default targeting use the classic
 *  builder. */
function inferCountryFromServiceArea(serviceArea: string): string {
  const haystack = serviceArea.toLowerCase();
  if (!haystack) return 'AU';
  if (/\b(ireland|dublin|cork|galway|limerick|waterford|belfast)\b/.test(haystack)) return 'IE';
  if (/\b(united kingdom|uk|london|manchester|birmingham|leeds|scotland|wales|england)\b/.test(haystack)) return 'GB';
  if (/\b(united states|usa|new york|los angeles|chicago|texas|california)\b/.test(haystack)) return 'US';
  if (/\b(new zealand|auckland|wellington|christchurch)\b/.test(haystack)) return 'NZ';
  if (/\b(canada|toronto|vancouver|montreal)\b/.test(haystack)) return 'CA';
  return 'AU';
}
