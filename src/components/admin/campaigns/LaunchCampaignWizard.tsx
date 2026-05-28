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

import { CreativeTemplatePicker } from '@/components/admin/campaigns/CreativeTemplatePicker';
import { MetaAdPreview } from '@/components/admin/campaigns/MetaAdPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import {
  useClientMetaAdAccount,
  useDraftMetaAdVariants,
  useLaunchMetaCampaign,
  useListMetaPixels,
  useSearchMetaTargeting,
  useSelectMetaPixel,
  useUploadAdImage,
  type LaunchCampaignPayload,
  type MetaPixelOption,
  type TargetingSearchResult,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import {
  type AdCreativeVariant,
} from '@/lib/integrations/meta-ads/creative-draft';
import {
  coerceOverlayTo,
  composeToBlob,
  composeToDataUrl,
  defaultOverlayFor,
  validateOverlay,
  type CreativeBrandContext,
  type CreativeTemplateId,
  type CreativeTemplateOverlay,
} from '@/lib/integrations/meta-ads/creative-templates';
import {
  listTemplates,
  templateForIndustry,
  type MetaAdTemplate,
} from '@/lib/integrations/meta-ads/templates';
import { uploadCompositeBlob } from '@/lib/integrations/meta-ads/upload-composite';
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

  // step 1 — template + objective + (for landing-page) pixel
  templateSlug: string;
  /** Closed-set objective: in-Meta lead form (default) vs landing-page
   *  with Meta Pixel tracking. */
  campaignObjective: 'lead_form_meta' | 'lead_form_landing';
  /** Operator-confirmed Meta Pixel id when objective is
   *  'lead_form_landing'. NULL otherwise. */
  pixelId: string | null;

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

  // step 4 — matrix launch (Session 1.4). M copy variants × N images:
  // each variant becomes its own ad set; each image becomes an ad
  // inside every ad set. CBO at the campaign level distributes spend
  // across the M ad sets, so Meta finds the winning copy automatically.
  offerText: string;
  variants: Array<AdCreativeVariant & { selected: boolean }> | null;
  /** Index of the variant currently shown in the live preview. */
  selectedVariantIdx: number | null;
  /** V1.4 — N image variants (Supabase Storage urls). Each becomes an
   *  ad inside every ad set; matrix size = variants × images. V1.4b:
   *  each carries a creative-template overlay + an optional secondary
   *  base image (Quote Drop inset / Split second base) + a browser-
   *  rendered preview data URL. At launch time the composite is
   *  re-rendered to a Blob and uploaded; the resulting compositeUrl
   *  replaces `url` in the launch payload. */
  images: Array<{
    /** Raw uploaded base image URL (the operator's photo). */
    url: string;
    width: number | null;
    height: number | null;
    selected: boolean;
    /** V1.4b — creative template applied on top of the base. Default
     *  'plain' (no overlay). */
    templateId: CreativeTemplateId;
    /** V1.4b — the per-template overlay data. Discriminated by
     *  `overlay.kind` (matches templateId). */
    overlay: CreativeTemplateOverlay;
    /** V1.4b — optional secondary base image URL (Quote Drop inset
     *  photo, Split second base). */
    secondaryUrl: string | null;
    secondaryWidth: number | null;
    secondaryHeight: number | null;
    /** V1.4b — canvas-rendered preview as a data URL. Null while a
     *  render is in flight or before the first render. The MetaAdPreview
     *  falls back to `url` when this is null. */
    previewUrl: string | null;
    /** V1.4b — Storage URL of the composite uploaded at launch time.
     *  Null until the operator presses Launch. */
    compositeUrl: string | null;
  }>;
  /** Index of the image currently shown in the live preview. */
  selectedImageIdx: number | null;

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
          };
        });
      },
    );
  }, [clientId]);

  // Template-pick handler. Session 1.3: variants drive copy now —
  // picking a template doesn't pre-seed inline fields (there are no
  // inline fields anymore). The operator generates variants once
  // they reach step 4.
  function pickTemplate(slug: string) {
    setState((s) => ({ ...s, templateSlug: slug }));
  }

  // --- live composite preview ------------------------------------------------
  //
  // Whenever an image's templateId / overlay / secondaryUrl / base url
  // changes, re-render its composite to a data URL so the MetaAdPreview
  // shows the live result. Debounced 250ms to absorb typing bursts.
  // Renders one image at a time (the currently-previewed one wins) so
  // we don't burn CPU re-rendering every image on every keystroke.
  const renderTokenRef = useRef(0);
  useEffect(() => {
    if (state.step !== 4) return;
    if (state.images.length === 0) return;
    const targetIdx = state.selectedImageIdx ?? 0;
    const target = state.images[targetIdx];
    if (!target) return;
    if (target.previewUrl) return; // already rendered for the current overlay
    const brand: CreativeBrandContext = {
      accentColor: state.brand?.accent_color ?? '#d24317',
      brandName: state.client?.name ?? undefined,
    };
    const token = ++renderTokenRef.current;
    const handle = setTimeout(async () => {
      try {
        // Plain template: skip the canvas — the raw URL IS the preview.
        if (target.templateId === 'plain') {
          if (renderTokenRef.current !== token) return;
          setState((s) => ({
            ...s,
            images: s.images.map((img, i) =>
              i === targetIdx ? { ...img, previewUrl: img.url } : img,
            ),
          }));
          return;
        }
        // Skip the canvas when the overlay is unusable — fall back to
        // showing the raw image so the operator sees what they have.
        const validationError = validateOverlay(
          target.templateId,
          target.overlay,
          target.secondaryUrl,
        );
        if (validationError) {
          if (renderTokenRef.current !== token) return;
          setState((s) => ({
            ...s,
            images: s.images.map((img, i) =>
              i === targetIdx ? { ...img, previewUrl: img.url } : img,
            ),
          }));
          return;
        }
        const dataUrl = await composeToDataUrl({
          templateId: target.templateId,
          overlay: target.overlay,
          baseUrl: target.url,
          secondaryUrl: target.secondaryUrl,
          brand,
        });
        if (renderTokenRef.current !== token) return;
        setState((s) => ({
          ...s,
          images: s.images.map((img, i) =>
            i === targetIdx ? { ...img, previewUrl: dataUrl } : img,
          ),
        }));
      } catch {
        // Render failure → fall back to raw image. Surfaces the
        // underlying issue (CORS, bad URL, etc.) silently so the
        // wizard stays usable.
        if (renderTokenRef.current !== token) return;
        setState((s) => ({
          ...s,
          images: s.images.map((img, i) =>
            i === targetIdx ? { ...img, previewUrl: img.url } : img,
          ),
        }));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [state.step, state.images, state.selectedImageIdx, state.brand, state.client]);

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

  function brandContextForDraft() {
    const services =
      state.brand?.services && state.brand.services.length > 0
        ? state.brand.services
        : (state.brand?.top_jobs_to_be_booked ?? []);
    return {
      voiceFormality: state.brand?.voice_formality ?? undefined,
      voiceUrgency: state.brand?.voice_urgency ?? undefined,
      voiceTechnicality: state.brand?.voice_technicality ?? undefined,
      audienceLine: state.brand?.audience_line ?? undefined,
      services: services.length > 0 ? services : undefined,
      websiteHeroCopy: state.websiteHeroCopy || undefined,
      brandTagline: state.brandTagline || undefined,
    };
  }

  /** Initial generation — drafts the first 3 variants, all selected
   *  by default. Auto-fired on step 4 entry. */
  async function handleGenerateVariants() {
    if (state.offerText.trim().length === 0) return;
    try {
      const drafted = await draftMutation.mutateAsync({
        clientId,
        offer: state.offerText.trim(),
        templateSlug: state.templateSlug,
        businessName: state.client?.name ?? '',
        serviceArea: state.client?.service_area ?? '',
        count: 3,
        ...brandContextForDraft(),
      });
      const withSelected = drafted.map((v) => ({ ...v, selected: true }));
      setState((s) => ({
        ...s,
        variants: withSelected,
        selectedVariantIdx: withSelected.length > 0 ? 0 : null,
      }));
    } catch {
      // Error is exposed via draftMutation.error — UI surfaces it inline.
    }
  }

  /** Append N more variants (default 3) to the existing list. All new
   *  variants land selected; operator unticks any they don't want. */
  async function handleAddMoreVariants() {
    if (state.offerText.trim().length === 0) return;
    try {
      const drafted = await draftMutation.mutateAsync({
        clientId,
        offer: state.offerText.trim(),
        templateSlug: state.templateSlug,
        businessName: state.client?.name ?? '',
        serviceArea: state.client?.service_area ?? '',
        count: 3,
        ...brandContextForDraft(),
      });
      const appended = drafted.map((v) => ({ ...v, selected: true }));
      setState((s) => ({
        ...s,
        variants: [...(s.variants ?? []), ...appended],
      }));
    } catch {
      // surfaces via draftMutation.error
    }
  }

  /** Click a variant card → preview that variant in the live mockup.
   *  Does NOT toggle the variant's `selected` flag — selection is the
   *  checkbox on the card. */
  function handlePreviewVariant(idx: number) {
    if (state.variants == null) return;
    setState((s) => ({ ...s, selectedVariantIdx: idx }));
  }

  function handleToggleVariantSelected(idx: number, selected: boolean) {
    setState((s) => {
      if (!s.variants) return s;
      const next = s.variants.map((v, i) => (i === idx ? { ...v, selected } : v));
      return { ...s, variants: next };
    });
  }

  function handleSetAllSelected(selected: boolean) {
    setState((s) => {
      if (!s.variants) return s;
      return { ...s, variants: s.variants.map((v) => ({ ...v, selected })) };
    });
  }

  /** Append an image to the matrix. Operator uploads N images
   *  (1-5); each becomes its own ad inside every ad set. V1.4b: each
   *  image carries a creative-template overlay (default Plain) and
   *  the optional secondary-image axis Quote Drop + Split consume. */
  async function handleImagePick(file: File) {
    try {
      const uploaded = await uploadMutation.mutateAsync({ clientId, file });
      setState((s) => {
        const next = [
          ...s.images,
          {
            url: uploaded.url,
            width: uploaded.width,
            height: uploaded.height,
            selected: true,
            templateId: 'plain' as CreativeTemplateId,
            overlay: defaultOverlayFor('plain'),
            secondaryUrl: null,
            secondaryWidth: null,
            secondaryHeight: null,
            previewUrl: null,
            compositeUrl: null,
          },
        ];
        return {
          ...s,
          images: next,
          // First-upload auto-previews this image.
          selectedImageIdx: s.selectedImageIdx ?? next.length - 1,
        };
      });
    } catch {
      // uploadMutation.error surfaces in UI
    }
  }

  /** Operator picked a template for the currently-previewed image.
   *  Coerces the existing overlay onto the new shape (so a banner→quote
   *  switch preserves the text) and clears the previewUrl so the
   *  live-render effect re-renders against the new overlay. */
  function handlePickTemplate(imageIdx: number, templateId: CreativeTemplateId) {
    setState((s) => ({
      ...s,
      images: s.images.map((img, i) => {
        if (i !== imageIdx) return img;
        const overlay = coerceOverlayTo(templateId, img.overlay);
        return {
          ...img,
          templateId,
          overlay,
          previewUrl: null,
          compositeUrl: null,
        };
      }),
    }));
  }

  /** Operator edited the overlay of the currently-previewed image.
   *  Clears `previewUrl` so the live-render effect re-renders with
   *  the new overlay; clears `compositeUrl` so a stale Storage upload
   *  doesn't slip into the launch payload. */
  function handleChangeOverlay(
    imageIdx: number,
    next: CreativeTemplateOverlay,
  ) {
    setState((s) => ({
      ...s,
      images: s.images.map((img, i) =>
        i === imageIdx
          ? { ...img, overlay: next, previewUrl: null, compositeUrl: null }
          : img,
      ),
    }));
  }

  /** Operator picked a secondary base image (Quote Drop inset, Split
   *  second base). Uploads via the shared uploadMutation and stores the
   *  URL on the target image's secondaryUrl. */
  async function handlePickSecondary(imageIdx: number, file: File) {
    try {
      const uploaded = await uploadMutation.mutateAsync({ clientId, file });
      setState((s) => ({
        ...s,
        images: s.images.map((img, i) =>
          i === imageIdx
            ? {
                ...img,
                secondaryUrl: uploaded.url,
                secondaryWidth: uploaded.width,
                secondaryHeight: uploaded.height,
                previewUrl: null,
                compositeUrl: null,
              }
            : img,
        ),
      }));
    } catch {
      // surfaces via uploadMutation.error
    }
  }

  function handleClearSecondary(imageIdx: number) {
    setState((s) => ({
      ...s,
      images: s.images.map((img, i) =>
        i === imageIdx
          ? {
              ...img,
              secondaryUrl: null,
              secondaryWidth: null,
              secondaryHeight: null,
              previewUrl: null,
              compositeUrl: null,
            }
          : img,
      ),
    }));
  }

  function handleRemoveImage(idx: number) {
    setState((s) => {
      const next = s.images.filter((_, i) => i !== idx);
      let preview = s.selectedImageIdx;
      if (preview != null && preview >= next.length) preview = next.length - 1;
      if (next.length === 0) preview = null;
      return { ...s, images: next, selectedImageIdx: preview };
    });
  }

  function handleToggleImageSelected(idx: number, selected: boolean) {
    setState((s) => ({
      ...s,
      images: s.images.map((img, i) => (i === idx ? { ...img, selected } : img)),
    }));
  }

  function handlePreviewImage(idx: number) {
    setState((s) => ({ ...s, selectedImageIdx: idx }));
  }

  function handleSetAllImagesSelected(selected: boolean) {
    setState((s) => ({
      ...s,
      images: s.images.map((img) => ({ ...img, selected })),
    }));
  }

  // --- Launch ----------------------------------------------------------------

  // Track which image indices we're currently compositing so the launch
  // CTA can show "Compositing 2 of 3…" while the canvas + Storage work
  // runs in the background.
  const [compositingProgress, setCompositingProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [compositeError, setCompositeError] = useState<string | null>(null);

  async function handleLaunch() {
    if (!state.client) return;
    const selectedImages = state.images.filter((img) => img.selected);
    if (selectedImages.length === 0) return;
    if (!state.primaryDomain) return;
    // Defence-in-depth: refuse to launch when any selected image's
    // overlay is invalid (Split with no secondary, Quote Drop with
    // empty quote, etc.). Step-4 validation already catches this, but
    // an operator could click Launch with a stale state.
    for (const img of selectedImages) {
      const overlayErr = validateOverlay(
        img.templateId,
        img.overlay,
        img.secondaryUrl,
      );
      if (overlayErr) {
        setCompositeError(overlayErr);
        return;
      }
    }
    setCompositeError(null);
    // Compose + upload any composites that don't have a composite URL
    // yet. Plain images skip the canvas entirely — their raw URL IS
    // the image Meta sees.
    setCompositingProgress({ done: 0, total: selectedImages.length });
    const brand: CreativeBrandContext = {
      accentColor: state.brand?.accent_color ?? '#d24317',
      brandName: state.client?.name ?? undefined,
    };
    // Walk state.images in order so the per-index payload mapping below
    // stays stable. We mutate the in-flight state with composite URLs
    // so a retry doesn't re-render every composite.
    const updatedImages = [...state.images];
    for (let i = 0; i < updatedImages.length; i += 1) {
      const img = updatedImages[i];
      if (!img.selected) continue;
      if (img.templateId === 'plain') {
        updatedImages[i] = { ...img, compositeUrl: img.url };
        continue;
      }
      if (img.compositeUrl) continue; // already composited
      try {
        const blob = await composeToBlob({
          templateId: img.templateId,
          overlay: img.overlay,
          baseUrl: img.url,
          secondaryUrl: img.secondaryUrl,
          brand,
        });
        const uploaded = await uploadCompositeBlob(clientId, blob);
        if (!uploaded.ok) {
          setCompositeError(
            uploaded.error.message ??
              'Could not upload composite — try again.',
          );
          setCompositingProgress(null);
          return;
        }
        updatedImages[i] = { ...img, compositeUrl: uploaded.data.url };
        setCompositingProgress((p) =>
          p ? { ...p, done: p.done + 1 } : null,
        );
      } catch (e) {
        setCompositeError(
          e instanceof Error ? e.message : 'Could not render composite.',
        );
        setCompositingProgress(null);
        return;
      }
    }
    setState((s) => ({ ...s, images: updatedImages }));
    setCompositingProgress(null);

    const selectedComposed = updatedImages.filter((img) => img.selected);
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
    const selectedVariants = (state.variants ?? []).filter((v) => v.selected);
    if (selectedVariants.length === 0) return;
    const payload: LaunchCampaignPayload = {
      clientId,
      templateSlug: state.templateSlug,
      campaignName: state.campaignName,
      campaignObjective: state.campaignObjective,
      pixelId: state.pixelId,
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
        // V1.4b: send the composited image URL (compositeUrl) instead of
        // the raw upload. For Plain templates the compositeUrl was set
        // to the raw URL above so this collapses to the same payload
        // shape Session 1.4a sent.
        images: selectedComposed.map((img) => ({
          imageUrl: img.compositeUrl ?? img.url,
          imageWidth: img.width,
          imageHeight: img.height,
        })),
        variants: selectedVariants.map((v) => ({
          headline: v.headline,
          primaryText: v.primaryText,
          description:
            v.description && v.description.length > 0 ? v.description : null,
          ctaType: v.ctaType,
        })),
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
  const selectedImageCount = state.images.filter((img) => img.selected).length;
  const launchBlocked =
    selectedImageCount === 0 ||
    !state.client ||
    !state.primaryDomain ||
    !operatorId ||
    adAccount.data == null;

  return (
    <>
      <WizardHeader step={state.step} />
      <div className="px-4 py-6 pb-28 md:px-10 md:py-8 md:pb-32">
        {state.step === 1 ? (
            <Step1TemplateAndObjective
              clientId={clientId}
              templateSlug={state.templateSlug}
              setTemplateSlug={pickTemplate}
              clientIndustry={state.client?.industry ?? null}
              campaignObjective={state.campaignObjective}
              setCampaignObjective={(campaignObjective) =>
                setState((s) => ({
                  ...s,
                  campaignObjective,
                  pixelId:
                    campaignObjective === 'lead_form_landing' ? s.pixelId : null,
                }))
              }
              pixelId={state.pixelId}
              setPixelId={(pixelId) => setState((s) => ({ ...s, pixelId }))}
              primaryDomain={state.primaryDomain}
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
              onAddMore={handleAddMoreVariants}
              onPreviewVariant={handlePreviewVariant}
              onToggleVariantSelected={handleToggleVariantSelected}
              onSetAllSelected={handleSetAllSelected}
              onImagePick={handleImagePick}
              onRemoveImage={handleRemoveImage}
              onToggleImageSelected={handleToggleImageSelected}
              onPreviewImage={handlePreviewImage}
              onSetAllImagesSelected={handleSetAllImagesSelected}
              onPickTemplate={handlePickTemplate}
              onChangeOverlay={handleChangeOverlay}
              onPickSecondary={handlePickSecondary}
              onClearSecondary={handleClearSecondary}
              setOfferText={(offerText) =>
                setState((s) => ({
                  ...s,
                  offerText,
                  // Operator changed the offer — drop the existing
                  // variants so they re-generate against the new copy.
                  variants: null,
                  selectedVariantIdx: null,
                }))
              }
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
        compositingProgress={compositingProgress}
        compositeError={compositeError}
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
  compositingProgress,
  compositeError,
  onCancel,
  onBack,
  onContinue,
  onLaunch,
}: {
  step: Step;
  canContinue: boolean;
  launchPending: boolean;
  launchBlocked: boolean;
  compositingProgress: { done: number; total: number } | null;
  compositeError: string | null;
  onCancel: () => void;
  onBack: () => void;
  onContinue: () => void;
  onLaunch: () => void;
}) {
  // V1.4b: the launch button doubles as the compositing-progress label.
  // While `compositingProgress` is set the canvas + Storage work is
  // mid-flight (one composite per non-Plain image).
  const launching = launchPending || compositingProgress != null;
  let launchLabel = 'Launch campaign →';
  if (compositingProgress != null) {
    launchLabel = `Rendering composite ${compositingProgress.done + 1} of ${compositingProgress.total}…`;
  } else if (launchPending) {
    launchLabel = 'Launching…';
  }
  return (
    <div
      data-slot="wizard-footer"
      className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-paper-2 bg-paper px-4 py-3.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:px-10"
    >
      {compositeError && step === 5 ? (
        <div className="rounded-md bg-warn-soft px-3 py-2 text-[11px] text-warn">
          {compositeError}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
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
              disabled={launchBlocked || launching}
            >
              {launchLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- step 1 -----------------------------------------------------------------
//
// Composes the existing template grid + an objective picker
// (in-Meta lead form vs landing-page on the customer's site) + a
// pixel picker (only when objective is 'lead_form_landing'). The
// pixel picker calls the operator-only /api/integrations/meta_ads/pixels
// route on mount + auto-selects the only pixel when there's one;
// when multiple, the operator picks via dropdown; when zero, the step
// blocks with a "Set up a Meta Pixel first" empty state.

type ObjectiveOption = {
  id: 'lead_form_meta' | 'lead_form_landing';
  title: string;
  blurb: string;
  badge: string;
};

const OBJECTIVE_OPTIONS: ObjectiveOption[] = [
  {
    id: 'lead_form_meta',
    title: 'Lead form on Meta',
    blurb:
      'Visitor never leaves Meta — the form opens inline, prefilled with their Meta profile. Higher conversion at a slightly lower lead quality. Best default.',
    badge: 'Default',
  },
  {
    id: 'lead_form_landing',
    title: 'Lead form on landing page',
    blurb:
      "Ad routes to the customer's website. We embed the Meta Pixel so Meta optimises against your real Lead conversion. Higher lead quality, marginally lower volume. Needs a Pixel.",
    badge: 'Higher quality',
  },
];

function Step1TemplateAndObjective({
  clientId,
  templateSlug,
  setTemplateSlug,
  clientIndustry,
  campaignObjective,
  setCampaignObjective,
  pixelId,
  setPixelId,
  primaryDomain,
}: {
  clientId: string;
  templateSlug: string;
  setTemplateSlug: (slug: string) => void;
  clientIndustry: string | null;
  campaignObjective: 'lead_form_meta' | 'lead_form_landing';
  setCampaignObjective: (v: 'lead_form_meta' | 'lead_form_landing') => void;
  pixelId: string | null;
  setPixelId: (v: string | null) => void;
  primaryDomain: string | null;
}) {
  return (
    <div className="flex flex-col gap-7">
      <Step1Template
        value={templateSlug}
        onChange={setTemplateSlug}
        clientIndustry={clientIndustry}
      />
      <ObjectivePicker
        value={campaignObjective}
        onChange={setCampaignObjective}
        primaryDomain={primaryDomain}
      />
      {campaignObjective === 'lead_form_landing' ? (
        <PixelPicker clientId={clientId} value={pixelId} onChange={setPixelId} />
      ) : null}
    </div>
  );
}

function ObjectivePicker({
  value,
  onChange,
  primaryDomain,
}: {
  value: 'lead_form_meta' | 'lead_form_landing';
  onChange: (v: 'lead_form_meta' | 'lead_form_landing') => void;
  primaryDomain: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Where does the lead get captured?'}
        </label>
        <p className="text-[12px] text-ink-quiet">
          Both objectives optimise for leads — they differ in where the form
          lives and what data Meta sees to optimise against.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {OBJECTIVE_OPTIONS.map((opt) => {
          const selected = opt.id === value;
          const blocked = opt.id === 'lead_form_landing' && !primaryDomain;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !blocked && onChange(opt.id)}
              disabled={blocked}
              data-selected={selected ? 'true' : undefined}
              className="group flex flex-col gap-2 rounded-lg border border-rule bg-card px-4 py-3.5 text-left transition-colors hover:border-rust disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-rule data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-semibold text-ink">
                  {opt.title}
                </div>
                <div className="rounded-full bg-paper-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
                  {opt.badge}
                </div>
              </div>
              <div className="text-[12px] leading-snug text-ink-soft">
                {opt.blurb}
              </div>
              {blocked ? (
                <div className="mt-1 rounded-md bg-warn-soft px-2.5 py-1.5 text-[11px] text-warn">
                  Customer has no published site yet — publish first or use the
                  Meta lead form objective.
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PixelPicker({
  clientId,
  value,
  onChange,
}: {
  clientId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const list = useListMetaPixels();
  const select = useSelectMetaPixel();
  const [options, setOptions] = useState<MetaPixelOption[] | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    list
      .mutateAsync({ clientId })
      .then((pixels) => {
        setOptions(pixels);
        // Auto-select when there's exactly one — operator doesn't need
        // to make a non-decision.
        if (pixels.length === 1 && !value) {
          onChange(pixels[0].id);
          void select.mutateAsync({ clientId, pixelId: pixels[0].id });
        }
      })
      .catch(() => {
        setOptions([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function handlePick(pixelId: string) {
    onChange(pixelId);
    void select.mutateAsync({ clientId, pixelId });
  }

  if (options === null) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-rule bg-paper-2 px-4 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Meta Pixel'}
        </div>
        <div className="text-[12px] text-ink-quiet">
          Looking up Pixels on this client&apos;s ad account…
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-warn bg-warn-soft px-4 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-warn">
          {'// META PIXEL REQUIRED'}
        </div>
        <p className="text-[12px] text-ink">
          This customer&apos;s ad account has no Pixels. Set one up in Meta
          Events Manager first — then come back to this step and we&apos;ll
          pick it automatically.
        </p>
      </div>
    );
  }

  if (options.length === 1) {
    const only = options[0];
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-rust bg-rust-soft px-4 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
          {'// Meta Pixel · auto-selected'}
        </div>
        <div className="text-[14px] font-semibold text-ink">{only.name}</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          ID: {only.id}
          {only.lastFiredAt ? ' · Active' : ' · Never fired'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {'// Meta Pixel'}
      </label>
      <p className="text-[11px] text-ink-quiet">
        This ad account has more than one Pixel — pick the one that should
        fire when leads land on the customer&apos;s site.
      </p>
      <div className="flex flex-col gap-1.5">
        {options.map((p) => {
          const selected = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePick(p.id)}
              data-selected={selected ? 'true' : undefined}
              className="flex items-center justify-between gap-3 rounded-md border border-rule bg-card px-3 py-2 text-left transition-colors hover:border-rust data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft"
            >
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                  {p.id}
                  {p.lastFiredAt ? ' · Active' : ' · Never fired'}
                </span>
              </div>
              {selected ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-rust">
                  Selected
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  onAddMore,
  onPreviewVariant,
  onToggleVariantSelected,
  onSetAllSelected,
  onImagePick,
  onRemoveImage,
  onToggleImageSelected,
  onPreviewImage,
  onSetAllImagesSelected,
  onPickTemplate,
  onChangeOverlay,
  onPickSecondary,
  onClearSecondary,
  setOfferText,
}: {
  state: WizardState;
  draftPending: boolean;
  draftError: unknown;
  uploadPending: boolean;
  uploadError: unknown;
  onGenerate: () => void;
  onAddMore: () => void;
  onPreviewVariant: (idx: number) => void;
  onToggleVariantSelected: (idx: number, selected: boolean) => void;
  onSetAllSelected: (selected: boolean) => void;
  onImagePick: (file: File) => void;
  onRemoveImage: (idx: number) => void;
  onToggleImageSelected: (idx: number, selected: boolean) => void;
  onPreviewImage: (idx: number) => void;
  onSetAllImagesSelected: (selected: boolean) => void;
  onPickTemplate: (imageIdx: number, templateId: CreativeTemplateId) => void;
  onChangeOverlay: (imageIdx: number, overlay: CreativeTemplateOverlay) => void;
  onPickSecondary: (imageIdx: number, file: File) => void;
  onClearSecondary: (imageIdx: number) => void;
  setOfferText: (v: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variants = state.variants ?? [];
  const selectedCount = variants.filter((v) => v.selected).length;
  const allSelected = variants.length > 0 && selectedCount === variants.length;
  const previewIdx = state.selectedVariantIdx ?? 0;
  const previewVariant = variants[previewIdx];
  const selectedImageCount = state.images.filter((img) => img.selected).length;
  const allImagesSelected =
    state.images.length > 0 && selectedImageCount === state.images.length;

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
              {draftPending
                ? 'Generating…'
                : variants.length === 0
                  ? '✦ Generate 3 variants'
                  : '↻ Regenerate from offer'}
            </Button>
          </div>
          {draftError ? (
            <div className="rounded-md bg-warn-soft px-3 py-2 text-[12px] text-warn">
              {(draftError as Error).message ??
                'Could not generate variants — try regenerating in a moment.'}
            </div>
          ) : null}
        </div>

        {variants.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                {`// VARIANTS · ${selectedCount}/${variants.length} testing`}
              </label>
              <button
                type="button"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:underline"
                onClick={() => onSetAllSelected(!allSelected)}
              >
                {allSelected ? 'Untick all' : 'Test all'}
              </button>
            </div>
            <p className="text-[11px] text-ink-quiet">
              Each ticked variant launches as its own ad inside the same ad
              set. Meta auto-allocates spend to the best performer.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {variants.map((v, idx) => (
                <VariantCard
                  key={idx}
                  variant={v}
                  idx={idx}
                  isPreviewed={previewIdx === idx}
                  onToggle={(selected) => onToggleVariantSelected(idx, selected)}
                  onPreview={() => onPreviewVariant(idx)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 self-start"
              disabled={draftPending || state.offerText.trim().length < 5 || variants.length >= 10}
              onClick={onAddMore}
            >
              {draftPending
                ? 'Drafting…'
                : variants.length >= 10
                  ? 'Max 10 variants'
                  : '+ Draft 3 more variants'}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              {`// IMAGES · ${selectedImageCount}/${state.images.length} testing`}
            </label>
            {state.images.length > 0 ? (
              <button
                type="button"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:underline"
                onClick={() => onSetAllImagesSelected(!allImagesSelected)}
              >
                {allImagesSelected ? 'Untick all' : 'Test all'}
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-ink-quiet">
            Upload 1-5 images. Each becomes an ad inside every selected
            ad set — the matrix is{' '}
            <strong className="font-semibold text-ink">
              {selectedCount} copy × {selectedImageCount} image ={' '}
              {selectedCount * selectedImageCount} ads
            </strong>{' '}
            launching together.
            {selectedCount * selectedImageCount > 9 ? (
              <span className="text-warn">
                {' '}
                Meta optimises best with ≤9 cells — consider trimming.
              </span>
            ) : null}
          </p>

          {state.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {state.images.map((img, idx) => (
                <ImageCard
                  key={idx}
                  image={img}
                  idx={idx}
                  isPreviewed={state.selectedImageIdx === idx}
                  onToggle={(sel) => onToggleImageSelected(idx, sel)}
                  onPreview={() => onPreviewImage(idx)}
                  onRemove={() => onRemoveImage(idx)}
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPending || state.images.length >= 5}
            >
              {uploadPending
                ? 'Uploading…'
                : state.images.length >= 5
                  ? 'Max 5 images'
                  : state.images.length === 0
                    ? '+ Upload image'
                    : '+ Add another image'}
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              JPG/PNG · 4 MB each · 1.91:1 recommended
            </span>
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

        {/* --- creative template + overlay editor for the picked image --- */}
        {state.images.length > 0 && state.selectedImageIdx != null ? (
          <CreativeTemplatePicker
            templateId={
              state.images[state.selectedImageIdx]?.templateId ?? 'plain'
            }
            overlay={
              state.images[state.selectedImageIdx]?.overlay ?? {
                kind: 'plain',
              }
            }
            secondaryUrl={
              state.images[state.selectedImageIdx]?.secondaryUrl ?? null
            }
            onPickTemplate={(id) =>
              state.selectedImageIdx != null &&
              onPickTemplate(state.selectedImageIdx, id)
            }
            onChangeOverlay={(next) =>
              state.selectedImageIdx != null &&
              onChangeOverlay(state.selectedImageIdx, next)
            }
            onPickSecondary={(file) =>
              state.selectedImageIdx != null &&
              onPickSecondary(state.selectedImageIdx, file)
            }
            onClearSecondary={() =>
              state.selectedImageIdx != null &&
              onClearSecondary(state.selectedImageIdx)
            }
            secondaryUploadPending={uploadPending}
            secondaryUploadError={uploadError}
          />
        ) : null}
      </div>

      {/* --- right: live preview --- */}
      <div className="lg:sticky lg:top-0">
        <MetaAdPreview
          caption={
            variants.length > 0 || state.images.length > 0
              ? `// PREVIEW · COPY ${previewIdx + 1}${variants.length > 1 ? `/${variants.length}` : ''} × IMAGE ${(state.selectedImageIdx ?? 0) + 1}${state.images.length > 1 ? `/${state.images.length}` : ''}`
              : '// LIVE PREVIEW'
          }
          pageName={state.client?.name ?? 'Your Business'}
          pageLogoUrl={state.brand?.logo_url ?? null}
          primaryText={previewVariant?.primaryText ?? ''}
          headline={previewVariant?.headline ?? ''}
          description={previewVariant?.description ?? ''}
          ctaType={previewVariant?.ctaType ?? 'LEARN_MORE'}
          imageUrl={
            // V1.4b: prefer the canvas-rendered composite preview; falls
            // back to the raw upload until the first render completes.
            state.images[state.selectedImageIdx ?? 0]?.previewUrl ??
            state.images[state.selectedImageIdx ?? 0]?.url ??
            null
          }
          accentColor={state.brand?.accent_color ?? '#d24317'}
          linkHost={state.primaryDomain ?? undefined}
        />
      </div>
    </div>
  );
}

function ImageCard({
  image,
  idx,
  isPreviewed,
  onToggle,
  onPreview,
  onRemove,
}: {
  image: { url: string; width: number | null; height: number | null; selected: boolean };
  idx: number;
  isPreviewed: boolean;
  onToggle: (selected: boolean) => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      data-selected={image.selected ? 'true' : undefined}
      data-previewed={isPreviewed ? 'true' : undefined}
      className="group relative flex flex-col gap-1.5 rounded-lg border border-rule bg-card p-1.5 transition-colors data-[selected=true]:border-rust data-[previewed=true]:ring-2 data-[previewed=true]:ring-rust/30"
    >
      <button
        type="button"
        onClick={onPreview}
        className="relative aspect-[1.91/1] overflow-hidden rounded-md bg-paper-2"
        aria-label={`Preview image ${idx + 1}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!image.selected ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/60 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            Not testing
          </div>
        ) : null}
      </button>
      <div className="flex items-center justify-between gap-2 px-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink">
          <input
            type="checkbox"
            checked={image.selected}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer"
            aria-label={`Test image ${idx + 1}`}
          />
          <span className="font-mono uppercase tracking-[0.08em] text-ink-quiet">
            {`Img ${idx + 1}`}
          </span>
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-1.5 py-0.5 text-[14px] leading-none text-ink-quiet transition-colors hover:bg-paper-2 hover:text-warn"
          aria-label={`Remove image ${idx + 1}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function VariantCard({
  variant,
  idx,
  isPreviewed,
  onToggle,
  onPreview,
}: {
  variant: AdCreativeVariant & { selected: boolean };
  idx: number;
  isPreviewed: boolean;
  onToggle: (selected: boolean) => void;
  onPreview: () => void;
}) {
  return (
    <div
      data-selected={variant.selected ? 'true' : undefined}
      data-previewed={isPreviewed ? 'true' : undefined}
      className="flex items-start gap-3 rounded-lg border border-rule bg-card px-3 py-2.5 transition-colors data-[selected=true]:bg-rust-soft data-[selected=true]:border-rust data-[previewed=true]:ring-2 data-[previewed=true]:ring-rust/30"
    >
      <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={variant.selected}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
          aria-label={`Test variant ${idx + 1}`}
        />
      </label>
      <button
        type="button"
        onClick={onPreview}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {`Variant ${idx + 1}`}
            </span>
            <span className="text-[14px] font-semibold text-ink">
              {variant.headline}
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {variant.ctaType}
          </div>
        </div>
        <div className="text-[12px] text-ink-soft">{variant.primaryText}</div>
        {variant.description ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            {variant.description}
          </div>
        ) : null}
      </button>
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
  const selectedReviewVariants = (state.variants ?? []).filter((v) => v.selected);
  const selectedReviewImages = state.images.filter((img) => img.selected);
  const matrixSize = selectedReviewVariants.length * selectedReviewImages.length;
  const previewVariant =
    selectedReviewVariants[0] ??
    (state.variants?.[state.selectedVariantIdx ?? 0] ?? null);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <SummaryCard label="// TEMPLATE">
          <div className="text-[14px] font-semibold text-ink">{template.label}</div>
          <div className="text-[12px] text-ink-quiet">{template.blurb}</div>
        </SummaryCard>
        <SummaryCard label="// OBJECTIVE">
          <div className="text-[14px] font-semibold text-ink">
            {state.campaignObjective === 'lead_form_landing'
              ? 'Lead form on landing page'
              : 'Lead form on Meta'}
          </div>
          <div className="text-[12px] text-ink-quiet">
            {state.campaignObjective === 'lead_form_landing'
              ? state.pixelId
                ? `Meta Pixel ${state.pixelId} fires Lead event on form submit.`
                : 'No pixel — go back and pick one.'
              : 'Meta instant lead form — visitor never leaves Facebook / Instagram.'}
          </div>
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
        <SummaryCard
          label={`// MATRIX · ${selectedReviewVariants.length} COPY × ${selectedReviewImages.length} IMAGE = ${matrixSize} AD${matrixSize === 1 ? '' : 'S'}`}
        >
          {matrixSize === 0 ? (
            <div className="text-[12px] text-warn">
              {selectedReviewVariants.length === 0
                ? 'No copy variants selected — go back and pick at least one.'
                : 'No images selected — go back and pick at least one.'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  Copy variants ({selectedReviewVariants.length} ad set
                  {selectedReviewVariants.length === 1 ? '' : 's'})
                </div>
                {selectedReviewVariants.map((v, i) => (
                  <div key={i} className="flex flex-col gap-0.5 rounded-md bg-paper-2 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">
                        {v.headline}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                        {v.ctaType}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-soft">{v.primaryText}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  Images ({selectedReviewImages.length} ad
                  {selectedReviewImages.length === 1 ? '' : 's'} per ad set)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedReviewImages.map((img, i) => (
                    <div key={i} className="flex flex-col items-start gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl ?? img.url}
                        alt=""
                        className="h-16 w-[122px] rounded-md object-cover"
                      />
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quiet">
                        {img.templateId === 'plain'
                          ? 'Plain'
                          : `${img.templateId.replace('_', ' ')}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {matrixSize > 1 ? (
                <div className="text-[11px] text-ink-quiet">
                  Meta will A/B-test all {matrixSize} cells across{' '}
                  {selectedReviewVariants.length} ad set
                  {selectedReviewVariants.length === 1 ? '' : 's'}. CBO at
                  the campaign level distributes ${(state.dailyBudgetCents / 100).toFixed(0)}/day
                  across the ad sets — Meta auto-allocates spend to the
                  winning cell.
                </div>
              ) : null}
            </div>
          )}
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
          primaryText={previewVariant?.primaryText ?? ''}
          headline={previewVariant?.headline ?? ''}
          description={previewVariant?.description ?? ''}
          ctaType={previewVariant?.ctaType ?? 'LEARN_MORE'}
          imageUrl={
            // V1.4b: prefer the canvas-rendered composite preview.
            state.images.find((img) => img.selected)?.previewUrl ??
            state.images.find((img) => img.selected)?.url ??
            state.images[0]?.previewUrl ??
            state.images[0]?.url ??
            null
          }
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
    campaignObjective: 'lead_form_meta',
    pixelId: null,
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
    images: [],
    selectedImageIdx: null,
    isFirstLaunch: false,
    goLive: true,
  };
}

function isStepValid(s: WizardState): boolean {
  switch (s.step) {
    case 1:
      return (
        s.templateSlug.length > 0 &&
        // Landing-page objective requires a pixel resolved + persisted.
        // The pixel picker auto-selects when there's exactly one, so
        // this only blocks when the customer has no pixels at all.
        (s.campaignObjective !== 'lead_form_landing' || s.pixelId != null)
      );
    case 2:
      return s.country.length > 0 && s.ageMin >= 18 && s.ageMax >= s.ageMin;
    case 3:
      return (
        s.campaignName.trim().length > 0 &&
        s.dailyBudgetCents >= 100 &&
        (s.runUntilStopped || s.durationDays >= 1)
      );
    case 4: {
      // V1.4 matrix — step is valid when:
      //   • at least one image is selected (becomes the "ad" axis)
      //   • at least one variant is selected (becomes the "ad set" axis)
      //   • every selected variant carries headline + primaryText
      //   • V1.4b: every selected image's creative-template overlay is
      //     launch-valid (Split has a secondary, Quote Drop has a quote,
      //     Banner has text, Offer Card has a headline or subline).
      const selectedImages = s.images.filter((img) => img.selected);
      if (selectedImages.length === 0) return false;
      const selectedVariants = (s.variants ?? []).filter((v) => v.selected);
      if (selectedVariants.length === 0) return false;
      if (
        !selectedVariants.every(
          (v) =>
            v.headline.trim().length > 0 && v.primaryText.trim().length > 0,
        )
      ) {
        return false;
      }
      return selectedImages.every(
        (img) =>
          validateOverlay(img.templateId, img.overlay, img.secondaryUrl) ===
          null,
      );
    }
    case 5:
      return (
        s.primaryDomain != null &&
        s.images.some((img) => img.selected)
      );
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
