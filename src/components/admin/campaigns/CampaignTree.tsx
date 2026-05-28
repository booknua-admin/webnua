'use client';

// =============================================================================
// CampaignTree — pre-launch visual tree of what's about to ship to Meta.
//
// Phase 7.5 · Session 2.3. Replaces the flat "review" screen from
// Session 2.1's polish pass. After the operator picks angles, the
// Generate surface lands here:
//
//   Campaign · "Brand · Industry · YYYY-MM-DD"        [name][budget][country]
//      │
//      ├── Ad set 1 · Pain-led    · N variants   [edit ▾]
//      ├── Ad set 2 · Outcome-led · N variants   [edit ▾]
//      └── Ad set 3 · Trust-led   · N variants   [edit ▾]
//
// Each ad-set node expands inline to show its variants — each variant is
// editable (headline / primaryText / description) and tickable (untick to
// drop that ad from the launch). Campaign-level edits (name / daily ad
// spend / country) live on the root card.
//
// Launch fires from this surface. Per-ad-set image overrides + adding new
// variants are V1.1 — V1 inherits the angle's drafted variants + the
// shared stock image set.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';

import { MetaAdPreview } from './MetaAdPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { resolveIndustryTemplate } from '@/lib/website/industry-templates';

// --- types ------------------------------------------------------------------

export type CtaType =
  | 'LEARN_MORE'
  | 'BOOK_NOW'
  | 'GET_QUOTE'
  | 'CONTACT_US'
  | 'SIGN_UP'
  | 'GET_OFFER'
  | 'APPLY_NOW';

const CTA_OPTIONS: readonly CtaType[] = [
  'LEARN_MORE',
  'BOOK_NOW',
  'GET_QUOTE',
  'CONTACT_US',
  'GET_OFFER',
  'SIGN_UP',
  'APPLY_NOW',
];

/** Editable knobs at the campaign root — same shape Session 2.1
 *  shipped on the review screen. The tree just hosts them on the root
 *  node. */
export type LaunchSettings = {
  campaignName: string;
  /** Daily budget in MINOR units (cents / pence). */
  dailyBudgetCents: number;
  /** ISO country code Meta uses for geo_locations.countries[]. */
  country: string;
};

export type VariantDraft = {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
  selected: boolean;
};

export type AdSetDraft = {
  /** Stable id from Session 2.1's GeneratedAngle.id (pain / outcome / trust). */
  angleId: string;
  label: string;
  rationale: string;
  variants: VariantDraft[];
};

export type CampaignTreeBrief = {
  businessName: string;
  industry: string;
  primaryDomain: string | null;
};

export type CampaignTreeProps = {
  settings: LaunchSettings;
  adSets: AdSetDraft[];
  brief: CampaignTreeBrief | null;
  /** Replace settings (campaign root edits). */
  onSettingsChange: (next: LaunchSettings) => void;
  /** Replace a single ad-set draft (variant edit / toggle). */
  onAdSetChange: (next: AdSetDraft) => void;
  /** Operator backed out — return to the angle picker. */
  onBack: () => void;
  /** Cancel out of the surface entirely (→ /campaigns). */
  onCancel: () => void;
  /** Fire the launch — parent owns the orchestrator call. */
  onLaunch: () => void;
  /** True while the orchestrator is mid-chain. Disables every edit +
   *  the launch button. */
  launchPending: boolean;
  /** Inline error from a previous launch attempt — surfaced above the
   *  action band so the operator can adjust + retry. */
  launchError?: { message: string; detail?: string } | null;
  /** Escape hatch to the five-step builder. */
  classicBuilderHref: string;
};

// --- country options (mirrors GenerateAdsView's COUNTRY_OPTIONS) -----------

const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; label: string; currency: string }> = [
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'IE', label: 'Ireland', currency: 'EUR' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
];

function currencyForCountry(country: string): string {
  return COUNTRY_OPTIONS.find((c) => c.code === country)?.currency ?? '';
}

// --- main component --------------------------------------------------------

