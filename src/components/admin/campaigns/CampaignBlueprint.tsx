'use client';

// =============================================================================
// CampaignBlueprint — high-fidelity visual hierarchy of the campaign about
// to ship to Meta. Replaces CampaignTree.
//
// Phase 7.5 · Session 2.3 (v2). The wireframe operator approved:
//
//                  ┌──────────────┐
//                  │   Campaign   │   ← rust-bordered root card
//                  │ name · spend │      click → CampaignEditModal
//                  └──────┬───────┘
//                         │
//          ┌──────────────┼──────────────┐
//          │              │              │
//      ┌───┴───┐      ┌───┴───┐      ┌───┴───┐
//      │AdSet  │      │AdSet  │      │AdSet  │   ← per picked angle
//      │pain   │      │outcome│      │trust  │      click → AdSetEditModal
//      └───┬───┘      └───┬───┘      └───┬───┘
//          │              │              │
//       ┌──┴──┐        ┌──┴──┐        ┌──┴──┐
//       │ Ad  │        │ Ad  │        │ Ad  │   ← real MetaAdPreview
//       │ Ad  │        │ Ad  │        │ Ad  │      cards. click → AdEditModal
//       └─────┘        └─────┘        └─────┘
//
// Each node is clickable + opens a focused modal editor. The bottom row
// is genuine ad previews (not stylised boxes) — the operator sees the
// final ad copy + image at-a-glance.
//
// Launch fires from the sticky bottom band — same orchestrator the
// classic wizard uses (no new Meta-side semantics this session).
// =============================================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { AdEditModal, type AdDraft } from './AdEditModal';
import { AdSetEditModal, type AdSetEditDraft } from './AdSetEditModal';
import { CampaignEditModal } from './CampaignEditModal';
import { MetaAdPreview } from './MetaAdPreview';
import { Button } from '@/components/ui/button';

// --- types ------------------------------------------------------------------

export type CtaType =
  | 'LEARN_MORE'
  | 'BOOK_NOW'
  | 'GET_QUOTE'
  | 'CONTACT_US'
  | 'SIGN_UP'
  | 'GET_OFFER'
  | 'APPLY_NOW';

export type LaunchSettings = {
  campaignName: string;
  dailyBudgetCents: number;
  country: string;
};

export type AdNode = {
  /** Stable id per (ad set, image variant) cell. */
  id: string;
  /** Operator-facing label for the variant — "Image A" / "Image B".
   *  Drives the badge on the preview card. */
  label: string;
  /** The only thing that varies within an ad set. Editable via
   *  AdEditModal (URL + Storage upload). */
  imageUrl: string;
  /** Operator can untick an ad to drop it from the launch. */
  selected: boolean;
};

export type AdSetNode = {
  /** Angle id (pain / outcome / trust) — drives the eyebrow chip. */
  angleId: string;
  label: string;
  rationale: string;
  /** Shared copy across every ad in this set. The IMAGE is the only
   *  variable within an ad set; COPY is the only variable between ad
   *  sets. Clean experiment shape: each set isolates one axis. Edited
   *  via AdEditModal's "Copy (shared across this set)" panel. */
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
  /** Per-ad-set audience override. Edited via AdSetEditModal — the
   *  TARGETING editor. V1: captured here but the launch orchestrator
   *  applies the first ad set's audience to the whole campaign (per-
   *  set targeting is V1.1 — needs orchestrator changes to accept
   *  different specs per set). Until then, audience-per-set is a
   *  forward-looking shape. */
  audience: AudienceSpec;
  ads: AdNode[];
};

/** Per-ad-set audience definition. V1 fields are the common-case
 *  knobs the operator can articulate without a Meta Ads Manager deep-
 *  dive. The classic builder's full targeting spec (placements, custom
 *  audiences, lookalikes, etc.) stays the V1.1 path. */
