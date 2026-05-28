'use client';

// =============================================================================
// LaunchCampaignWizard — operator-only in-app Meta lead-form campaign builder.
//
// Phase 7.5 Session 1. Five steps, mounted as a Dialog (size lg):
//
//   1. Template     — industry-auto-selected from clients.industry
//   2. Geo          — country + optional lat/long + radius (operator
//                     can leave geo center null for country-level targeting)
//   3. Budget       — daily budget + duration in days
//   4. Offer + creative — operator types the offer, ✦ Generate 3 variants
//                     via Sonnet, picks one (per-field editable), uploads
//                     image, sees live Meta-feed-ad preview
//   5. Review       — full summary, first-launch checkbox, Launch button
//
// The launch route runs the orchestrator: 8-step Meta chain + 2 Webnua
// inserts (meta_campaigns + public.campaigns via upsert, then the
// per-launch meta_campaign_launches + meta_ad_creatives capture). On
// success the modal closes + routes to /campaigns with a green toast
// (TBD — for V1 the parent invalidates queries + closes; the new
// campaign appears in the roster immediately).
//
// Mounted by LaunchCampaignButton — opened with { open, onOpenChange, clientId }.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';

import { MetaAdPreview } from '@/components/admin/campaigns/MetaAdPreview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import {
  useClientMetaAdAccount,
  useDraftMetaAdVariants,
  useLaunchMetaCampaign,
  useUploadAdImage,
  type LaunchCampaignPayload,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client UUID — the wizard fetches brand + customer + website rows
   *  for substitution / privacy URL resolution. */
  clientId: string;
  /** Optional callback fired on successful launch. */
  onLaunched?: (result: { metaCampaignDbId: string; campaignId: string }) => void;
};

// --- state shape -------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | 5;