export function CampaignTree({
  settings,
  adSets,
  brief,
  onSettingsChange,
  onAdSetChange,
  onBack,
  onCancel,
  onLaunch,
  launchPending,
  launchError,
  classicBuilderHref,
}: CampaignTreeProps) {
  const [openAdSetId, setOpenAdSetId] = useState<string | null>(null);

  const selectedVariantCount = adSets.reduce(
    (sum, a) => sum + a.variants.filter((v) => v.selected).length,
    0,
  );
  const adSetsWithSelectedVariants = adSets.filter((a) =>
    a.variants.some((v) => v.selected),
  );
  const currency = currencyForCountry(settings.country);
  const dailyBudgetMajor = settings.dailyBudgetCents / 100;
  const budgetTooLow = settings.dailyBudgetCents < 500;
  const launchDisabled =
    launchPending ||
    budgetTooLow ||
    adSetsWithSelectedVariants.length === 0 ||
    selectedVariantCount === 0;
  const fourteenDayCap = Math.round(dailyBudgetMajor * 14);

  // Live-preview variant — first SELECTED variant of the first ad set
  // that has at least one. Falls back to the first ad set's first
  // variant when everything is unticked (the operator sees what would
  // ship if they re-selected). Avoids a blank preview area mid-edit.
  const previewSource = pickPreviewVariant(adSets);
  const industry = brief ? resolveIndustryTemplate(brief.industry) : null;
  const previewImage = industry?.stockImages.hero ?? null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          Review &amp; launch
        </h2>
        <p className="text-[13px] leading-snug text-ink-soft">
          One last check. Click any ad set to edit its variants. Confirm
          your daily ad spend at the root — Meta starts spending the moment
          you launch.
        </p>
      </header>

      <CampaignRootCard
        settings={settings}
        onChange={onSettingsChange}
        currency={currency}
        budgetTooLow={budgetTooLow}
        fourteenDayCap={fourteenDayCap}
        adSetCount={adSetsWithSelectedVariants.length}
        totalAds={selectedVariantCount}
        disabled={launchPending}
      />

      {/* Connector line — mono blueprint vocabulary, decorative. */}
      <div className="relative ml-6 -mt-2 mb-1 h-3 w-[2px] bg-rule" aria-hidden />

      <div className="flex flex-col gap-3">
        {adSets.map((adSet) => (
          <AdSetCard
            key={adSet.angleId}
            adSet={adSet}
            open={openAdSetId === adSet.angleId}
            onToggleOpen={() =>
              setOpenAdSetId((prev) =>
                prev === adSet.angleId ? null : adSet.angleId,
              )
            }
            onChange={onAdSetChange}
            disabled={launchPending}
          />
        ))}
      </div>

      {previewSource ? (
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// WHAT MOST PEOPLE WILL SEE · '}
            <span className="text-rust">{previewSource.adSet.label}</span>
          </div>
          <div className="max-w-[420px]">
            <MetaAdPreview
              pageName={brief?.businessName ?? 'Your business'}
              pageLogoUrl={null}
              primaryText={previewSource.variant.primaryText}
              headline={previewSource.variant.headline}
              description={previewSource.variant.description}
              ctaType={previewSource.variant.ctaType}
              imageUrl={previewImage ?? ''}
              linkHost={brief?.primaryDomain ?? undefined}
            />
          </div>
          <p className="text-[12px] leading-snug text-ink-quiet">
            Meta auto-rotates between every selected variant. This is one
            example of what your audience sees first.
          </p>
        </div>
      ) : null}

      {launchError ? (
        <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn-soft/40 px-4 py-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            {'// LAUNCH FAILED'}
          </div>
          <p className="text-[13px] leading-snug text-ink">{launchError.message}</p>
          {launchError.detail ? (
            <p className="mt-1 text-[12px] leading-snug text-ink-soft">{launchError.detail}</p>
          ) : null}
        </div>
      ) : null}

      <LaunchBand
        currency={currency}
        dailyBudgetMajor={dailyBudgetMajor}
        adSetCount={adSetsWithSelectedVariants.length}
        totalAds={selectedVariantCount}
        launchDisabled={launchDisabled}
        launchPending={launchPending}
        onBack={onBack}
        onCancel={onCancel}
        onLaunch={onLaunch}
        classicBuilderHref={classicBuilderHref}
      />
    </section>
  );
}

// --- root node --------------------------------------------------------------