export type AudienceSpec = {
  /** Free-form description, e.g. "Cottesloe homeowners renovating
   *  their kitchens." Seeded from brands.audience_line. */
  description: string;
  ageMin: number;
  ageMax: number;
  /** Meta's radius in km around the customer's primary city. */
  radiusKm: number;
  /** Comma-separated interest keywords. Meta's autocomplete-resolved
   *  ids are V1.1 — V1 captures strings for the snapshot + ops audit. */
  interestKeywords: string;
};

export const DEFAULT_AUDIENCE: AudienceSpec = {
  description: '',
  ageMin: 25,
  ageMax: 65,
  radiusKm: 25,
  interestKeywords: '',
};

// --- budget-tier helpers ---------------------------------------------------

/** Recommended ad-set count for a daily budget. Meta's learning algo
 *  needs ~€5-10/day per ad set to leave the learning phase; below
 *  that, spend dilutes. With <€15/day the operator should test one
 *  angle deeply (more images, fewer ad sets); €15-30 is a healthy
 *  two-angle test; €30+ supports the full three-angle matrix. */
export function recommendedAdSetCount(dailyBudgetCents: number): 1 | 2 | 3 {
  if (dailyBudgetCents < 1500) return 1;
  if (dailyBudgetCents < 3000) return 2;
  return 3;
}

/** How many image variants per ad set, given the recommended ad-set
 *  count. Inverse relationship: fewer ad sets → more images per set so
 *  the operator still tests a meaningful matrix. */
export function recommendedImagesPerAdSet(adSetCount: 1 | 2 | 3): number {
  if (adSetCount === 1) return 3;
  return 2;
}

export type BlueprintBrief = {
  /** Required by AdEditModal for image-upload Storage scoping. */
  clientId: string;
  businessName: string;
  industry: string;
  primaryDomain: string | null;
  accentColor: string;
};

export type CampaignBlueprintProps = {
  settings: LaunchSettings;
  adSets: AdSetNode[];
  brief: BlueprintBrief | null;
  onSettingsChange: (next: LaunchSettings) => void;
  onAdSetChange: (next: AdSetNode) => void;
  onCancel: () => void;
  onLaunch: () => void;
  launchPending: boolean;
  launchError?: { message: string; detail?: string } | null;
  classicBuilderHref: string;
};

// --- main component --------------------------------------------------------

type ActiveModal =
  | { kind: 'campaign' }
  | { kind: 'ad-set'; angleId: string }
  | { kind: 'ad'; angleId: string; adId: string }
  | null;

export function CampaignBlueprint({
  settings,
  adSets,
  brief,
  onSettingsChange,
  onAdSetChange,
  onCancel,
  onLaunch,
  launchPending,
  launchError,
  classicBuilderHref,
}: CampaignBlueprintProps) {
  const [active, setActive] = useState<ActiveModal>(null);

  const totalAds = useMemo(
    () =>
      adSets.reduce(
        (sum, a) => sum + a.ads.filter((ad) => ad.selected).length,
        0,
      ),
    [adSets],
  );
  const activeAdSetCount = useMemo(
    () => adSets.filter((a) => a.ads.some((ad) => ad.selected)).length,
    [adSets],
  );

  const currency = currencyForCountry(settings.country);
  const dailyMajor = settings.dailyBudgetCents / 100;
  const launchDisabled =
    launchPending || totalAds === 0 || settings.dailyBudgetCents < 500;

  const activeModalState = resolveActiveModalState(active, adSets);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          Your campaign — ready to publish
        </h2>
        <p className="text-[13px] leading-snug text-ink-soft">
          Click any node to edit. Each ad set tests one piece of copy across
          multiple images — the bottom row is the actual ad your audience sees.
        </p>
      </header>

      <BlueprintTree
        settings={settings}
        adSets={adSets}
        brief={brief}
        currency={currency}
        dailyMajor={dailyMajor}
        totalAds={totalAds}
        onOpenCampaign={() => setActive({ kind: 'campaign' })}
        onOpenAdSet={(angleId) => setActive({ kind: 'ad-set', angleId })}
        onOpenAd={(angleId, adId) =>
          setActive({ kind: 'ad', angleId, adId })
        }
      />

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

      <PublishBand
        currency={currency}
        dailyMajor={dailyMajor}
        adSetCount={activeAdSetCount}
        totalAds={totalAds}
        launchDisabled={launchDisabled}
        launchPending={launchPending}
        onCancel={onCancel}
        onLaunch={onLaunch}
        classicBuilderHref={classicBuilderHref}
      />

      {/* --- modals --- */}
      {active?.kind === 'campaign' ? (
        <CampaignEditModal
          open
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setActive(null)}
        />
      ) : null}

      {active?.kind === 'ad-set' && activeModalState.adSet ? (
        <AdSetEditModal
          open
          draft={toAdSetEditDraft(activeModalState.adSet)}
          onChange={(next) =>
            onAdSetChange(applyAdSetEdit(activeModalState.adSet!, next))
          }
          onClose={() => setActive(null)}
        />
      ) : null}

      {active?.kind === 'ad' &&
      activeModalState.adSet &&
      activeModalState.ad ? (
        <AdEditModal
          open
          draft={toAdDraft(activeModalState.ad, activeModalState.adSet)}
          brief={brief}
          onChange={(next) =>
            onAdSetChange(
              applyAdEdit(activeModalState.adSet!, activeModalState.ad!.id, next),
            )
          }
          onClose={() => setActive(null)}
        />
      ) : null}
    </section>
  );
}

