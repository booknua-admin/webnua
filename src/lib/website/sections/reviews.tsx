'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { setBrandStyleValue } from '../brand-style';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { reviewsMeta } from './registry-meta';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { ColumnsField } from './_shared/ColumnsField';
import { CopyField } from './_shared/CopyField';
import { BundleButton } from './_shared/BundleButton';
import { SurfaceLink } from './_shared/live-surface';
import { gridColumnsClass } from './_shared/grid';
import { MediaField } from './_shared/MediaField';
import {
  coerceImageDisplay,
  defaultImageDisplay,
  imageBoxClasses,
  type ImageDisplay,
} from './_shared/image-display';
import { RangeField } from './_shared/RangeField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { StarRow } from './_shared/StarRow';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Reviews section — customer testimonials. A grid of review cards (quote +
// author + star rating), or a spotlight layout (header + image + a single
// overlapping card). Optional rating-summary row and carousel-style nav.
// Element-inspector model + brand-default colour inheritance, the hero pattern.
//
// V1 reviews are entered manually; the GBP integration auto-pulls them later.
// =============================================================================

export type ReviewsLayout = 'grid' | 'spotlight';
export type ReviewsAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';
export type ReviewsNav = 'none' | 'dots' | 'arrows';
export type ReviewsCtaStyle = 'link' | 'solid' | 'outline';

type ReviewsElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'items'
  | 'rating'
  | 'cta';

export type ReviewItem = {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  avatarUrl: string;
  /** Per-avatar fit / focal point. Absent on old data — coerced on read. */
  avatarDisplay?: ImageDisplay;
  /** 1–5 filled stars; 0 hides the star row. */
  rating: number;
};

export type ReviewsData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: ReviewsLayout;
  columns: number;
  headerAlign: ReviewsAlign;
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  items: ReviewItem[];
  showRatingSummary: boolean;
  ratingStars: number;
  ratingValue: string;
  ratingCount: string;
  nav: ReviewsNav;
  ctaVisible: boolean;
  ctaStyle: ReviewsCtaStyle;
  ctaLabel: string;
  ctaHref: string;
  spotlightImageUrl: string;
  spotlightImageDisplay: ImageDisplay;
};

