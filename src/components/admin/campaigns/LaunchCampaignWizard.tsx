'use client';

// =============================================================================
// LaunchCampaignWizard — operator-only in-app Meta lead-form campaign builder.
//
// Phase 7.5 · Session 1.2. Originally mounted as a Dialog; promoted to a
// full page in Session 1.2 — the modal cramped the campaign-builder shape
// (5 steps × N inputs × live preview). Now lives at /campaigns/launch and
// renders inside the operator sidebar shell.
//
// Five steps:
//   1. Template     — industry-auto-selected from clients.industry
//   2. Geo          — country + Meta-resolved cities + interests + age
//   3. Budget       — daily budget + duration in days + run-until-stopped
//   4. Offer + creative — operator types the offer, ✦ Generate 3 variants
//                     via Sonnet, picks one (per-field editable), uploads
//                     image, sees live Meta-feed-ad preview
//   5. Review       — full summary, first-launch checkbox, Launch button
//
// The launch route runs the orchestrator: 8-step Meta chain + 2 Webnua
// inserts (meta_campaigns + public.campaigns via upsert, then the
// per-launch meta_campaign_launches + meta_ad_creatives capture). On
// success the page routes back to /campaigns (the parent's onLaunched
// callback handles navigation + cache invalidation).
//
// Mounted by app/campaigns/launch/page.tsx — props: { clientId, onCancel,
// onLaunched? }. No internal routing logic — the page owns nav.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';

import { MetaAdPreview } from '@/components/admin/campaigns/MetaAdPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import {
  useClientMetaAdAccount,
  useDraftMetaAdVariants,
  useLaunchMetaCampaign,
  useSearchMetaTargeting,
  useUploadAdImage,
  type LaunchCampaignPayload,
  type TargetingSearchResult,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import {
  type AdCreativeVariant,
} from '@/lib/integrations/meta-ads/creative-draft';
import {
  listTemplates,
  resolveTemplateCopy,
  templateForIndustry,
  type MetaAdTemplate,
} from '@/lib/integrations/meta-ads/templates';
import { supabase } from '@/lib/supabase/client';

// --- props -------------------------------------------------------------------

export type LaunchCampaignWizardProps = {
  /** Client UUID — the wizard fetches brand + customer + website rows
   *  for substitution / privacy URL resolution. */
  clientId: string;
  /** Called when operator hits Cancel. The page handles routing back
   *  to /campaigns. */
  onCancel: () => void;
  /** Called on successful launch. The page handles routing + cache
   *  invalidation. */
  onLaunched?: (result: { metaCampaignDbId: string; campaignId: string }) => void;
};

// --- state shape -------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | 5;

type PickedCity = { key: string; label: string; sublabel?: string; radiusKm: number };
type PickedInterest = { id: string; name: string; sublabel?: string };

type WizardState = {
  step: Step;

  // resolved client context
  brand: BrandRow | null;
  client: ClientRow | null;
  primaryDomain: string | null;
  /** Hero section copy from the customer's published home page —
   *  threaded into the draft prompt as positioning context. */
  websiteHeroCopy: string;
  /** Brand tagline (from brands.tagline) when set. */
  brandTagline: string;

  // step 1
  templateSlug: string;

  // step 2 — targeting now wires through Meta's resolved ids, not
  // free-text inputs.
  country: string;
  serviceAreaLabel: string;
  cities: PickedCity[];
  interests: PickedInterest[];
  ageMin: number;
  ageMax: number;

  // step 3
  campaignName: string;
  dailyBudgetCents: number;
  durationDays: number;
  /** When true the campaign runs until manually stopped (no end time
   *  sent to Meta) — winning ads keep delivering past an arbitrary
   *  duration. */
  runUntilStopped: boolean;

  // step 4
  offerText: string;
  variants: AdCreativeVariant[] | null;
  selectedVariantIdx: number | null;
  headline: string;
  primaryText: string;
  description: string;
  ctaType: string;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;

  // step 5
  isFirstLaunch: boolean;
  goLive: boolean;
};

type BrandRow = {
  accent_color: string | null;
  logo_url: string | null;
  industry_category: string | null;
  offer: { headline?: string; promise?: string; risk_reversal?: string; cta_text?: string } | null;
  audience_line: string | null;
  services?: string[] | null;
  top_jobs_to_be_booked?: string[] | null;
  voice_formality?: number | null;
  voice_urgency?: number | null;
  voice_technicality?: number | null;
  tagline?: string | null;
};

type ClientRow = {
  name: string;
  industry: string;
  service_area: string | null;
};

const COUNTRY_OPTIONS = [
  { code: 'AU', label: 'Australia' },
  { code: 'IE', label: 'Ireland' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'CA', label: 'Canada' },
];

// ---------------------------------------------------------------------------