// --- tree -------------------------------------------------------------------

function BlueprintTree({
  settings,
  adSets,
  brief,
  currency,
  dailyMajor,
  totalAds,
  onOpenCampaign,
  onOpenAdSet,
  onOpenAd,
}: {
  settings: LaunchSettings;
  adSets: AdSetNode[];
  brief: BlueprintBrief | null;
  currency: string;
  dailyMajor: number;
  totalAds: number;
  onOpenCampaign: () => void;
  onOpenAdSet: (angleId: string) => void;
  onOpenAd: (angleId: string, adId: string) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-0 overflow-x-auto">
      {/* Layer 1: Campaign root */}
      <CampaignRootCard
        settings={settings}
        currency={currency}
        dailyMajor={dailyMajor}
        totalAds={totalAds}
        onClick={onOpenCampaign}
      />

      {/* Connector: root → branches */}
      <ConnectorVertical height={28} />

      {adSets.length > 0 ? (
        <ConnectorHorizontalBranch count={adSets.length} />
      ) : null}

      {/* Layer 2: Ad Set row */}
      <div
        className="grid w-full gap-5 sm:gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.max(adSets.length, 1)}, minmax(180px, 1fr))` }}
      >
        {adSets.map((adSet) => (
          <div key={adSet.angleId} className="flex flex-col items-center gap-0">
            <AdSetCard
              adSet={adSet}
              onClick={() => onOpenAdSet(adSet.angleId)}
            />

            <ConnectorVertical height={24} />

            {adSet.ads.length > 1 ? (
              <ConnectorHorizontalBranch count={adSet.ads.length} short />
            ) : null}

            {/* Layer 3: Ad previews — image variants only */}
            <div
              className="grid w-full gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(adSet.ads.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {adSet.ads.map((ad) => (
                <AdPreviewCard
                  key={ad.id}
                  ad={ad}
                  adSet={adSet}
                  brief={brief}
                  onClick={() => onOpenAd(adSet.angleId, ad.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- node cards -------------------------------------------------------------

function CampaignRootCard({
  settings,
  currency,
  dailyMajor,
  totalAds,
  onClick,
}: {
  settings: LaunchSettings;
  currency: string;
  dailyMajor: number;
  totalAds: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full max-w-[420px] flex-col items-stretch gap-2 rounded-xl border-2 border-rust bg-ink px-6 py-4 text-paper shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
        {'// CAMPAIGN'}
      </span>
      <span className="text-[18px] font-semibold tracking-tight">
        {settings.campaignName || 'Untitled campaign'}
      </span>
      <span className="text-[12px] leading-snug text-paper/80">
        <strong className="font-semibold text-paper">
          {currency || '$'}
          {Number.isFinite(dailyMajor) ? dailyMajor.toLocaleString() : '0'}
        </strong>{' '}
        / day · {settings.country} · {totalAds} ad{totalAds === 1 ? '' : 's'} live
      </span>
      <span className="absolute right-3 top-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light opacity-0 transition-opacity group-hover:opacity-100">
        Edit →
      </span>
    </button>
  );
}

const ANGLE_TONE: Record<string, { eyebrow: string; chipBg: string; chipText: string }> = {
  pain: { eyebrow: '// PAIN-LED', chipBg: 'bg-warn-soft', chipText: 'text-warn' },
  outcome: { eyebrow: '// OUTCOME-LED', chipBg: 'bg-good-soft', chipText: 'text-good' },
  trust: { eyebrow: '// TRUST-LED', chipBg: 'bg-info-soft', chipText: 'text-info' },
};

const ANGLE_FALLBACK_TONE = {
  eyebrow: '// ANGLE',
  chipBg: 'bg-paper-2',
  chipText: 'text-ink',
};

function AdSetCard({
  adSet,
  onClick,
}: {
  adSet: AdSetNode;
  onClick: () => void;
}) {
  const tone = ANGLE_TONE[adSet.angleId] ?? ANGLE_FALLBACK_TONE;
  const activeCount = adSet.ads.filter((a) => a.selected).length;
  const dim = activeCount === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full flex-col items-stretch gap-2 rounded-xl border border-rule bg-card px-4 py-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-rust hover:shadow-card ${
        dim ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`inline-flex w-fit items-center rounded-full ${tone.chipBg} px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone.chipText}`}
      >
        {tone.eyebrow}
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        {adSet.label}
      </span>
      <span className="text-[11px] leading-snug text-ink-quiet">
        {activeCount} of {adSet.ads.length} ad
        {adSet.ads.length === 1 ? '' : 's'} live
      </span>
      <span className="absolute right-3 top-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust opacity-0 transition-opacity group-hover:opacity-100">
        Edit →
      </span>
    </button>
  );
}

function AdPreviewCard({
  ad,
  adSet,
  brief,
  onClick,
}: {
  ad: AdNode;
  adSet: AdSetNode;
  brief: BlueprintBrief | null;
  onClick: () => void;
}) {
  const dim = !ad.selected;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full flex-col gap-0 overflow-hidden rounded-lg border border-rule bg-card p-0 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-rust hover:shadow-card ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div
        className="pointer-events-none w-full origin-top-left"
        style={{ transform: 'scale(0.6)', width: '166.67%', marginBottom: '-40%' }}
      >
        <MetaAdPreview
          pageName={brief?.businessName ?? 'Your business'}
          pageLogoUrl={null}
          // Copy is shared at the ad-set level; image varies per ad.
          primaryText={adSet.primaryText}
          headline={adSet.headline}
          description={adSet.description}
          ctaType={adSet.ctaType}
          imageUrl={ad.imageUrl}
          accentColor={brief?.accentColor}
          linkHost={brief?.primaryDomain ?? undefined}
        />
      </div>
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-paper-2/95 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet shadow-sm">
        {ad.selected ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden /> {ad.label.toUpperCase()}
          </>
        ) : (
          <>{ad.label.toUpperCase()} · OFF</>
        )}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-rust px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper opacity-0 transition-opacity group-hover:opacity-100 shadow-sm">
        Edit →
      </span>
    </button>
  );
}

// --- connectors -------------------------------------------------------------

function ConnectorVertical({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="w-[2px] bg-rule"
      style={{ height }}
    />
  );
}

function ConnectorHorizontalBranch({ count, short }: { count: number; short?: boolean }) {
  if (count <= 1) return null;
  // Decorative branching line — pure CSS so it scales with the grid
  // above. The vertical line above + below + the horizontal line in
  // the middle reads as a tree connector.
  return (
    <div
      aria-hidden
      className="h-[2px] w-full max-w-[calc(100%-120px)] bg-rule"
      style={{ marginBottom: short ? 12 : 16 }}
    />
  );
}

// --- publish band ----------------------------------------------------------

function PublishBand({
  currency,
  dailyMajor,
  adSetCount,
  totalAds,
  launchDisabled,
  launchPending,
  onCancel,
  onLaunch,
  classicBuilderHref,
}: {
  currency: string;
  dailyMajor: number;
  adSetCount: number;
  totalAds: number;
  launchDisabled: boolean;
  launchPending: boolean;
  onCancel: () => void;
  onLaunch: () => void;
  classicBuilderHref: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-2xl border border-rule bg-ink px-5 py-4 text-paper shadow-card md:flex-row md:items-center md:gap-5 md:px-6 md:py-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {'// READY TO PUBLISH'}
        </span>
        <span className="text-[15px] font-medium leading-snug">
          {totalAds > 0 ? (
            <>
              {adSetCount} ad set{adSetCount === 1 ? '' : 's'} ·{' '}
              <strong className="font-semibold text-paper">{totalAds}</strong>{' '}
              ad{totalAds === 1 ? '' : 's'} · {currency || '$'}
              {Number.isFinite(dailyMajor) ? dailyMajor.toLocaleString() : '0'}
              <span className="text-paper/70"> / day</span>
            </>
          ) : (
            <span className="text-paper/70">Tick at least one ad to publish.</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
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
          {launchPending ? 'Publishing…' : 'Publish to Meta →'}
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

// --- helpers ---------------------------------------------------------------

const COUNTRY_CURRENCY: Record<string, string> = {
  AU: 'AUD',
  IE: 'EUR',
  GB: 'GBP',
  US: 'USD',
  NZ: 'NZD',
  CA: 'CAD',
};

function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country] ?? '';
}

function resolveActiveModalState(
  active: ActiveModal,
  adSets: AdSetNode[],
): { adSet: AdSetNode | null; ad: AdNode | null } {
  if (!active) return { adSet: null, ad: null };
  if (active.kind === 'campaign') return { adSet: null, ad: null };
  const adSet = adSets.find((a) => a.angleId === active.angleId) ?? null;
  if (active.kind === 'ad-set') return { adSet, ad: null };
  const ad = adSet?.ads.find((a) => a.id === active.adId) ?? null;
  return { adSet, ad };
}

function toAdSetEditDraft(adSet: AdSetNode): AdSetEditDraft {
  return {
    angleId: adSet.angleId,
    label: adSet.label,
    audience: adSet.audience,
    activeAdCount: adSet.ads.filter((a) => a.selected).length,
    totalAdCount: adSet.ads.length,
  };
}

function applyAdSetEdit(adSet: AdSetNode, edit: AdSetEditDraft): AdSetNode {
  return {
    ...adSet,
    audience: edit.audience,
  };
}

function toAdDraft(ad: AdNode, adSet: AdSetNode): AdDraft {
  return {
    id: ad.id,
    label: ad.label,
    imageUrl: ad.imageUrl,
    selected: ad.selected,
    // Shared copy — the operator edits these on the ad modal, but the
    // change applies to every ad in the set (the experiment design is
    // image-vary, copy-fixed within the set).
    sharedHeadline: adSet.headline,
    sharedPrimaryText: adSet.primaryText,
    sharedDescription: adSet.description,
    sharedCtaType: adSet.ctaType,
    /** Operator-facing eyebrow on the modal so they know which angle
     *  this ad sits inside. */
    adSetLabel: adSet.label,
    adSetAngleId: adSet.angleId,
  };
}

function applyAdEdit(adSet: AdSetNode, adId: string, edit: AdDraft): AdSetNode {
  return {
    ...adSet,
    // Shared-copy fields write through to the AD-SET level — by design.
    headline: edit.sharedHeadline,
    primaryText: edit.sharedPrimaryText,
    description: edit.sharedDescription,
    ctaType: edit.sharedCtaType,
    ads: adSet.ads.map((a) =>
      a.id === adId
        ? {
            ...a,
            label: edit.label,
            imageUrl: edit.imageUrl,
            selected: edit.selected,
          }
        : a,
    ),
  };
}
