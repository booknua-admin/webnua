'use client';

// =============================================================================
// GenerateAdsView — the single-screen "Generate my ads" magic moment.
//
// Phase 7.5 · Session 2.1. Replaces the wizard as the *primary* entry to
// /campaigns/launch. One button → 3 AI-generated angles → pick → existing
// orchestrator launches.
//
// Four phases (one component, internal state machine):
//   • idle      — brand summary card + big rust "✦ Generate my ads" button.
//                 Hard blocks (no published site, no Meta ad account)
//                 render a remediation card and hide the button entirely.
//   • chat      — CampaignChat owns gap-fill → "got an idea?" → angle
//                 generation → angle picker, all in one conversation.
//                 Exits with the picked angles, which seed the blueprint.
//   • blueprint — the visual hierarchy: Campaign root → Ad Set row →
//                 Ad preview row (real MetaAdPreview cards). Click any
//                 node to open its focused modal editor. Launch fires
//                 from the sticky bottom band.
//   • launching — rust spinner + "Setting up your campaign on Meta…"
//                 while the orchestrator runs (8-step Meta chain).
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { CampaignChat } from './CampaignChat';
import {
  CampaignBlueprint,
  DEFAULT_AUDIENCE,
  recommendedAdSetCount,
  recommendedImagesPerAdSet,
  type AdSetNode,
  type AudienceSpec,
  type BlueprintBrief,
  type CtaType,
  type LaunchSettings,
} from './CampaignBlueprint';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import {
  useBriefCompleteness,
  type BriefCompleteness,
  type BriefField,
  BRIEF_FIELD_LABEL,
} from '@/lib/campaigns/brief-completeness';
import type { GeneratedAngle } from '@/lib/integrations/meta-ads/generate-angles';
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
  | { kind: 'chat'; missing: readonly BriefField[] }
  | { kind: 'blueprint'; settings: LaunchSettings; adSets: AdSetNode[] }
  | {
      kind: 'launching';
      settings: LaunchSettings;
      adSets: AdSetNode[];
    };

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
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [launchError, setLaunchError] = useState<GenerateError | null>(null);

  const brief = useBriefContext(clientId);

  // --- Generate handler ----------------------------------------------------

  /** Top-level Generate click — open the chat. The chat handles
   *  everything: gap-fill if needed, optional ad-idea capture, angle
   *  draft, angle picker — all in one conversation. Hard blocks are
   *  caught upstream by the HardBlockCard so this path never sees
   *  them. */
  function handleGenerateClick() {
    if (!completeness.data) return;
    const missing =
      !completeness.data.ready && 'missing' in completeness.data
        ? completeness.data.missing
        : [];
    setPhase({ kind: 'chat', missing });
  }

  /** Chat completed — receives the angles + the operator's picks,
   *  builds the blueprint, and transitions. Brand-context + completeness
   *  queries are invalidated so anything reading them downstream sees
   *  the updated brand values from gap-fill. */
  function handleChatComplete(input: {
    angles: GeneratedAngle[];
    selectedAngleIds: Set<string>;
  }) {
    void queryClient.invalidateQueries({
      queryKey: ['brief-completeness', clientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['generate-ads-brief', clientId],
    });
    if (!brief.data) return;
    const template = templateForIndustry(brief.data.industry);
    const industryTemplate = resolveIndustryTemplate(brief.data.industry);

    // Budget-tier scaling: the operator's spend determines how many
    // ad sets we run (Meta needs ~€5-10/day per set to learn). At low
    // budgets we test fewer angles but with more image variants per
    // set so the operator still gets meaningful signal.
    const dailyBudgetCents = template.defaultDailyBudgetCents;
    const targetAdSetCount = recommendedAdSetCount(dailyBudgetCents);
    const imagesPerAdSet = recommendedImagesPerAdSet(targetAdSetCount);

    // Honour the operator's pick first; if they picked more angles than
    // the budget supports, take the first N. If they picked fewer, use
    // what they gave us. (Future polish: surface this trade-off in chat
    // before the operator commits, so they can either bump budget or
    // accept fewer angles.)
    const pickedAngles = input.angles
      .filter((a) => input.selectedAngleIds.has(a.id))
      .slice(0, targetAdSetCount);

    // Two shared images A + B — same across every ad set. The operator
    // overrides per-ad via AdEditModal if they want to diverge later.
    // At 1-ad-set scale we expand to three images to keep the test
    // meaningful when angle variety is capped.
    const stockImages = industryTemplate.stockImages;
    const imagePool: string[] = [
      stockImages.hero,
      stockImages.gallery[0] ?? stockImages.hero,
      stockImages.gallery[1] ?? stockImages.gallery[0] ?? stockImages.hero,
    ].slice(0, imagesPerAdSet);
    const imageLabels = ['Image A', 'Image B', 'Image C'];

    const seedAudience = (): AudienceSpec => ({
      ...DEFAULT_AUDIENCE,
      description: brief.data?.audienceLine ?? '',
      ageMin: template.defaultAgeMin,
      ageMax: template.defaultAgeMax,
      radiusKm: template.defaultRadiusKm,
      interestKeywords: template.interestTokens.join(', '),
    });

    const adSets: AdSetNode[] = pickedAngles.map((a) => {
      // ONE copy variant per ad set — the angle's first variant. The
      // operator can edit the copy on the AdEditModal's "Copy (shared)"
      // panel; per-ad-set copy variation is intentional, per-ad copy
      // variation is NOT (image is the only within-set variable).
      const primary = a.variants[0];
      return {
        angleId: a.id,
        label: a.label,
        rationale: a.rationale,
        headline: primary?.headline ?? '',
        primaryText: primary?.primaryText ?? '',
        description: primary?.description ?? '',
        ctaType: (primary?.ctaType ?? 'LEARN_MORE') as CtaType,
        audience: seedAudience(),
        ads: imagePool.map((imageUrl, idx) => ({
          id: `${a.id}-${idx}`,
          label: imageLabels[idx] ?? `Image ${idx + 1}`,
          imageUrl,
          selected: true,
        })),
      };
    });

    const settings: LaunchSettings = {
      campaignName: defaultCampaignName(clientName, template),
      dailyBudgetCents,
      country: inferCountryFromServiceArea(brief.data.serviceArea),
    };
    setLaunchError(null);
    setPhase({ kind: 'blueprint', settings, adSets });
  }

  function handleChatCancel() {
    // Drop back to idle — any saved-during-chat answers stay persisted,
    // so reopening the chat starts from where the operator left off.
    void queryClient.invalidateQueries({
      queryKey: ['brief-completeness', clientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['generate-ads-brief', clientId],
    });
    setPhase({ kind: 'idle' });
  }

  function handleSettingsChange(next: LaunchSettings) {
    if (phase.kind !== 'blueprint') return;
    setPhase({ kind: 'blueprint', settings: next, adSets: phase.adSets });
  }

  /** Replace one ad-set draft (variant edit / selection toggle). The
   *  CampaignBlueprint component emits the whole new AdSetNode; we splice
   *  by angleId so a future reorder doesn't break the mapping. */
  function handleAdSetChange(next: AdSetNode) {
    if (phase.kind !== 'blueprint') return;
    setPhase({
      kind: 'blueprint',
      settings: phase.settings,
      adSets: phase.adSets.map((a) => (a.angleId === next.angleId ? next : a)),
    });
  }


  // --- Launch handler ------------------------------------------------------

  async function handleLaunch() {
    if (phase.kind !== 'blueprint') return;
    if (!brief.data) return;
    if (!adAccount.data) return;
    if (!user) return;
    if (!brief.data.primaryDomain) return;

    const settings = phase.settings;
    const adSets = phase.adSets;

    // Each ad set contributes ONE copy variant (its shared copy) — the
    // experiment design holds copy constant within a set and varies
    // image. Drop ad sets where every image variant is unticked.
    const activeAdSets = adSets.filter((s) => s.ads.some((a) => a.selected));
    if (activeAdSets.length === 0) return;

    // The launch payload's `variants` axis is per-ad-set copy. Cap at
    // 5 (Meta's learning ceiling).
    const allVariants = activeAdSets.slice(0, 5).map((adSet) => ({
      headline: adSet.headline,
      primaryText: adSet.primaryText,
      description:
        adSet.description && adSet.description.length > 0
          ? adSet.description
          : null,
      ctaType: adSet.ctaType,
    }));

    // Distinct image URLs across every selected ad — Meta dedupes
    // hashes per account, so duplicates are cheap. The matrix is
    // M (copy variants) × N (images); within an ad set every image
    // becomes its own ad.
    const distinctImages = Array.from(
      new Set(
        activeAdSets
          .flatMap((s) => s.ads.filter((a) => a.selected).map((a) => a.imageUrl))
          .filter(Boolean),
      ),
    );

    setLaunchError(null);
    setPhase({ kind: 'launching', settings, adSets });

    const template = templateForIndustry(brief.data.industry);

    const linkUrl = `https://${brief.data.primaryDomain}`;
    const privacyPolicyUrl = `https://${brief.data.primaryDomain}/privacy`;

    // V1 caveat (documented in AdSetEditModal): the orchestrator
    // accepts one targeting spec per launch, so we apply the FIRST
    // ad set's audience to the whole campaign. Per-set targeting is
    // V1.1 — needs orchestrator changes to accept different specs
    // per ad set.
    const primaryAudience = activeAdSets[0].audience;
    const interestTokens = primaryAudience.interestKeywords
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 12);
    const fallbackInterestTokens =
      interestTokens.length > 0 ? interestTokens : [...template.interestTokens];

    const payload: LaunchCampaignPayload = {
      clientId,
      templateSlug: template.slug,
      campaignName: settings.campaignName,
      campaignObjective: 'lead_form_meta',
      pixelId: null,
      targeting: {
        geoCenter: null,
        radiusKm: primaryAudience.radiusKm,
        cities: [],
        interests: [],
        ageMin: primaryAudience.ageMin,
        ageMax: primaryAudience.ageMax,
        interestTokens: fallbackInterestTokens,
        countries: [settings.country],
      },
      dailyBudgetCents: settings.dailyBudgetCents,
      startTimeIso: new Date().toISOString(),
      endTimeIso: null,
      creative: {
        adFormat: 'single_image',
        images: distinctImages.map((imageUrl) => ({
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
      // Surface the error on the tree screen so the operator can
      // adjust budget / variants and retry without re-picking angles.
      setPhase({ kind: 'blueprint', settings, adSets });
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
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-10 md:py-10">
      <Header clientName={clientName} brief={brief.data ?? null} />

      {phase.kind === 'idle' && (
        <IdleState
          completeness={completenessData}
          onGenerate={handleGenerateClick}
          onCancel={onCancel}
          classicBuilderHref={classicBuilderHref}
        />
      )}

      {phase.kind === 'chat' && (
        <CampaignChat
          clientId={clientId}
          clientName={clientName}
          missing={phase.missing}
          onComplete={handleChatComplete}
          onCancel={handleChatCancel}
        />
      )}

      {phase.kind === 'blueprint' && (
        <CampaignBlueprint
          settings={phase.settings}
          adSets={phase.adSets}
          brief={buildBlueprintBrief(brief.data, clientId)}
          onSettingsChange={handleSettingsChange}
          onAdSetChange={handleAdSetChange}
          onCancel={onCancel}
          onLaunch={handleLaunch}
          launchPending={launchMutation.isPending}
          launchError={launchError}
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
  onGenerate,
  onCancel,
  classicBuilderHref,
}: {
  completeness: BriefCompleteness;
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onGenerate}
          className="h-12 px-7 text-[14px] font-semibold"
        >
          {softMissing && softMissing.length > 0
            ? `✦ Generate my ads — ${softMissing.length} gap${softMissing.length === 1 ? '' : 's'} to confirm first`
            : '✦ Generate my ads'}
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
        {'// ' + missing.length + ' GAP' + (missing.length === 1 ? '' : 'S') + ' TO CONFIRM'}
      </div>
      <p className="text-[13px] leading-snug text-ink-soft">
        Webnua AI will propose a fill for{' '}
        <strong className="font-semibold text-ink">
          {missing.map((f) => BRIEF_FIELD_LABEL[f]).join(', ')}
        </strong>{' '}
        on one screen — edit anything that doesn&rsquo;t fit, then we draft
        your ads. Each saves to your brand profile (
        <Link
          href="/settings/brand"
          className="font-medium text-rust underline-offset-4 hover:underline"
        >
          /settings/brand
        </Link>
        ) so we never ask again.
      </p>
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
  /** Brand accent colour — falls back to Webnua rust when blank.
   *  Drives the CTA button colour on MetaAdPreview. */
  accentColor: string;
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
          .select('audience_line, industry_category, accent_color')
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
        accent_color?: string | null;
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
        accentColor: brand?.accent_color?.trim() || '#d24317',
      };
    },
    enabled: clientId.length > 0,
  });
}

// --- helpers ---------------------------------------------------------------

function buildBlueprintBrief(
  brief: BriefContext | undefined,
  clientId: string,
): BlueprintBrief | null {
  if (!brief) return null;
  return {
    clientId,
    businessName: brief.businessName,
    industry: brief.industry,
    primaryDomain: brief.primaryDomain,
    accentColor: brief.accentColor,
  };
}

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