/** The reviews band's own colours — last link in the resolve chain. */
const REVIEWS_HARDCODED_THEME: SectionTheme = {
  background: '#f6f7f9',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(): string {
  return `rev-${Math.random().toString(36).slice(2, 9)}`;
}

// Editor placeholder seed — populated only by `defaultData()`. These are
// generic placeholder rows, NOT fabricated customer quotes — the operator
// sees what a populated reviews section looks like, but the strings make
// it obvious the rows are placeholders to replace. The generation pipeline
// goes through `withDefaults` with an empty fallback, so an AI omission
// never leaks invented testimonials. (AI-emitted testimonials are tracked
// separately by `placeholder-testimonials.ts` — the B16 nudge.)
const EDITOR_SEED_ITEMS: Omit<ReviewItem, 'id'>[] = [
  {
    quote: 'Add a real customer quote here.',
    authorName: 'Customer name',
    authorRole: 'Role',
    avatarUrl: '',
    rating: 5,
  },
  {
    quote: 'Add a real customer quote here.',
    authorName: 'Customer name',
    authorRole: 'Role',
    avatarUrl: '',
    rating: 5,
  },
  {
    quote: 'Add a real customer quote here.',
    authorName: 'Customer name',
    authorRole: 'Role',
    avatarUrl: '',
    rating: 5,
  },
];

const DEFAULTS: ReviewsData = {
  theme: {},
  layout: 'grid',
  columns: 3,
  headerAlign: 'center',
  headlineSize: 'l',
  showHeadlineRule: true,
  eyebrow: 'TESTIMONIALS',
  headline: 'What our customers say',
  headlineAccent: '',
  sub: 'Real feedback from real customers.',
  items: [],
  showRatingSummary: false,
  ratingStars: 5,
  ratingValue: '',
  ratingCount: '',
  nav: 'none',
  ctaVisible: true,
  ctaStyle: 'link',
  ctaLabel: 'See more reviews',
  ctaHref: '#',
  spotlightImageUrl: '',
  spotlightImageDisplay: defaultImageDisplay(),
};

function defaultData(): ReviewsData {
  return {
    ...DEFAULTS,
    theme: {},
    items: EDITOR_SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
  };
}

function withDefaults(data: ReviewsData): ReviewsData {
  return {
    ...DEFAULTS,
    ...data,
    // Empty-array fallback (NOT editor seed). AI omissions show no
    // testimonials rather than leaking placeholder quotes.
    items: data.items ?? [],
  };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

// Static class strings — Tailwind scans these literals.
const HEADLINE_SIZE_CLASS: Record<HeadlineSize, string> = {
  m: 'text-[26px] @2xl:text-[32px]',
  l: 'text-[32px] @2xl:text-[44px]',
  xl: 'text-[38px] @2xl:text-[54px]',
};

const ALIGN_CLASS: Record<ReviewsAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const ROW_JUSTIFY: Record<ReviewsAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Trusted by our community',
  'We build relationships that last',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  "Real reviews from real people we're proud to serve.",
  "Our customers count on us for dependable service — here's what they say.",
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<ReviewsLayout>[] = [
  { id: 'grid', label: 'Card grid' },
  { id: 'spotlight', label: 'Spotlight' },
];

const ALIGN_OPTIONS: readonly VariantOption<ReviewsAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const NAV_OPTIONS: readonly VariantOption<ReviewsNav>[] = [
  { id: 'none', label: 'None' },
  { id: 'dots', label: 'Dots' },
  { id: 'arrows', label: 'Arrows' },
];

const CTA_STYLE_OPTIONS: readonly VariantOption<ReviewsCtaStyle>[] = [
  { id: 'link', label: 'Text link' },
  { id: 'solid', label: 'Solid button' },
  { id: 'outline', label: 'Outline button' },
];

// -- Fields -----------------------------------------------------------------

function ReviewsFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<ReviewsData>) {
  const d = withDefaults(data);
  const set = <K extends keyof ReviewsData>(key: K, value: ReviewsData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    REVIEWS_HARDCODED_THEME,
  );

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) =>
    set('theme', omitThemeKey(d.theme, key));
  const applyColorEverywhere = (
    brandKey: 'headingColor' | 'bodyColor',
    themeKey: keyof SectionTheme,
    color: string,
  ) => {
    if (clientId) setBrandStyleValue(clientId, brandKey, color);
    set('theme', omitThemeKey(d.theme, themeKey));
  };

  const setItem = useCallback(
    (index: number, next: ReviewItem) => {
      const items = d.items.slice();
      items[index] = next;
      onChange({ ...d, items });
    },
    [d, onChange],
  );
  const addItem = useCallback(() => {
    onChange({
      ...d,
      items: [
        ...d.items,
        { id: makeId(), quote: '', authorName: '', authorRole: '', avatarUrl: '', rating: 5 },
      ],
    });
  }, [d, onChange]);
  const removeItem = useCallback(
    (id: string) => onChange({ ...d, items: d.items.filter((it) => it.id !== id) }),
    [d, onChange],
  );

  if (selectedElement === 'eyebrow') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={d.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          placeholder="TESTIMONIALS"
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'headline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Headline"
          value={d.headline}
          originalValue={DEFAULTS.headline}
          alternatives={HEADLINE_ALTS}
          onChange={(v) => set('headline', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Accent line"
          value={d.headlineAccent}
          originalValue={DEFAULTS.headlineAccent}
          onChange={(v) => set('headlineAccent', v)}
          helper={<>Optional second line — rendered in the brand accent colour.</>}
        />
        <VariantField
          label="Size"
          value={d.headlineSize}
          options={HEADLINE_SIZE_OPTIONS}
          onChange={(v) => set('headlineSize', v)}
        />
        <ToggleField
          label="Accent rule"
          value={d.showHeadlineRule}
          onChange={(v) => set('showHeadlineRule', v)}
        />
        <ColorField
          label="Heading colour"
          value={resolved.heading}
          inherited={d.theme.heading === undefined}
          onChange={(v) => setColor('heading', v)}
          onReset={() => clearColor('heading')}
          applyToAll={{
            scopeLabel: 'headings',
            onApply: (color) => applyColorEverywhere('headingColor', 'heading', color),
          }}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'subheadline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Sub-headline"
          value={d.sub}
          originalValue={DEFAULTS.sub}
          alternatives={SUB_ALTS}
          onChange={(v) => set('sub', v)}
          multiline
          rows={3}
        />
        <ColorField
          label="Text colour"
          value={resolved.body}
          inherited={d.theme.body === undefined}
          onChange={(v) => setColor('body', v)}
          onReset={() => clearColor('body')}
          applyToAll={{
            scopeLabel: 'body text',
            onApply: (color) => applyColorEverywhere('bodyColor', 'body', color),
          }}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'rating') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Show rating summary"
          value={d.showRatingSummary}
          onChange={(v) => set('showRatingSummary', v)}
        />
        <RangeField
          label="Summary stars"
          value={d.ratingStars}
          onChange={(v) => set('ratingStars', v)}
          min={0}
          max={5}
          suffix="★"
        />
        <BuilderFormRow>
          <CopyField
            label="Rating value"
            value={d.ratingValue}
            originalValue={DEFAULTS.ratingValue}
            onChange={(v) => set('ratingValue', v)}
            placeholder="4.9/5"
          />
          <CopyField
            label="Rating caption"
            value={d.ratingCount}
            originalValue={DEFAULTS.ratingCount}
            onChange={(v) => set('ratingCount', v)}
            placeholder="From 200+ reviews"
          />
        </BuilderFormRow>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'cta') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Visible"
          value={d.ctaVisible}
          onChange={(v) => set('ctaVisible', v)}
        />
        <CopyField
          label="Label"
          value={d.ctaLabel}
          originalValue={DEFAULTS.ctaLabel}
          onChange={(v) => set('ctaLabel', v)}
        />
        <CopyField
          label="Link"
          value={d.ctaHref}
          originalValue={DEFAULTS.ctaHref}
          onChange={(v) => set('ctaHref', v)}
        />
        <VariantField
          label="Style"
          value={d.ctaStyle}
          options={CTA_STYLE_OPTIONS}
          onChange={(v) => set('ctaStyle', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'items') {
    return (
      <>
        {d.layout === 'grid' ? (
          <BuilderFormSection>
            <ColumnsField
              value={d.columns}
              onChange={(v) => set('columns', v)}
              min={2}
              max={4}
            />
          </BuilderFormSection>
        ) : null}
        <BuilderFormSection>
          {d.items.map((item, i) => (
            <div
              key={item.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Review {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <CopyField
                label="Quote"
                value={item.quote}
                onChange={(v) => setItem(i, { ...item, quote: v })}
                multiline
                rows={3}
              />
              <BuilderFormRow>
                <CopyField
                  label="Author name"
                  value={item.authorName}
                  onChange={(v) => setItem(i, { ...item, authorName: v })}
                />
                <CopyField
                  label="Author role"
                  value={item.authorRole}
                  onChange={(v) => setItem(i, { ...item, authorRole: v })}
                  placeholder="Homeowner"
                />
              </BuilderFormRow>
              <MediaField
                label="Avatar"
                value={item.avatarUrl}
                onChange={(v) => setItem(i, { ...item, avatarUrl: v })}
                helper={<>Optional — falls back to the author's initials.</>}
                display={coerceImageDisplay(item.avatarDisplay)}
                onDisplayChange={(v) => setItem(i, { ...item, avatarDisplay: v })}
                displayControls={['fit', 'focal']}
              />
              <RangeField
                label="Star rating"
                value={item.rating}
                onChange={(v) => setItem(i, { ...item, rating: v })}
                min={0}
                max={5}
                suffix="★"
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
                + Add review
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  // -- section-level settings (no element selected) --
  return (
    <>
      <BuilderFormSection>
        <ThemePresetField value={d.theme} onChange={(v) => set('theme', v)} />
        <ColorField
          label="Background"
          value={resolved.background}
          inherited={d.theme.background === undefined}
          onChange={(v) => setColor('background', v)}
          onReset={() => clearColor('background')}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <VariantField
          label="Layout"
          value={d.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => set('layout', v)}
        />
        {d.layout === 'grid' ? (
          <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={2} max={4} />
        ) : null}
        <VariantField
          label="Header alignment"
          value={d.headerAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('headerAlign', v)}
        />
        <VariantField
          label="Carousel nav"
          value={d.nav}
          options={NAV_OPTIONS}
          onChange={(v) => set('nav', v)}
          helper={
            <>
              Dots / arrows turn the review grid into a live carousel —
              keyboard, swipe, screen-reader announcements.
            </>
          }
        />
        <ToggleField
          label="Rating summary"
          value={d.showRatingSummary}
          onChange={(v) => set('showRatingSummary', v)}
        />
      </BuilderFormSection>
      {d.layout === 'spotlight' ? (
        <BuilderFormSection>
          <MediaField
            label="Spotlight image"
            value={d.spotlightImageUrl}
            onChange={(v) => set('spotlightImageUrl', v)}
            display={coerceImageDisplay(d.spotlightImageDisplay)}
            onDisplayChange={(v) => set('spotlightImageDisplay', v)}
          />
        </BuilderFormSection>
      ) : null}
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function ReviewsPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<ReviewsData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    REVIEWS_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: ReviewsElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const editing = !!onSelectElement;
        const spotlight = d.layout === 'spotlight';

        const ctaShown = d.ctaVisible && !!d.ctaLabel;
        const renderCta = ctaShown || (editing && !!d.ctaLabel);
        const ctaNode = renderCta ? (
          <SelectableElement
            {...sel('cta')}
            display="inline-block"
            className={ctaShown ? undefined : 'opacity-40'}
          >
            <ReviewsCta
              label={d.ctaLabel}
              href={d.ctaHref}
              style={d.ctaStyle}
              accent={accent}
            />
          </SelectableElement>
        ) : null;

        const header = (
          <div className={`flex flex-col ${ALIGN_CLASS[d.headerAlign]}`}>
            {d.eyebrow ? (
              <SelectableElement {...sel('eyebrow')}>
                <p
                  className="text-[12px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: accent }}
                >
                  {d.eyebrow}
                </p>
              </SelectableElement>
            ) : null}
            <SelectableElement {...sel('headline')} className="mt-3">
              <h2
                className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} font-bold leading-[1.1] tracking-[-0.02em]`}
                style={{ fontFamily: headingFont, color: theme.heading }}
              >
                <span className="block">{d.headline}</span>
                {d.headlineAccent ? (
                  <span className="block" style={{ color: accent }}>
                    {d.headlineAccent}
                  </span>
                ) : null}
              </h2>
            </SelectableElement>
            {d.showHeadlineRule ? (
              <span
                aria-hidden
                className="mt-4 block h-[3px] w-12 rounded-full"
                style={{ backgroundColor: accent }}
              />
            ) : null}
            {d.sub ? (
              <SelectableElement {...sel('subheadline')} className="mt-5">
                <p
                  className="max-w-[560px] whitespace-pre-line text-[15px] leading-[1.6]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
          </div>
        );

        // -- spotlight layout: header + cta on one side, image + a single
        //    overlapping review card on the other --
        if (spotlight) {
          const first = d.items[0];
          return (
            <div className="grid items-center gap-12 @3xl:grid-cols-2">
              <div>
                {header}
                {ctaNode ? <div className="mt-7">{ctaNode}</div> : null}
              </div>
              <div>
                <SpotlightImage
                  url={d.spotlightImageUrl}
                  theme={theme}
                  display={d.spotlightImageDisplay}
                />
                {first ? (
                  <div className="relative z-10 -mt-16 mr-6 @sm:mr-12">
                    <SelectableElement {...sel('items')}>
                      <ReviewCard
                        item={first}
                        theme={theme}
                        accent={accent}
                        headingFont={headingFont}
                      />
                    </SelectableElement>
                  </div>
                ) : null}
                {d.nav !== 'none' ? (
                  <div className="mt-6 flex justify-center">
                    <CarouselNav nav={d.nav} count={d.items.length} theme={theme} accent={accent} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        }

        // -- grid layout --
        return (
          <div className="flex flex-col">
            <div className="mb-10">{header}</div>

            {d.showRatingSummary ? (
              <SelectableElement {...sel('rating')} className="mb-9">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <StarRow count={d.ratingStars} size={18} />
                  {d.ratingValue ? (
                    <span
                      className="text-[16px] font-bold"
                      style={{ fontFamily: headingFont, color: theme.heading }}
                    >
                      {d.ratingValue}
                    </span>
                  ) : null}
                  {d.ratingCount ? (
                    <span className="text-[13px]" style={{ color: theme.body }}>
                      {d.ratingCount}
                    </span>
                  ) : null}
                </div>
              </SelectableElement>
            ) : null}

            {d.items.length === 0 ? (
              <p
                className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px]"
                style={{ borderColor: theme.border, color: theme.muted }}
              >
                No reviews yet. Add one in the editor.
              </p>
            ) : d.nav !== 'none' ? (
              // V1 — real interactive carousel. CSS scroll-snap drives the
              // motion + native touch swipe; an IntersectionObserver tracks
              // the active card to drive the dots / aria-live announcer. No
              // carousel library — self-contained.
              <ReviewsCarousel
                items={d.items}
                nav={d.nav}
                columns={d.columns}
                theme={theme}
                accent={accent}
                headingFont={headingFont}
                onSelectItems={onSelectElement ? () => onSelectElement('items') : undefined}
              />
            ) : (
              <div className={`grid gap-5 ${gridColumnsClass(d.columns)}`}>
                {d.items.map((item) => (
                  <SelectableElement key={item.id} {...sel('items')}>
                    <ReviewCard
                      item={item}
                      theme={theme}
                      accent={accent}
                      headingFont={headingFont}
                    />
                  </SelectableElement>
                ))}
              </div>
            )}

            {ctaNode ? (
              <div className={`mt-9 flex ${ROW_JUSTIFY[d.headerAlign]}`}>{ctaNode}</div>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

function ReviewCard({
  item,
  theme,
  accent,
  headingFont,
}: {
  item: ReviewItem;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-xl p-6"
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      <span
        aria-hidden
        className="font-serif text-[44px] font-bold leading-[0.6]"
        style={{ color: accent }}
      >
        &ldquo;
      </span>
      <p
        className="mt-3 flex-1 whitespace-pre-line text-[14px] leading-[1.6]"
        style={{ color: theme.body }}
      >
        {item.quote || 'Review quote'}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Avatar
          name={item.authorName}
          url={item.avatarUrl}
          accent={accent}
          theme={theme}
          display={item.avatarDisplay}
        />
        <div className="min-w-0">
          <p
            className="text-[14px] font-bold leading-tight"
            style={{ fontFamily: headingFont, color: theme.heading }}
          >
            {item.authorName || 'Customer'}
          </p>
          {item.authorRole ? (
            <p className="text-[12px]" style={{ color: theme.muted }}>
              {item.authorRole}
            </p>
          ) : null}
        </div>
      </div>
      {item.rating > 0 ? (
        <div className="mt-3">
          <StarRow count={item.rating} size={15} />
        </div>
      ) : null}
    </div>
  );
}

function SpotlightImage({
  url,
  theme,
  display,
}: {
  url: string;
  theme: ResolvedTheme;
  display: ImageDisplay;
}) {
  const box = imageBoxClasses(display);
  if (url && box.isOriginal) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ backgroundColor: theme.card }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="block h-auto w-full" />
      </div>
    );
  }
  const ratio = box.aspectClass ?? 'aspect-[4/3]';
  return (
    <div
      className={`relative ${ratio} w-full overflow-hidden rounded-2xl`}
      style={{ backgroundColor: theme.card }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`absolute inset-0 h-full w-full ${box.fitClass}`} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.muted }}
          >
            Spotlight image
          </span>
        </div>
      )}
    </div>
  );
}

function Avatar({
  name,
  url,
  accent,
  theme,
  display,
}: {
  name: string;
  url: string;
  accent: string;
  theme: ResolvedTheme;
  display?: ImageDisplay;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`h-10 w-10 shrink-0 rounded-full ${imageBoxClasses(display).fitClass}`}
      />
    );
  }
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      style={{
        backgroundColor: mixHex(accent, theme.background, 0.8),
        color: accent,
      }}
    >
      {initials || '★'}
    </span>
  );
}

function ReviewsCta({
  label,
  href,
  style,
  accent,
}: {
  label: string;
  href?: string;
  style: ReviewsCtaStyle;
  accent: string;
}) {
  if (style === 'solid') {
    return (
      <BundleButton href={href} variant="primary" accent={accent}>
        {label}
      </BundleButton>
    );
  }
  if (style === 'outline') {
    return (
      <BundleButton href={href} variant="secondary" accent={accent}>
        {label}
      </BundleButton>
    );
  }
  // `link` style — operator explicitly chose a subtle inline text link.
  // Stays a SurfaceLink rather than a BundleButton: BundleButton's secondary
  // variant promotes to outlined in most bundles, whereas the operator's
  // `link` pick should always read as a text link regardless of bundle.
  return (
    <SurfaceLink
      href={href}
      className="inline-flex items-center gap-1.5 text-[14px] font-semibold"
      style={{ color: accent }}
    >
      {label}
      <span aria-hidden>→</span>
    </SurfaceLink>
  );
}

// =============================================================================
// V1 Reviews carousel — real interactivity (Bundle C2b-2)
// =============================================================================

/** Self-contained carousel. CSS scroll-snap + a horizontal flex strip handle
 *  the visual motion + native touch swipe; an IntersectionObserver tracks
 *  which card is currently in view to drive the active dot + the aria-live
 *  announcer. No carousel library dependency.
 *
 *  Graceful no-JS fallback: the strip itself is a `overflow-x-auto` flex
 *  row with `scroll-snap`. Without JS the user can scroll/swipe; arrows +
 *  dots render normally — onClick handlers simply don't fire until React
 *  hydrates (the strip's native scroll still works either way).
 *
 *  Auto-advance is DEFAULT OFF. Bundle C2b-2 brief says "auto-advance
 *  optional (defaults OFF)" so we never start the timer unless the
 *  property explicitly opts in. Pause-on-hover and pause-on-focus apply
 *  when auto-advance is on (future opt-in surface). */
function ReviewsCarousel({
  items,
  nav,
  columns,
  theme,
  accent,
  headingFont,
  onSelectItems,
}: {
  items: ReviewItem[];
  nav: ReviewsNav;
  columns: number;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
  onSelectItems?: () => void;
}) {
  const strip = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);
  const liveId = useId();
  const count = items.length;

  // No-JS fallback path: the strip itself is `overflow-x-auto` with native
  // scroll-snap + touch swipe; the user can still navigate without JS. The
  // arrow/dot buttons render visibly and respond to click only once React
  // hydrates — no separate `controlsReady` flag needed (a `useEffect` ->
  // `setState` purely to flip a flag triggers the cascading-render lint).

  // Track the most-visible card with an IntersectionObserver. The strip's
  // own scrollLeft is the alternative signal; the observer scales better
  // when card widths differ (different content lengths).
  useEffect(() => {
    if (!strip.current || count === 0) return;
    const root = strip.current;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio.
        let bestIndex = active;
        let bestRatio = 0;
        for (const entry of entries) {
          const indexAttr = entry.target.getAttribute('data-index');
          if (!indexAttr) continue;
          const index = Number.parseInt(indexAttr, 10);
          if (Number.isNaN(index)) continue;
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }
        }
        if (bestRatio > 0 && bestIndex !== active) setActive(bestIndex);
      },
      {
        root,
        threshold: [0.4, 0.6, 0.8],
      },
    );
    cardRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [active, count]);

  const scrollToIndex = useCallback(
    (i: number) => {
      const card = cardRefs.current[i];
      if (!card || !strip.current) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    },
    [],
  );

  const goPrev = useCallback(() => {
    const next = active <= 0 ? count - 1 : active - 1;
    setActive(next);
    scrollToIndex(next);
  }, [active, count, scrollToIndex]);
  const goNext = useCallback(() => {
    const next = active >= count - 1 ? 0 : active + 1;
    setActive(next);
    scrollToIndex(next);
  }, [active, count, scrollToIndex]);

  // Keyboard support — when the strip has focus, ←/→ navigate.
  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    },
    [goNext, goPrev],
  );

  // Per-card width by columns count — matches the non-carousel grid's
  // visual density. Container queries scale up at @sm.
  const cardBasis: Record<number, string> = {
    1: 'basis-full',
    2: 'basis-[85%] @sm:basis-[55%]',
    3: 'basis-[85%] @sm:basis-[55%] @2xl:basis-[34%]',
    4: 'basis-[85%] @sm:basis-[45%] @2xl:basis-[26%]',
  };
  const basis = cardBasis[columns] ?? cardBasis[3];

  return (
    <div className="flex flex-col">
      <div
        ref={strip}
        role="region"
        aria-roledescription="carousel"
        aria-label="Customer reviews"
        tabIndex={0}
        onKeyDown={onKey}
        className="-mx-2 flex w-full snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ scrollPaddingInline: '8px' }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            data-index={i}
            ref={(node) => {
              cardRefs.current[i] = node;
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className={`shrink-0 ${basis} snap-start`}
            onClick={onSelectItems}
          >
            <ReviewCard
              item={item}
              theme={theme}
              accent={accent}
              headingFont={headingFont}
            />
          </div>
        ))}
      </div>

      {/* Live region — screen readers announce the active slide. */}
      <span id={liveId} aria-live="polite" className="sr-only">
        {count > 0 ? `Review ${active + 1} of ${count}` : ''}
      </span>

      {/* Controls — arrows + dots. Arrows are real <button>s with ≥44px
          tap targets; dots double as both indicator and click target. */}
      <div className="mt-7 flex items-center justify-center gap-4">
        {nav === 'arrows' ? (
          <button
            type="button"
            onClick={goPrev}
            disabled={count <= 1}
            aria-label="Previous review"
            aria-controls={liveId}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-bold transition disabled:opacity-40"
            style={{ border: `1px solid ${theme.border}`, color: theme.heading }}
          >
            <span aria-hidden>‹</span>
          </button>
        ) : null}
        <div className="flex items-center gap-2" role="tablist" aria-label="Review slides">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Go to review ${i + 1}`}
              aria-controls={liveId}
              onClick={() => {
                setActive(i);
                scrollToIndex(i);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full"
            >
              <span
                aria-hidden
                className="block h-2 w-2 rounded-full transition"
                style={{
                  backgroundColor: i === active ? accent : theme.border,
                  transform: i === active ? 'scale(1.25)' : undefined,
                }}
              />
            </button>
          ))}
        </div>
        {nav === 'arrows' ? (
          <button
            type="button"
            onClick={goNext}
            disabled={count <= 1}
            aria-label="Next review"
            aria-controls={liveId}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-bold transition disabled:opacity-40"
            style={{ border: `1px solid ${theme.border}`, color: theme.heading }}
          >
            <span aria-hidden>›</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CarouselNav({
  nav,
  count,
  theme,
  accent,
}: {
  nav: ReviewsNav;
  count: number;
  theme: ResolvedTheme;
  accent: string;
}) {
  if (nav === 'dots') {
    const dots = Math.max(1, Math.min(6, count));
    return (
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: i === 0 ? accent : theme.border }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3" aria-hidden>
      {['‹', '›'].map((glyph) => (
        <span
          key={glyph}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[16px] font-bold"
          style={{
            border: `1px solid ${theme.border}`,
            color: theme.heading,
          }}
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}

export const reviewsSection = defineSection<ReviewsData>({
  ...reviewsMeta,
  defaultData,
  Fields: ReviewsFields,
  Preview: ReviewsPreview,
});