export function LaunchCampaignWizard({
  clientId,
  onCancel,
  onLaunched,
}: LaunchCampaignWizardProps) {
  const user = useUser();
  const adAccount = useClientMetaAdAccount(clientId);

  const draftMutation = useDraftMetaAdVariants();
  const uploadMutation = useUploadAdImage();
  const launchMutation = useLaunchMetaCampaign();

  const [state, setState] = useState<WizardState>(() => freshState());

  // Resolve client context once on mount. The page is always "fresh" —
  // no open-state to track because the wizard IS the page now.
  useEffect(() => {
    if (!clientId) return;
    void resolveClientContext(clientId).then(
      ({ brand, client, primaryDomain, websiteHeroCopy, brandTagline }) => {
        setState((s) => {
          const template = templateForIndustry(
            brand?.industry_category ?? client?.industry ?? 'generic',
          );
          const offerDraft = composeDefaultOfferText(brand, client);
          const subs = {
            businessName: client?.name ?? '',
            serviceArea: client?.service_area ?? '',
          };
          const seeded = resolveTemplateCopy(template, subs);
          return {
            ...s,
            brand,
            client,
            primaryDomain,
            websiteHeroCopy,
            brandTagline,
            templateSlug: template.slug,
            serviceAreaLabel: client?.service_area ?? '',
            ageMin: template.defaultAgeMin,
            ageMax: template.defaultAgeMax,
            campaignName: defaultCampaignName(client, template),
            dailyBudgetCents: template.defaultDailyBudgetCents,
            offerText: offerDraft,
            headline: seeded.headline,
            primaryText: seeded.primaryText,
            description: seeded.description,
            ctaType: seeded.ctaType,
          };
        });
      },
    );
  }, [clientId]);

  // Template-pick handler — also re-seeds the copy fields from the new
  // template (preserves any operator edits that already have content).
  // Lives outside an effect so the lint rule "no setState in effect" is
  // satisfied; template change is a discrete user action, not a sync.
  function pickTemplate(slug: string) {
    setState((s) => {
      const template = templateForIndustry(slug);
      const subs = {
        businessName: s.client?.name ?? '',
        serviceArea: s.client?.service_area ?? '',
      };
      const seeded = resolveTemplateCopy(template, subs);
      const variantsActive = s.variants != null;
      return {
        ...s,
        templateSlug: slug,
        headline: variantsActive
          ? s.headline
          : s.headline.length === 0
            ? seeded.headline
            : s.headline,
        primaryText: variantsActive
          ? s.primaryText
          : s.primaryText.length === 0
            ? seeded.primaryText
            : s.primaryText,
        description: variantsActive
          ? s.description
          : s.description.length === 0
            ? seeded.description
            : s.description,
        ctaType:
          variantsActive || s.ctaType.length > 0 ? s.ctaType : seeded.ctaType,
      };
    });
  }

  // Auto-fire variant draft on step 4 entry. Tracked in a ref (not
  // state) so the effect doesn't have to setState — keeps the lint
  // rule "no setState in effect" happy and avoids a re-render cycle.
  // No reset needed — the page-mount lifetime IS the wizard lifetime.
  const autoVariantsFiredRef = useRef(false);
  useEffect(() => {
    if (state.step !== 4) return;
    if (autoVariantsFiredRef.current) return;
    if (state.offerText.trim().length < 5) return;
    if (draftMutation.isPending) return;
    autoVariantsFiredRef.current = true;
    void handleGenerateVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.offerText]);

  const stepValid = useMemo(() => isStepValid(state), [state]);
  const canContinue = stepValid;

  // --- Step navigation -------------------------------------------------------

  function goNext() {
    if (!canContinue) return;
    setState((s) => ({ ...s, step: Math.min(5, s.step + 1) as Step }));
  }
  function goBack() {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as Step }));
  }

  // --- Step 4 actions --------------------------------------------------------

  async function handleGenerateVariants() {
    if (state.offerText.trim().length === 0) return;
    const services =
      state.brand?.services && state.brand.services.length > 0
        ? state.brand.services
        : (state.brand?.top_jobs_to_be_booked ?? []);
    try {
      const variants = await draftMutation.mutateAsync({
        clientId,
        offer: state.offerText.trim(),
        templateSlug: state.templateSlug,
        businessName: state.client?.name ?? '',
        serviceArea: state.client?.service_area ?? '',
        count: 3,
        voiceFormality: state.brand?.voice_formality ?? undefined,
        voiceUrgency: state.brand?.voice_urgency ?? undefined,
        voiceTechnicality: state.brand?.voice_technicality ?? undefined,
        audienceLine: state.brand?.audience_line ?? undefined,
        services: services.length > 0 ? services : undefined,
        websiteHeroCopy: state.websiteHeroCopy || undefined,
        brandTagline: state.brandTagline || undefined,
      });
      setState((s) => ({
        ...s,
        variants,
        // Auto-select the first variant + populate the editable fields.
        selectedVariantIdx: variants.length > 0 ? 0 : null,
        headline: variants[0]?.headline ?? s.headline,
        primaryText: variants[0]?.primaryText ?? s.primaryText,
        description: variants[0]?.description ?? s.description,
        ctaType: variants[0]?.ctaType ?? s.ctaType,
      }));
    } catch {
      // Error is exposed via draftMutation.error — UI surfaces it inline.
    }
  }

  function handlePickVariant(idx: number) {
    if (state.variants == null) return;
    const v = state.variants[idx];
    if (!v) return;
    setState((s) => ({
      ...s,
      selectedVariantIdx: idx,
      headline: v.headline,
      primaryText: v.primaryText,
      description: v.description,
      ctaType: v.ctaType,
    }));
  }

  async function handleImagePick(file: File) {
    try {
      const uploaded = await uploadMutation.mutateAsync({ clientId, file });
      setState((s) => ({
        ...s,
        imageUrl: uploaded.url,
        imageWidth: uploaded.width,
        imageHeight: uploaded.height,
      }));
    } catch {
      // uploadMutation.error surfaces in UI
    }
  }

  // --- Launch ----------------------------------------------------------------

  async function handleLaunch() {
    if (!state.imageUrl || !state.client) return;
    if (!state.primaryDomain) return;
    const linkUrl = `https://${state.primaryDomain}`;
    const privacyPolicyUrl = `https://${state.primaryDomain}/privacy`;
    const now = new Date();
    const startTimeIso = now.toISOString();
    const endTimeIso = state.runUntilStopped
      ? null
      : new Date(now.getTime() + state.durationDays * 24 * 60 * 60 * 1000).toISOString();
    // Snapshot interest keyword tokens for training — pull from the
    // resolved interests' display names (more honest than the
    // template's default keyword list when the operator picked their
    // own interests via autocomplete).
    const interestTokens =
      state.interests.length > 0
        ? state.interests.map((i) => i.name)
        : templateForIndustry(state.templateSlug).interestTokens;
    const payload: LaunchCampaignPayload = {
      clientId,
      templateSlug: state.templateSlug,
      campaignName: state.campaignName,
      targeting: {
        geoCenter: null,
        radiusKm: null,
        cities: state.cities.map((c) => ({
          key: c.key,
          label: c.label,
          radiusKm: c.radiusKm,
        })),
        interests: state.interests.map((i) => ({ id: i.id, name: i.name })),
        ageMin: state.ageMin,
        ageMax: state.ageMax,
        interestTokens,
        countries: [state.country],
      },
      dailyBudgetCents: state.dailyBudgetCents,
      startTimeIso,
      endTimeIso,
      creative: {
        imageUrl: state.imageUrl,
        imageWidth: state.imageWidth,
        imageHeight: state.imageHeight,
        headline: state.headline,
        primaryText: state.primaryText,
        description: state.description.length > 0 ? state.description : null,
        ctaType: state.ctaType,
        linkUrl,
        privacyPolicyUrl,
      },
      isFirstLaunch: state.isFirstLaunch,
      goLive: state.goLive,
    };
    try {
      const result = await launchMutation.mutateAsync(payload);
      onLaunched?.({
        metaCampaignDbId: result.metaCampaignDbId,
        campaignId: result.campaignId,
      });
    } catch {
      // surfaces via launchMutation.error
    }
  }

  // --- Render ----------------------------------------------------------------

  // Operator user id is the audit attribution for the launch.
  const operatorId = user?.id ?? null;
  // Block launching if we have no operator id (defensive — the modal
  // should only mount for signed-in operators).
  const launchBlocked =
    !state.imageUrl ||
    !state.client ||
    !state.primaryDomain ||
    !operatorId ||
    adAccount.data == null;

  return (
    <>
      <WizardHeader step={state.step} />
      <div className="px-4 py-6 pb-28 md:px-10 md:py-8 md:pb-32">
        {state.step === 1 ? (
            <Step1Template
              value={state.templateSlug}
              onChange={pickTemplate}
              clientIndustry={state.client?.industry ?? null}
            />
          ) : null}
          {state.step === 2 ? (
            <Step2Geo
              clientId={clientId}
              country={state.country}
              setCountry={(country) => setState((s) => ({ ...s, country }))}
              serviceAreaLabel={state.serviceAreaLabel}
              setServiceAreaLabel={(serviceAreaLabel) =>
                setState((s) => ({ ...s, serviceAreaLabel }))
              }
              cities={state.cities}
              setCities={(cities) => setState((s) => ({ ...s, cities }))}
              interests={state.interests}
              setInterests={(interests) => setState((s) => ({ ...s, interests }))}
              ageMin={state.ageMin}
              setAgeMin={(ageMin) => setState((s) => ({ ...s, ageMin }))}
              ageMax={state.ageMax}
              setAgeMax={(ageMax) => setState((s) => ({ ...s, ageMax }))}
            />
          ) : null}
          {state.step === 3 ? (
            <Step3Budget
              campaignName={state.campaignName}
              setCampaignName={(campaignName) =>
                setState((s) => ({ ...s, campaignName }))
              }
              dailyBudgetCents={state.dailyBudgetCents}
              setDailyBudgetCents={(dailyBudgetCents) =>
                setState((s) => ({ ...s, dailyBudgetCents }))
              }
              durationDays={state.durationDays}
              setDurationDays={(durationDays) =>
                setState((s) => ({ ...s, durationDays }))
              }
              runUntilStopped={state.runUntilStopped}
              setRunUntilStopped={(runUntilStopped) =>
                setState((s) => ({ ...s, runUntilStopped }))
              }
            />
          ) : null}
          {state.step === 4 ? (
            <Step4Creative
              state={state}
              draftPending={draftMutation.isPending}
              draftError={draftMutation.error}
              uploadPending={uploadMutation.isPending}
              uploadError={uploadMutation.error}
              onGenerate={handleGenerateVariants}
              onPickVariant={handlePickVariant}
              onImagePick={handleImagePick}
              setOfferText={(offerText) =>
                setState((s) => ({ ...s, offerText, variants: null, selectedVariantIdx: null }))
              }
              setHeadline={(headline) =>
                setState((s) => ({ ...s, headline, selectedVariantIdx: null }))
              }
              setPrimaryText={(primaryText) =>
                setState((s) => ({ ...s, primaryText, selectedVariantIdx: null }))
              }
              setDescription={(description) =>
                setState((s) => ({ ...s, description, selectedVariantIdx: null }))
              }
              setCtaType={(ctaType) => setState((s) => ({ ...s, ctaType }))}
            />
          ) : null}
          {state.step === 5 ? (
            <Step5Review
              state={state}
              isFirstLaunch={state.isFirstLaunch}
              setIsFirstLaunch={(isFirstLaunch) =>
                setState((s) => ({ ...s, isFirstLaunch }))
              }
              goLive={state.goLive}
              setGoLive={(goLive) => setState((s) => ({ ...s, goLive }))}
              launchError={launchMutation.error}
            />
          ) : null}
        </div>
      <WizardFooter
        step={state.step}
        canContinue={canContinue}
        launchPending={launchMutation.isPending}
        launchBlocked={launchBlocked}
        onCancel={onCancel}
        onBack={goBack}
        onContinue={goNext}
        onLaunch={handleLaunch}
      />
    </>
  );
}