type WizardState = {
  step: Step;

  // resolved client context
  brand: BrandRow | null;
  client: ClientRow | null;
  primaryDomain: string | null;

  // step 1
  templateSlug: string;

  // step 2
  country: string;
  serviceAreaLabel: string;
  geoCenter: { lat: number; lng: number } | null;
  radiusKm: number;
  ageMin: number;
  ageMax: number;

  // step 3
  campaignName: string;
  dailyBudgetCents: number;
  durationDays: number;

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
  open,
  onOpenChange,
  clientId,
  onLaunched,
}: LaunchCampaignWizardProps) {
  const user = useUser();
  const adAccount = useClientMetaAdAccount(clientId);

  const draftMutation = useDraftMetaAdVariants();
  const uploadMutation = useUploadAdImage();
  const launchMutation = useLaunchMetaCampaign();

  const [state, setState] = useState<WizardState>(() => freshState());

  // Reset state when the dialog opens fresh.
  const lastOpenRef = useRef(false);
  useEffect(() => {
    if (open && !lastOpenRef.current) {
      setState(freshState());
      // Reset any in-flight mutation state too.
      draftMutation.reset();
      uploadMutation.reset();
      launchMutation.reset();
    }
    lastOpenRef.current = open;
  }, [open, draftMutation, uploadMutation, launchMutation]);

  // Resolve client context once the dialog opens.
  useEffect(() => {
    if (!open || !clientId) return;
    void resolveClientContext(clientId).then(({ brand, client, primaryDomain }) => {
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
          templateSlug: template.slug,
          serviceAreaLabel: client?.service_area ?? '',
          ageMin: template.defaultAgeMin,
          ageMax: template.defaultAgeMax,
          radiusKm: template.defaultRadiusKm,
          campaignName: defaultCampaignName(client, template),
          dailyBudgetCents: template.defaultDailyBudgetCents,
          offerText: offerDraft,
          headline: seeded.headline,
          primaryText: seeded.primaryText,
          description: seeded.description,
          ctaType: seeded.ctaType,
        };
      });
    });
  }, [open, clientId]);

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
      // Only re-seed fields the operator has not edited (variants null
      // = no AI draft has been picked, so the copy is still template
      // territory).
      const variantsActive = s.variants != null;
      return {
        ...s,
        templateSlug: slug,
        ageMin: s.ageMin === s.ageMin ? s.ageMin : template.defaultAgeMin,
        ageMax: s.ageMax === s.ageMax ? s.ageMax : template.defaultAgeMax,
        radiusKm: s.radiusKm === s.radiusKm ? s.radiusKm : template.defaultRadiusKm,
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
    try {
      const variants = await draftMutation.mutateAsync({
        clientId,
        offer: state.offerText.trim(),
        templateSlug: state.templateSlug,
        businessName: state.client?.name ?? '',
        serviceArea: state.client?.service_area ?? '',
        count: 3,
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
    const endTimeIso = new Date(
      now.getTime() + state.durationDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const payload: LaunchCampaignPayload = {
      clientId,
      templateSlug: state.templateSlug,
      campaignName: state.campaignName,
      targeting: {
        geoCenter: state.geoCenter,
        radiusKm: state.geoCenter ? state.radiusKm : null,
        ageMin: state.ageMin,
        ageMax: state.ageMax,
        interestTokens: templateForIndustry(state.templateSlug).interestTokens,
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
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        className="max-h-[calc(100vh-4rem)] gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Launch Meta campaign</DialogTitle>
        <WizardHeader step={state.step} />
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state.step === 1 ? (
            <Step1Template
              value={state.templateSlug}
              onChange={pickTemplate}
              clientIndustry={state.client?.industry ?? null}
            />
          ) : null}
          {state.step === 2 ? (
            <Step2Geo
              country={state.country}
              setCountry={(country) => setState((s) => ({ ...s, country }))}
              serviceAreaLabel={state.serviceAreaLabel}
              setServiceAreaLabel={(serviceAreaLabel) =>
                setState((s) => ({ ...s, serviceAreaLabel }))
              }
              geoCenter={state.geoCenter}
              setGeoCenter={(geoCenter) => setState((s) => ({ ...s, geoCenter }))}
              radiusKm={state.radiusKm}
              setRadiusKm={(radiusKm) => setState((s) => ({ ...s, radiusKm }))}
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
          onCancel={() => onOpenChange(false)}
          onBack={goBack}
          onContinue={goNext}
          onLaunch={handleLaunch}
        />
      </DialogContent>
    </Dialog>
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
    <div className="border-b border-paper-2 bg-paper-2 px-6 pb-3.5 pt-4">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {`// NEW META CAMPAIGN · STEP ${step} OF 5`}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          {STEP_LABELS[step]}
        </h2>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={
                i <= step
                  ? 'h-1.5 w-7 rounded-full bg-rust'
                  : 'h-1.5 w-7 rounded-full bg-rule'
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
    <div className="flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-6 py-3.5">
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
  country,
  setCountry,
  serviceAreaLabel,
  setServiceAreaLabel,
  geoCenter,
  setGeoCenter,
  radiusKm,
  setRadiusKm,
  ageMin,
  setAgeMin,
  ageMax,
  setAgeMax,
}: {
  country: string;
  setCountry: (v: string) => void;
  serviceAreaLabel: string;
  setServiceAreaLabel: (v: string) => void;
  geoCenter: { lat: number; lng: number } | null;
  setGeoCenter: (v: { lat: number; lng: number } | null) => void;
  radiusKm: number;
  setRadiusKm: (v: number) => void;
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
          {'// Service area (for the copy)'}
        </label>
        <Input
          value={serviceAreaLabel}
          onChange={(e) => setServiceAreaLabel(e.target.value)}
          placeholder="e.g. Cottesloe, Mosman Park, Claremont"
        />
        <p className="text-[11px] text-ink-quiet">
          Used in the ad copy (e.g. &quot;Plumber in {serviceAreaLabel || '{serviceArea}'}&quot;).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Geo-radius targeting (optional)'}
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Latitude"
            value={geoCenter?.lat ?? ''}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              const lng = geoCenter?.lng ?? NaN;
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                setGeoCenter({ lat, lng });
              } else if (!Number.isFinite(lat)) {
                setGeoCenter(null);
              }
            }}
          />
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Longitude"
            value={geoCenter?.lng ?? ''}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              const lat = geoCenter?.lat ?? NaN;
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                setGeoCenter({ lat, lng });
              } else if (!Number.isFinite(lng)) {
                setGeoCenter(null);
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={80}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value, 10) || 0)}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              km
            </span>
          </div>
        </div>
        <p className="text-[11px] text-ink-quiet">
          Leave lat/long blank for country-level targeting. V1.1 will geocode
          the service area automatically.
        </p>
      </div>

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

// --- step 3 -----------------------------------------------------------------

function Step3Budget({
  campaignName,
  setCampaignName,
  dailyBudgetCents,
  setDailyBudgetCents,
  durationDays,
  setDurationDays,
}: {
  campaignName: string;
  setCampaignName: (v: string) => void;
  dailyBudgetCents: number;
  setDailyBudgetCents: (v: number) => void;
  durationDays: number;
  setDurationDays: (v: number) => void;
}) {
  const totalDollars =
    ((dailyBudgetCents / 100) * durationDays).toFixed(2);
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

      <div className="flex flex-col gap-2">
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

      <div className="rounded-lg bg-paper-2 px-4 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// ESTIMATED TOTAL SPEND'}
        </div>
        <div className="mt-1 text-[18px] font-semibold text-ink">
          ${totalDollars}{' '}
          <span className="text-[12px] font-normal text-ink-quiet">
            ({(dailyBudgetCents / 100).toFixed(0)}/day × {durationDays} days)
          </span>
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
            {state.geoCenter
              ? ` · ${state.radiusKm}km around ${state.geoCenter.lat.toFixed(3)}, ${state.geoCenter.lng.toFixed(3)}`
              : ' · country-level'}
          </div>
          <div className="text-[12px] text-ink-quiet">
            Age {state.ageMin}-{state.ageMax} · {template.interestTokens.join(', ') || 'broad'}
          </div>
        </SummaryCard>
        <SummaryCard label="// BUDGET">
          <div className="text-[14px] text-ink">
            ${(state.dailyBudgetCents / 100).toFixed(0)}/day × {state.durationDays} days
          </div>
          <div className="text-[12px] text-ink-quiet">
            Estimated total spend: ${totalDollars}
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
    templateSlug: 'generic',
    country: 'AU',
    serviceAreaLabel: '',
    geoCenter: null,
    radiusKm: 25,
    ageMin: 25,
    ageMax: 65,
    campaignName: '',
    dailyBudgetCents: 3000,
    durationDays: 14,
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
        s.durationDays >= 1
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
}> {
  type SB = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: unknown }>;
          single?: () => Promise<{ data: unknown }>;
          is?: (col: string, val: unknown) => unknown;
        };
      };
    };
  };
  const sb = supabase as unknown as SB;
  const [brandRes, clientRes, websiteRes] = await Promise.all([
    sb
      .from('brands')
      .select('accent_color, logo_url, industry_category, offer, audience_line')
      .eq('client_id', clientId)
      .maybeSingle(),
    sb
      .from('clients')
      .select('name, industry, service_area')
      .eq('id', clientId)
      .maybeSingle(),
    sb
      .from('websites')
      .select('domain_primary')
      .eq('client_id', clientId)
      .maybeSingle(),
  ]);
  const brand = (brandRes.data as BrandRow | null) ?? null;
  const client = (clientRes.data as ClientRow | null) ?? null;
  const websiteRow = (websiteRes.data as { domain_primary?: string | null } | null) ?? null;
  return {
    brand,
    client,
    primaryDomain: websiteRow?.domain_primary ?? null,
  };
}