function CampaignRootCard({
  settings,
  onChange,
  currency,
  budgetTooLow,
  fourteenDayCap,
  adSetCount,
  totalAds,
  disabled,
}: {
  settings: LaunchSettings;
  onChange: (next: LaunchSettings) => void;
  currency: string;
  budgetTooLow: boolean;
  fourteenDayCap: number;
  adSetCount: number;
  totalAds: number;
  disabled: boolean;
}) {
  const dailyBudgetMajor = settings.dailyBudgetCents / 100;

  function handleBudgetChange(major: number) {
    if (!Number.isFinite(major)) return;
    const cents = Math.max(0, Math.round(major * 100));
    onChange({ ...settings, dailyBudgetCents: cents });
  }

  return (
    <div className="rounded-2xl border border-rust/50 bg-card px-5 py-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// CAMPAIGN'}
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-ink">
            {adSetCount} ad set{adSetCount === 1 ? '' : 's'} ·{' '}
            <strong className="font-semibold text-ink">{totalAds}</strong> ad
            {totalAds === 1 ? '' : 's'} ready
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          ROOT
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldRow label="Campaign name" sub="What you'll see in Meta Ads Manager.">
          <Input
            type="text"
            value={settings.campaignName}
            onChange={(e) => onChange({ ...settings, campaignName: e.target.value })}
            disabled={disabled}
            aria-label="Campaign name"
          />
        </FieldRow>

        <FieldRow
          label="Daily ad spend"
          sub={`Meta caps each day at this amount${currency ? ` (${currency})` : ''}.`}
        >
          <div className="flex items-stretch overflow-hidden rounded-md border border-rule bg-paper/40 focus-within:border-rust focus-within:ring-1 focus-within:ring-rust">
            <span className="flex items-center justify-center bg-paper-2 px-3 font-mono text-[12px] font-semibold text-ink-quiet">
              {currency || '$'}
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={Number.isFinite(dailyBudgetMajor) ? dailyBudgetMajor : ''}
              onChange={(e) => handleBudgetChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full bg-transparent px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-quiet disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Daily ad spend"
            />
            <span className="flex items-center bg-paper-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              / day
            </span>
          </div>
          {budgetTooLow ? (
            <p className="mt-1 text-[12px] leading-snug text-warn">
              Meta needs at least {currency || '$'}5/day to deliver any
              meaningful number of impressions.
            </p>
          ) : (
            <p className="mt-1 text-[12px] leading-snug text-ink-quiet">
              First 14 days cap at roughly{' '}
              <strong className="font-semibold text-ink">
                {currency || '$'}
                {fourteenDayCap.toLocaleString()}
              </strong>
              .
            </p>
          )}
        </FieldRow>

        <FieldRow label="Country" sub="Meta's geo target + your billing currency.">
          <select
            value={settings.country}
            onChange={(e) => onChange({ ...settings, country: e.target.value })}
            disabled={disabled}
            className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Country"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.currency})
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      <p className="mt-4 border-t border-paper-2 pt-3 text-[11px] leading-snug text-ink-quiet">
        Other settings (in-Meta lead form, run-until-stopped, age range,
        targeting) use Webnua defaults. Need more control? Use the{' '}
        <strong className="font-semibold text-ink">classic builder</strong>{' '}
        link below.
      </p>
    </div>
  );
}

// --- ad-set node ------------------------------------------------------------

const ANGLE_TONE: Record<string, { eyebrow: string; chipBg: string; chipText: string }> = {
  pain: {
    eyebrow: '// PAIN-LED',
    chipBg: 'bg-warn-soft',
    chipText: 'text-warn',
  },
  outcome: {
    eyebrow: '// OUTCOME-LED',
    chipBg: 'bg-good-soft',
    chipText: 'text-good',
  },
  trust: {
    eyebrow: '// TRUST-LED',
    chipBg: 'bg-info-soft',
    chipText: 'text-info',
  },
};

const ANGLE_FALLBACK_TONE = {
  eyebrow: '// ANGLE',
  chipBg: 'bg-paper-2',
  chipText: 'text-ink',
};

function AdSetCard({
  adSet,
  open,
  onToggleOpen,
  onChange,
  disabled,
}: {
  adSet: AdSetDraft;
  open: boolean;
  onToggleOpen: () => void;
  onChange: (next: AdSetDraft) => void;
  disabled: boolean;
}) {
  const tone = ANGLE_TONE[adSet.angleId] ?? ANGLE_FALLBACK_TONE;
  const selectedCount = adSet.variants.filter((v) => v.selected).length;
  const totalCount = adSet.variants.length;
  const dim = selectedCount === 0;

  function handleVariantChange(index: number, patch: Partial<VariantDraft>) {
    onChange({
      ...adSet,
      variants: adSet.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      ),
    });
  }

  return (
    <div
      className={`rounded-xl border border-rule bg-card ${
        dim ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-paper/40"
      >
        <span
          className={`inline-flex items-center rounded-full ${tone.chipBg} px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone.chipText}`}
        >
          {tone.eyebrow}
        </span>
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-ink">{adSet.label}</span>
          <span className="text-[12px] leading-snug text-ink-quiet">
            {selectedCount === totalCount ? (
              <>
                {totalCount} variant{totalCount === 1 ? '' : 's'} · all selected
              </>
            ) : (
              <>
                {selectedCount} of {totalCount} variant{totalCount === 1 ? '' : 's'} selected
              </>
            )}
          </span>
        </span>
        <span className="ml-auto font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
          {open ? 'Close ↑' : 'Edit ↓'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-paper-2 px-5 py-5">
          <p className="mb-4 text-[12px] italic leading-snug text-ink-soft">
            {adSet.rationale}
          </p>
          <div className="flex flex-col gap-4">
            {adSet.variants.map((variant, index) => (
              <VariantEditor
                key={variant.id}
                variant={variant}
                index={index}
                disabled={disabled}
                onChange={(patch) => handleVariantChange(index, patch)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariantEditor({
  variant,
  index,
  disabled,
  onChange,
}: {
  variant: VariantDraft;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<VariantDraft>) => void;
}) {
  return (
    <div
      className={`rounded-lg border ${
        variant.selected ? 'border-rule bg-paper/40' : 'border-paper-2 bg-paper-2/40'
      } px-4 py-4`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// VARIANT '}
          {index + 1}
        </span>
        <label className="inline-flex items-center gap-2 text-[12px] font-medium text-ink">
          <input
            type="checkbox"
            checked={variant.selected}
            onChange={(e) => onChange({ selected: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 cursor-pointer accent-rust"
          />
          {variant.selected ? 'Included' : 'Excluded'}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <FieldRow label="Headline" sub="Bold caption under the image (≤ 40 chars).">
          <Input
            type="text"
            value={variant.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            disabled={disabled || !variant.selected}
            maxLength={60}
            aria-label="Headline"
          />
        </FieldRow>

        <FieldRow label="Primary text" sub="Above the image — the pain hook + promise (≤ 125 chars).">
          <Textarea
            value={variant.primaryText}
            onChange={(e) => onChange({ primaryText: e.target.value })}
            disabled={disabled || !variant.selected}
            rows={3}
            maxLength={200}
            aria-label="Primary text"
          />
        </FieldRow>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Description" sub="Small line under the headline (≤ 27 chars).">
            <Input
              type="text"
              value={variant.description}
              onChange={(e) => onChange({ description: e.target.value })}
              disabled={disabled || !variant.selected}
              maxLength={50}
              aria-label="Description"
            />
          </FieldRow>

          <FieldRow label="CTA button" sub="The Meta-side button label.">
            <select
              value={variant.ctaType}
              onChange={(e) => onChange({ ctaType: e.target.value as CtaType })}
              disabled={disabled || !variant.selected}
              className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="CTA"
            >
              {CTA_OPTIONS.map((cta) => (
                <option key={cta} value={cta}>
                  {humaniseCta(cta)}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>
    </div>
  );
}

// --- launch band ------------------------------------------------------------

function LaunchBand({
  currency,
  dailyBudgetMajor,
  adSetCount,
  totalAds,
  launchDisabled,
  launchPending,
  onBack,
  onCancel,
  onLaunch,
  classicBuilderHref,
}: {
  currency: string;
  dailyBudgetMajor: number;
  adSetCount: number;
  totalAds: number;
  launchDisabled: boolean;
  launchPending: boolean;
  onBack: () => void;
  onCancel: () => void;
  onLaunch: () => void;
  classicBuilderHref: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-2xl border border-rule bg-ink px-5 py-4 text-paper shadow-card md:flex-row md:items-center md:gap-5 md:px-6 md:py-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {'// READY TO LAUNCH'}
        </span>
        <span className="text-[15px] font-medium leading-snug">
          {adSetCount > 0 ? (
            <>
              {adSetCount} ad set{adSetCount === 1 ? '' : 's'} ·{' '}
              <strong className="font-semibold text-paper">{totalAds}</strong>{' '}
              ad{totalAds === 1 ? '' : 's'} · {currency || '$'}
              {Number.isFinite(dailyBudgetMajor)
                ? dailyBudgetMajor.toLocaleString()
                : '0'}
              <span className="text-paper/70"> / day</span>
            </>
          ) : (
            <span className="text-paper/70">Tick at least one variant to launch.</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={launchPending}
          className="text-paper hover:bg-paper/10 hover:text-paper"
        >
          ← Back to angles
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
          {launchPending ? 'Launching…' : 'Launch all →'}
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

// --- shared field row ------------------------------------------------------

function FieldRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {sub ? (
          <span className="text-[11px] leading-snug text-ink-quiet">{sub}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function pickPreviewVariant(
  adSets: AdSetDraft[],
): { adSet: AdSetDraft; variant: VariantDraft } | null {
  for (const adSet of adSets) {
    const selected = adSet.variants.find((v) => v.selected);
    if (selected) return { adSet, variant: selected };
  }
  // Fallback: first ad set's first variant — shown to keep the preview
  // populated when everything is unticked mid-edit.
  const first = adSets[0]?.variants[0];
  if (first) return { adSet: adSets[0], variant: first };
  return null;
}

function humaniseCta(cta: CtaType): string {
  return cta
    .toLowerCase()
    .split('_')
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(' ');
}