// --- header + footer chrome -------------------------------------------------

const STEP_LABELS: Record<Step, string> = {
  1: 'Template',
  2: 'Geography',
  3: 'Budget',
  4: 'Offer & creative',
  5: 'Review & launch',
};

function WizardHeader({ step }: { step: Step }) {
  return (
    <div className="border-b border-paper-2 bg-paper px-4 pb-5 pt-6 md:px-10 md:pt-8">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {`// NEW META CAMPAIGN · STEP ${step} OF 5`}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink md:text-[32px]">
          {STEP_LABELS[step]}
        </h1>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={
                i <= step
                  ? 'h-1.5 w-8 rounded-full bg-rust'
                  : 'h-1.5 w-8 rounded-full bg-rule'
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WizardFooter({
  step,
  canContinue,
  launchPending,
  launchBlocked,
  onCancel,
  onBack,
  onContinue,
  onLaunch,
}: {
  step: Step;
  canContinue: boolean;
  launchPending: boolean;
  launchBlocked: boolean;
  onCancel: () => void;
  onBack: () => void;
  onContinue: () => void;
  onLaunch: () => void;
}) {
  return (
    <div
      data-slot="wizard-footer"
      className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-4 py-3.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:px-10"
    >
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <div className="flex items-center gap-2">
        {step > 1 ? (
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
        ) : null}
        {step < 5 ? (
          <Button type="button" onClick={onContinue} disabled={!canContinue}>
            Continue →
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onLaunch}
            disabled={launchBlocked || launchPending}
          >
            {launchPending ? 'Launching…' : 'Launch campaign →'}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- step 1 -----------------------------------------------------------------

function Step1Template({
  value,
  onChange,
  clientIndustry,
}: {
  value: string;
  onChange: (slug: string) => void;
  clientIndustry: string | null;
}) {
  const templates = useMemo(() => listTemplates(), []);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-soft">
        Pre-selected from this customer&apos;s industry
        {clientIndustry ? (
          <>
            {' ('}
            <strong className="text-ink">{clientIndustry}</strong>
            {')'}
          </>
        ) : null}
        . Pick a different template if a sibling trade fits the offer better.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => onChange(t.slug)}
            data-selected={value === t.slug ? 'true' : undefined}
            className="group flex flex-col gap-1 rounded-lg border border-rule bg-card px-4 py-3 text-left transition-colors hover:border-rust data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
              {t.slug}
            </div>
            <div className="text-[14px] font-semibold text-ink">{t.label}</div>
            <div className="text-[12px] text-ink-quiet">{t.blurb}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              <span>
                BUDGET ${(t.defaultDailyBudgetCents / 100).toFixed(0)}/day
              </span>
              <span>RADIUS {t.defaultRadiusKm}km</span>
              <span>
                AGE {t.defaultAgeMin}-{t.defaultAgeMax}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- step 2 -----------------------------------------------------------------

function Step2Geo({
  clientId,
  country,
  setCountry,
  serviceAreaLabel,
  setServiceAreaLabel,
  cities,
  setCities,
  interests,
  setInterests,
  ageMin,
  setAgeMin,
  ageMax,
  setAgeMax,
}: {
  clientId: string;
  country: string;
  setCountry: (v: string) => void;
  serviceAreaLabel: string;
  setServiceAreaLabel: (v: string) => void;
  cities: PickedCity[];
  setCities: (v: PickedCity[]) => void;
  interests: PickedInterest[];
  setInterests: (v: PickedInterest[]) => void;
  ageMin: number;
  setAgeMin: (v: number) => void;
  ageMax: number;
  setAgeMax: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Country'}
        </label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-[14px] text-ink"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} ({c.code})
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink-quiet">
          The country your customer&apos;s leads should come from. Required.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Service area (for the ad copy)'}
        </label>
        <Input
          value={serviceAreaLabel}
          onChange={(e) => setServiceAreaLabel(e.target.value)}
          placeholder="e.g. Cottesloe, Mosman Park, Claremont"
        />
        <p className="text-[11px] text-ink-quiet">
          Used in the ad copy only (&quot;Plumber in {serviceAreaLabel || '{serviceArea}'}&quot;) — not for targeting.
        </p>
      </div>

      <CityAutocomplete
        clientId={clientId}
        country={country}
        picked={cities}
        onChange={setCities}
      />

      <InterestAutocomplete
        clientId={clientId}
        picked={interests}
        onChange={setInterests}
      />

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Age range'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-quiet">Min</span>
            <Input
              type="number"
              min={18}
              max={65}
              value={ageMin}
              onChange={(e) =>
                setAgeMin(parseInt(e.target.value, 10) || 18)
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-quiet">Max</span>
            <Input
              type="number"
              min={ageMin}
              max={65}
              value={ageMax}
              onChange={(e) =>
                setAgeMax(parseInt(e.target.value, 10) || ageMin)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- targeting autocomplete components --------------------------------------
//
// City + interest pickers wired to Meta's /search endpoint via the
// targeting-search route. Debounce at 300ms; minimum 2-char query;
// results render in a popover under the input; clicking a result adds
// it to the picked list. Picked items render as removable chips.
// V1: pick one city + N interests; per-city radius is editable inline.

function CityAutocomplete({
  clientId,
  country,
  picked,
  onChange,
}: {
  clientId: string;
  country: string;
  picked: PickedCity[];
  onChange: (next: PickedCity[]) => void;
}) {
  return (
    <TargetingPicker
      label="// Cities (radius targeting)"
      hint="Type a city name — Meta resolves to its targeting id automatically. Leave blank for country-level."
      placeholder="e.g. Perth, Dublin, Manchester"
      clientId={clientId}
      country={country}
      type="cities"
      picked={picked.map((c) => ({
        id: c.key,
        label: c.label,
        sublabel: c.sublabel,
      }))}
      onAdd={(result) => {
        if (picked.some((c) => c.key === result.id)) return;
        onChange([
          ...picked,
          { key: result.id, label: result.label, sublabel: result.sublabel, radiusKm: 25 },
        ]);
      }}
      onRemove={(id) => onChange(picked.filter((c) => c.key !== id))}
      renderPickedExtras={(id) => {
        const city = picked.find((c) => c.key === id);
        if (!city) return null;
        return (
          <div className="flex items-center gap-1.5 border-l border-ink/10 pl-2 text-[11px] text-ink-soft">
            <Input
              type="number"
              min={1}
              max={80}
              value={city.radiusKm}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10) || 1;
                onChange(
                  picked.map((c) =>
                    c.key === id ? { ...c, radiusKm: Math.max(1, Math.min(80, next)) } : c,
                  ),
                );
              }}
              className="h-7 w-14 px-1.5 text-center text-[12px]"
            />
            <span className="font-mono uppercase tracking-[0.08em]">km</span>
          </div>
        );
      }}
    />
  );
}

function InterestAutocomplete({
  clientId,
  picked,
  onChange,
}: {
  clientId: string;
  picked: PickedInterest[];
  onChange: (next: PickedInterest[]) => void;
}) {
  return (
    <TargetingPicker
      label="// Interests (optional)"
      hint="Type a keyword — Meta returns matching audience interests. Leave blank for broad targeting."
      placeholder="e.g. home improvement, plumbing, renovations"
      clientId={clientId}
      type="interests"
      picked={picked.map((i) => ({
        id: i.id,
        label: i.name,
        sublabel: i.sublabel,
      }))}
      onAdd={(result) => {
        if (picked.some((i) => i.id === result.id)) return;
        onChange([
          ...picked,
          { id: result.id, name: result.label, sublabel: result.sublabel },
        ]);
      }}
      onRemove={(id) => onChange(picked.filter((i) => i.id !== id))}
    />
  );
}

function TargetingPicker({
  label,
  hint,
  placeholder,
  clientId,
  country,
  type,
  picked,
  onAdd,
  onRemove,
  renderPickedExtras,
}: {
  label: string;
  hint: string;
  placeholder: string;
  clientId: string;
  country?: string;
  type: 'cities' | 'interests';
  picked: Array<{ id: string; label: string; sublabel?: string }>;
  onAdd: (result: TargetingSearchResult) => void;
  onRemove: (id: string) => void;
  renderPickedExtras?: (id: string) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetingSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const search = useSearchMetaTargeting();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    // No setState here when the query is too short — the render
    // derives an empty display list from query length below; that
    // way we don't trigger a re-render just to clear state, and the
    // lint rule "no setState in effect" stays satisfied.
    if (query.trim().length < 2) return;
    debounceTimer.current = setTimeout(async () => {
      try {
        const next = await search.mutateAsync({
          clientId,
          type,
          query: query.trim(),
          countryCode: country,
        });
        setResults(next);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, type, clientId, country]);
  // Hide results the moment the query falls below the minimum length —
  // derived during render so it doesn't need a setState in the effect.
  const displayResults: TargetingSearchResult[] =
    query.trim().length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </label>
      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-rule bg-card px-2.5 py-1.5 text-[12px]"
            >
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-ink">{p.label}</span>
                {p.sublabel ? (
                  <span className="text-[10px] text-ink-quiet">{p.sublabel}</span>
                ) : null}
              </div>
              {renderPickedExtras?.(p.id)}
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="ml-1 rounded-md px-1.5 py-0.5 text-[14px] leading-none text-ink-quiet transition-colors hover:bg-paper-2 hover:text-warn"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
        />
        {focused && (query.trim().length >= 2 || search.isPending) ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-rule bg-card shadow-card">
            {search.isPending ? (
              <div className="px-3 py-2 text-[12px] text-ink-quiet">Searching…</div>
            ) : displayResults.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-ink-quiet">
                No matches in Meta for &quot;{query.trim()}&quot;.
              </div>
            ) : (
              displayResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd(r);
                    setQuery('');
                  }}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-paper-2 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-paper-2"
                >
                  <span className="text-[13px] font-semibold text-ink">{r.label}</span>
                  {r.sublabel ? (
                    <span className="text-[11px] text-ink-quiet">{r.sublabel}</span>
                  ) : null}
                  {r.audienceSize ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                      Audience: {formatAudienceSize(r.audienceSize.lower)}–
                      {formatAudienceSize(r.audienceSize.upper)}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      <p className="text-[11px] text-ink-quiet">{hint}</p>
    </div>
  );
}

function formatAudienceSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// --- step 3 -----------------------------------------------------------------

function Step3Budget({
  campaignName,
  setCampaignName,
  dailyBudgetCents,
  setDailyBudgetCents,
  durationDays,
  setDurationDays,
  runUntilStopped,
  setRunUntilStopped,
}: {
  campaignName: string;
  setCampaignName: (v: string) => void;
  dailyBudgetCents: number;
  setDailyBudgetCents: (v: number) => void;
  durationDays: number;
  setDurationDays: (v: number) => void;
  runUntilStopped: boolean;
  setRunUntilStopped: (v: boolean) => void;
}) {
  const totalDollars = ((dailyBudgetCents / 100) * durationDays).toFixed(2);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Campaign name (internal)'}
        </label>
        <Input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
        />
        <p className="text-[11px] text-ink-quiet">
          Shown in Webnua + Meta Ads Manager. Not user-facing.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Daily budget'}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-ink-quiet">$</span>
          <Input
            type="number"
            min={1}
            value={(dailyBudgetCents / 100).toFixed(0)}
            onChange={(e) =>
              setDailyBudgetCents(
                Math.max(100, Math.round(parseFloat(e.target.value) * 100) || 0),
              )
            }
            className="max-w-[160px]"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            /day
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-rule bg-card px-4 py-3">
        <label className="flex items-start gap-2.5 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={runUntilStopped}
            onChange={(e) => setRunUntilStopped(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Run until manually stopped
            <span className="block text-[11px] text-ink-quiet">
              Webnua&apos;s Ad AI (monitored by humans) will optimise this
              campaign or turn it off if lead cost rises too high. You can
              manually turn this off whenever you want.
            </span>
          </span>
        </label>

        {runUntilStopped ? null : (
          <div className="flex flex-col gap-2 border-t border-paper-2 pt-2.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              {'// Duration (days)'}
            </label>
            <Input
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) =>
                setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="max-w-[160px]"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg bg-paper-2 px-4 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {runUntilStopped
            ? '// DAILY SPEND'
            : '// ESTIMATED TOTAL SPEND'}
        </div>
        <div className="mt-1 text-[18px] font-semibold text-ink">
          {runUntilStopped ? (
            <>
              ${(dailyBudgetCents / 100).toFixed(0)}
              <span className="text-[12px] font-normal text-ink-quiet">
                {' '}
                /day · indefinite
              </span>
            </>
          ) : (
            <>
              ${totalDollars}{' '}
              <span className="text-[12px] font-normal text-ink-quiet">
                ({(dailyBudgetCents / 100).toFixed(0)}/day × {durationDays} days)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- step 4 -----------------------------------------------------------------

function Step4Creative({
  state,
  draftPending,
  draftError,
  uploadPending,
  uploadError,
  onGenerate,
  onPickVariant,
  onImagePick,
  setOfferText,
  setHeadline,
  setPrimaryText,
  setDescription,
  setCtaType,
}: {
  state: WizardState;
  draftPending: boolean;
  draftError: unknown;
  uploadPending: boolean;
  uploadError: unknown;
  onGenerate: () => void;
  onPickVariant: (idx: number) => void;
  onImagePick: (file: File) => void;
  setOfferText: (v: string) => void;
  setHeadline: (v: string) => void;
  setPrimaryText: (v: string) => void;
  setDescription: (v: string) => void;
  setCtaType: (v: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      {/* --- left: inputs --- */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            {'// The offer'}
          </label>
          <Textarea
            rows={3}
            value={state.offerText}
            onChange={(e) => setOfferText(e.target.value)}
            placeholder="e.g. Free same-day quote on emergency electrical work in Cottesloe & Mosman Park — 2-hour response or your callout fee is on us."
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-quiet">
              Used to draft variants. Be specific — pain + outcome + reversal.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="h-8"
              disabled={draftPending || state.offerText.trim().length < 5}
              onClick={onGenerate}
            >
              {draftPending ? 'Generating…' : '✦ Generate 3 variants'}
            </Button>
          </div>
          {draftError ? (
            <div className="rounded-md bg-warn-soft px-3 py-2 text-[12px] text-warn">
              {(draftError as Error).message ??
                'Could not generate variants — type the fields manually instead.'}
            </div>
          ) : null}
        </div>

        {state.variants ? (
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              {'// Pick a variant'}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {state.variants.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onPickVariant(idx)}
                  data-selected={
                    state.selectedVariantIdx === idx ? 'true' : undefined
                  }
                  className="flex flex-col gap-1 rounded-lg border border-rule bg-card px-3 py-2.5 text-left transition-colors hover:border-rust data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-semibold text-ink">
                      {v.headline}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                      {v.ctaType}
                    </div>
                  </div>
                  <div className="text-[12px] text-ink-soft">{v.primaryText}</div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          <FieldRow label="Headline (≤ 40)" max={40} value={state.headline} onChange={setHeadline} />
          <FieldRow
            label="Primary text (≤ 125)"
            max={125}
            value={state.primaryText}
            onChange={setPrimaryText}
            textarea
          />
          <FieldRow
            label="Description (≤ 27)"
            max={27}
            value={state.description}
            onChange={setDescription}
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              {'// CTA button'}
            </label>
            <select
              value={state.ctaType}
              onChange={(e) => setCtaType(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-[14px] text-ink"
            >
              <option value="LEARN_MORE">Learn more</option>
              <option value="BOOK_NOW">Book now</option>
              <option value="GET_QUOTE">Get quote</option>
              <option value="CONTACT_US">Contact us</option>
              <option value="SIGN_UP">Sign up</option>
              <option value="GET_OFFER">Get offer</option>
              <option value="APPLY_NOW">Apply now</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            {'// Image'}
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPending}
            >
              {uploadPending
                ? 'Uploading…'
                : state.imageUrl
                  ? 'Replace image'
                  : 'Upload image'}
            </Button>
            {state.imageUrl ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-good">
                ✓ {state.imageWidth}×{state.imageHeight}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                JPG/PNG · 4 MB max · 1.91:1 recommended
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImagePick(file);
                e.target.value = '';
              }}
            />
          </div>
          {uploadError ? (
            <div className="rounded-md bg-warn-soft px-3 py-2 text-[12px] text-warn">
              {(uploadError as Error).message ?? 'Upload failed.'}
            </div>
          ) : null}
        </div>
      </div>

      {/* --- right: live preview --- */}
      <div className="lg:sticky lg:top-0">
        <MetaAdPreview
          caption="// LIVE PREVIEW"
          pageName={state.client?.name ?? 'Your Business'}
          pageLogoUrl={state.brand?.logo_url ?? null}
          primaryText={state.primaryText}
          headline={state.headline}
          description={state.description}
          ctaType={state.ctaType}
          imageUrl={state.imageUrl}
          accentColor={state.brand?.accent_color ?? '#d24317'}
          linkHost={state.primaryDomain ?? undefined}
        />
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  max,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  textarea?: boolean;
}) {
  const tooLong = value.length > max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {`// ${label}`}
        </label>
        <span
          className={
            tooLong
              ? 'font-mono text-[10px] uppercase tracking-[0.08em] text-warn'
              : 'font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet'
          }
        >
          {value.length}/{max}
        </span>
      </div>
      {textarea ? (
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// --- step 5 -----------------------------------------------------------------

function Step5Review({
  state,
  isFirstLaunch,
  setIsFirstLaunch,
  goLive,
  setGoLive,
  launchError,
}: {
  state: WizardState;
  isFirstLaunch: boolean;
  setIsFirstLaunch: (v: boolean) => void;
  goLive: boolean;
  setGoLive: (v: boolean) => void;
  launchError: unknown;
}) {
  const totalDollars = ((state.dailyBudgetCents / 100) * state.durationDays).toFixed(2);
  const template = templateForIndustry(state.templateSlug);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <SummaryCard label="// TEMPLATE">
          <div className="text-[14px] font-semibold text-ink">{template.label}</div>
          <div className="text-[12px] text-ink-quiet">{template.blurb}</div>
        </SummaryCard>
        <SummaryCard label="// TARGETING">
          <div className="text-[14px] text-ink">
            {state.country}
            {state.cities.length > 0
              ? ` · ${state.cities.map((c) => `${c.label} (${c.radiusKm}km)`).join(', ')}`
              : ' · country-level'}
          </div>
          <div className="text-[12px] text-ink-quiet">
            Age {state.ageMin}-{state.ageMax}
            {state.interests.length > 0
              ? ` · ${state.interests.map((i) => i.name).join(', ')}`
              : ' · broad'}
          </div>
        </SummaryCard>
        <SummaryCard label="// BUDGET">
          <div className="text-[14px] text-ink">
            ${(state.dailyBudgetCents / 100).toFixed(0)}/day{' '}
            {state.runUntilStopped
              ? '· run until manually stopped'
              : `× ${state.durationDays} days`}
          </div>
          <div className="text-[12px] text-ink-quiet">
            {state.runUntilStopped
              ? 'No end date — winning ads keep delivering.'
              : `Estimated total spend: $${totalDollars}`}
          </div>
        </SummaryCard>
        <SummaryCard label="// CREATIVE">
          <div className="text-[14px] font-semibold text-ink">{state.headline}</div>
          <div className="text-[12px] text-ink-soft">{state.primaryText}</div>
          <div className="text-[11px] text-ink-quiet">
            {state.description} · CTA: {state.ctaType}
          </div>
        </SummaryCard>
        <SummaryCard label="// DESTINATION">
          <div className="text-[14px] text-ink">
            {state.primaryDomain ? `https://${state.primaryDomain}` : 'No published site'}
          </div>
          <div className="text-[12px] text-ink-quiet">
            Privacy URL: {state.primaryDomain ? `https://${state.primaryDomain}/privacy` : '— required'}
          </div>
          {!state.primaryDomain ? (
            <div className="mt-1.5 rounded-md bg-warn-soft px-3 py-2 text-[12px] text-warn">
              This customer has no published website. Meta requires a real
              privacy URL on the ad. Publish their site first, then come back.
            </div>
          ) : null}
        </SummaryCard>

        <div className="flex flex-col gap-2 rounded-lg border border-rule bg-card px-4 py-3">
          <label className="flex items-start gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={isFirstLaunch}
              onChange={(e) => setIsFirstLaunch(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              First campaign Webnua has launched for this customer
              <span className="block text-[11px] text-ink-quiet">
                Audit flag only — tags the campaign as
                {' '}<code className="rounded bg-paper-2 px-1 font-mono text-[10px]">webnua_month_1</code>{' '}
                instead of <code className="rounded bg-paper-2 px-1 font-mono text-[10px]">webnua_ongoing</code>.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={goLive}
              onChange={(e) => setGoLive(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Activate the campaign on Meta right away
              <span className="block text-[11px] text-ink-quiet">
                Off = the campaign builds paused, no spend until you activate
                it from /campaigns or Ads Manager.
              </span>
            </span>
          </label>
        </div>

        {launchError ? (
          <div className="rounded-lg bg-warn-soft px-4 py-3 text-[13px] text-warn">
            <div className="font-semibold">Launch failed.</div>
            <div className="mt-0.5 text-[12px]">
              {(launchError as Error).message ?? 'Unknown error.'}
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-0">
        <MetaAdPreview
          caption="// FINAL PREVIEW"
          pageName={state.client?.name ?? 'Your Business'}
          pageLogoUrl={state.brand?.logo_url ?? null}
          primaryText={state.primaryText}
          headline={state.headline}
          description={state.description}
          ctaType={state.ctaType}
          imageUrl={state.imageUrl}
          accentColor={state.brand?.accent_color ?? '#d24317'}
          linkHost={state.primaryDomain ?? undefined}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-rule bg-card px-4 py-3">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function freshState(): WizardState {
  return {
    step: 1,
    brand: null,
    client: null,
    primaryDomain: null,
    websiteHeroCopy: '',
    brandTagline: '',
    templateSlug: 'generic',
    country: 'AU',
    serviceAreaLabel: '',
    cities: [],
    interests: [],
    ageMin: 25,
    ageMax: 65,
    campaignName: '',
    dailyBudgetCents: 3000,
    durationDays: 14,
    runUntilStopped: false,
    offerText: '',
    variants: null,
    selectedVariantIdx: null,
    headline: '',
    primaryText: '',
    description: '',
    ctaType: 'LEARN_MORE',
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    isFirstLaunch: false,
    goLive: true,
  };
}

function isStepValid(s: WizardState): boolean {
  switch (s.step) {
    case 1:
      return s.templateSlug.length > 0;
    case 2:
      return s.country.length > 0 && s.ageMin >= 18 && s.ageMax >= s.ageMin;
    case 3:
      return (
        s.campaignName.trim().length > 0 &&
        s.dailyBudgetCents >= 100 &&
        (s.runUntilStopped || s.durationDays >= 1)
      );
    case 4:
      return (
        s.imageUrl != null &&
        s.headline.trim().length > 0 &&
        s.primaryText.trim().length > 0 &&
        s.headline.length <= 40 &&
        s.primaryText.length <= 125 &&
        s.description.length <= 27
      );
    case 5:
      return s.primaryDomain != null && s.imageUrl != null;
    default:
      return false;
  }
}

function defaultCampaignName(
  client: ClientRow | null,
  template: MetaAdTemplate,
): string {
  const name = client?.name ?? 'Campaign';
  const ts = new Date().toISOString().slice(0, 10);
  return `${name} · ${template.label} · ${ts}`;
}

function composeDefaultOfferText(brand: BrandRow | null, client: ClientRow | null): string {
  if (brand?.offer && (brand.offer.headline || brand.offer.promise)) {
    const parts: string[] = [];
    if (brand.offer.headline) parts.push(brand.offer.headline);
    if (brand.offer.promise) parts.push(brand.offer.promise);
    if (brand.offer.risk_reversal) parts.push(brand.offer.risk_reversal);
    return parts.join(' — ');
  }
  if (client?.name && client?.service_area) {
    return `${client.name} — local ${client.industry} in ${client.service_area}. Fast response, fixed-price quote, no surprises on the invoice.`;
  }
  return '';
}

// --- supabase reads --------------------------------------------------------

async function resolveClientContext(clientId: string): Promise<{
  brand: BrandRow | null;
  client: ClientRow | null;
  primaryDomain: string | null;
  websiteHeroCopy: string;
  brandTagline: string;
}> {
  type SB = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: unknown }>;
        };
      };
    };
  };
  const sb = supabase as unknown as SB;
  const [brandRes, clientRes, websiteRes] = await Promise.all([
    sb
      .from('brands')
      .select(
        'accent_color, logo_url, industry_category, offer, audience_line, services, top_jobs_to_be_booked, voice_formality, voice_urgency, voice_technicality, tagline',
      )
      .eq('client_id', clientId)
      .maybeSingle(),
    sb
      .from('clients')
      .select('name, industry, service_area')
      .eq('id', clientId)
      .maybeSingle(),
    sb
      .from('websites')
      .select('domain_primary, draft_version_id')
      .eq('client_id', clientId)
      .maybeSingle(),
  ]);
  const brand = (brandRes.data as BrandRow | null) ?? null;
  const client = (clientRes.data as ClientRow | null) ?? null;
  const websiteRow =
    (websiteRes.data as {
      domain_primary?: string | null;
      draft_version_id?: string | null;
    } | null) ?? null;

  // Best-effort hero-copy extraction from the home page's draft
  // snapshot. The Sonnet variant drafter consumes this as positioning
  // context so the generated copy matches the customer's own framing
  // instead of inventing a fresh angle.
  let websiteHeroCopy = '';
  if (websiteRow?.draft_version_id) {
    const versionRes = await sb
      .from('website_versions')
      .select('snapshot')
      .eq('id', websiteRow.draft_version_id)
      .maybeSingle();
    websiteHeroCopy = extractHomeHeroCopy(
      (versionRes.data as { snapshot?: unknown } | null)?.snapshot,
    );
  }

  return {
    brand,
    client,
    primaryDomain: websiteRow?.domain_primary ?? null,
    websiteHeroCopy,
    brandTagline: typeof brand?.tagline === 'string' ? brand.tagline : '',
  };
}

/** Walk a Version snapshot to find the home page's hero section and
 *  join its eyebrow + headline + sub into a single context string the
 *  variant draft prompt consumes. Best-effort — returns '' when the
 *  snapshot is missing, malformed, or has no hero section.
 *
 *  Snapshot shape per CLAUDE.md: `{ pages, header, footer, nav, pageOrder }`
 *  where each page has `{ slug, type, sections: Section[] }` and each
 *  section has `{ type, data }`. Hero section type = 'hero' with data
 *  fields `eyebrow`, `headline`, `sub`. */
function extractHomeHeroCopy(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const pages = (snapshot as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return '';
  // Prefer the page with type='home'; fall back to the first page.
  const homePage =
    pages.find(
      (p): p is { sections?: unknown[] } =>
        p != null && typeof p === 'object' && (p as { type?: unknown }).type === 'home',
    ) ?? (pages[0] as { sections?: unknown[] } | undefined);
  const sections = homePage?.sections;
  if (!Array.isArray(sections)) return '';
  const heroSection = sections.find(
    (s): s is { data?: Record<string, unknown> } =>
      s != null && typeof s === 'object' && (s as { type?: unknown }).type === 'hero',
  );
  const data = heroSection?.data;
  if (!data || typeof data !== 'object') return '';
  const parts: string[] = [];
  for (const key of ['eyebrow', 'headline', 'sub'] as const) {
    const v = (data as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim().length > 0) parts.push(v.trim());
  }
  return parts.join(' · ');
}
