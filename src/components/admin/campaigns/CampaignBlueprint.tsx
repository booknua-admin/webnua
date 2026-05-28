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
  /** Stable id per (angle, variant) cell — also identifies the ad in
   *  the per-ad modal. */
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
  /** Per-ad image override. Falls back to the ad-set's shared image
   *  pool when null. V1 supports operator upload here. */
  imageUrl: string | null;
  /** Operator can untick an ad to drop it from the launch. */
  selected: boolean;
};

export type AdSetNode = {
  /** Angle id (pain / outcome / trust) — also drives the eyebrow chip. */
  angleId: string;
  label: string;
  rationale: string;
  /** Shared image pool — V1 inherits from the industry's stock set
   *  unless an individual ad overrides via AdEditModal. */
  sharedImageUrl: string;
  ads: AdNode[];
};

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
          Click any node to edit. The bottom row shows the actual ad
          preview each customer will scroll past.
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
    <div className="flex flex-col items-center gap-0 overflow-x-auto rounded-2xl border border-rule bg-paper-2/40 px-4 py-8 sm:px-8 sm:py-10">
      {/* Layer 1: Campaign root */}
      <CampaignRootCard
        settings={settings}
        currency={currency}
        dailyMajor={dailyMajor}
        totalAds={totalAds}
        onClick={onOpenCampaign}
      />

      {/* Connector: root → branches */}
      <ConnectorVertical height={32} />

      {adSets.length > 0 ? (
        <ConnectorHorizontalBranch count={adSets.length} />
      ) : null}

      {/* Layer 2: Ad Set row */}
      <div
        className="grid gap-6 sm:gap-8"
        style={{ gridTemplateColumns: `repeat(${Math.max(adSets.length, 1)}, minmax(220px, 1fr))` }}
      >
        {adSets.map((adSet) => (
          <div key={adSet.angleId} className="flex flex-col items-center gap-0">
            <AdSetCard
              adSet={adSet}
              onClick={() => onOpenAdSet(adSet.angleId)}
            />

            <ConnectorVertical height={28} />

            {adSet.ads.length > 1 ? (
              <ConnectorHorizontalBranch count={adSet.ads.length} short />
            ) : null}

            {/* Layer 3: Ad previews */}
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.max(adSet.ads.length, 1)}, minmax(260px, 280px))`,
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
  const imageUrl = ad.imageUrl || adSet.sharedImageUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-0 rounded-xl border border-rule bg-card p-0 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-rust hover:shadow-card ${
        dim ? 'opacity-50' : ''
      }`}
      style={{ width: 280 }}
    >
      <div className="pointer-events-none origin-top-left" style={{ transform: 'scale(0.85)', width: 330, height: 'auto', marginBottom: -60 }}>
        <MetaAdPreview
          pageName={brief?.businessName ?? 'Your business'}
          pageLogoUrl={null}
          primaryText={ad.primaryText}
          headline={ad.headline}
          description={ad.description}
          ctaType={ad.ctaType}
          imageUrl={imageUrl}
          accentColor={brief?.accentColor}
          linkHost={brief?.primaryDomain ?? undefined}
        />
      </div>
      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-paper-2/95 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet shadow-sm">
        {ad.selected ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden /> LIVE
          </>
        ) : (
          <>OFF</>
        )}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-rust px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper opacity-0 transition-opacity group-hover:opacity-100 shadow-sm">
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
    rationale: adSet.rationale,
    sharedImageUrl: adSet.sharedImageUrl,
    activeAdCount: adSet.ads.filter((a) => a.selected).length,
    totalAdCount: adSet.ads.length,
  };
}

function applyAdSetEdit(adSet: AdSetNode, edit: AdSetEditDraft): AdSetNode {
  return {
    ...adSet,
    label: edit.label,
    rationale: edit.rationale,
    sharedImageUrl: edit.sharedImageUrl,
  };
}

function toAdDraft(ad: AdNode, adSet: AdSetNode): AdDraft {
  return {
    id: ad.id,
    headline: ad.headline,
    primaryText: ad.primaryText,
    description: ad.description,
    ctaType: ad.ctaType,
    imageUrl: ad.imageUrl ?? adSet.sharedImageUrl,
    selected: ad.selected,
  };
}

function applyAdEdit(adSet: AdSetNode, adId: string, edit: AdDraft): AdSetNode {
  return {
    ...adSet,
    ads: adSet.ads.map((a) =>
      a.id === adId
        ? {
            ...a,
            headline: edit.headline,
            primaryText: edit.primaryText,
            description: edit.description,
            ctaType: edit.ctaType,
            imageUrl: edit.imageUrl,
            selected: edit.selected,
          }
        : a,
    ),
  };
}
