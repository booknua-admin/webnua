'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { setBrandStyleValue } from '../brand-style-stub';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { DEFAULT_SECTION_ICON, getSectionIcon } from '../section-icons';
import { ColumnsField } from './_shared/ColumnsField';
import { CopyField } from './_shared/CopyField';
import { gridColumnsClass } from './_shared/grid';
import { IconField } from './_shared/IconField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Features section — icon / image grid showcase. The flexible "what we do"
// grid: a header band over N item cards (icon or photo + title + blurb +
// optional link), plus an optional bottom CTA. Element-inspector model +
// brand-default colour inheritance, the hero pattern.
//
// Distinct from the `services` section — that is a priced service *menu*
// (name + price + duration); this is a service *showcase* (icon + blurb),
// the form most service websites lead with.
// =============================================================================

export type FeaturesLayout = 'cards' | 'plain';
export type FeaturesMediaStyle = 'icon' | 'image' | 'image-icon';
export type FeaturesIconStyle = 'soft' | 'solid' | 'bare';
export type FeaturesAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';
export type CtaStyle = 'solid' | 'outline';

type FeaturesElement = 'eyebrow' | 'headline' | 'subheadline' | 'items' | 'cta';

export type FeatureItem = {
  id: string;
  /** An icon id from the curated `section-icons` library. */
  icon: string;
  imageUrl: string;
  title: string;
  description: string;
  linkLabel: string;
  linkHref: string;
};

export type FeaturesData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: FeaturesLayout;
  mediaStyle: FeaturesMediaStyle;
  iconStyle: FeaturesIconStyle;
  columns: number;
  headerAlign: FeaturesAlign;
  showDividers: boolean;
  showItemLinks: boolean;
  showHeadlineRule: boolean;
  headlineSize: HeadlineSize;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  ctaVisible: boolean;
  ctaStyle: CtaStyle;
  ctaLabel: string;
  ctaHref: string;
  items: FeatureItem[];
};

/** The features grid's own colours — last link in the resolve chain. */
const FEATURES_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(): string {
  return `feat-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_ITEMS: Omit<FeatureItem, 'id'>[] = [
  {
    icon: 'droplet',
    imageUrl: '',
    title: 'Plumbing',
    description: 'From repairs to installations, we handle all your plumbing needs with care.',
    linkLabel: 'Learn more',
    linkHref: '#',
  },
  {
    icon: 'snowflake',
    imageUrl: '',
    title: 'HVAC services',
    description: 'Keep your home comfortable year-round with our heating and cooling solutions.',
    linkLabel: 'Learn more',
    linkHref: '#',
  },
  {
    icon: 'zap',
    imageUrl: '',
    title: 'Electrical',
    description: 'Safe, reliable electrical services for your home or business.',
    linkLabel: 'Learn more',
    linkHref: '#',
  },
  {
    icon: 'spray-can',
    imageUrl: '',
    title: 'Cleaning',
    description: 'Professional cleaning for homes and businesses. Spotless results, every time.',
    linkLabel: 'Learn more',
    linkHref: '#',
  },
];

const DEFAULTS: FeaturesData = {
  theme: {},
  layout: 'cards',
  mediaStyle: 'icon',
  iconStyle: 'soft',
  columns: 4,
  headerAlign: 'center',
  showDividers: false,
  showItemLinks: true,
  showHeadlineRule: true,
  headlineSize: 'l',
  eyebrow: 'OUR SERVICES',
  headline: 'Quality services, every time',
  headlineAccent: '',
  sub: 'We offer a wide range of services to meet your needs — reliable, professional, and always done right.',
  ctaVisible: true,
  ctaStyle: 'solid',
  ctaLabel: 'View all services',
  ctaHref: '#',
  items: SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
};

function defaultData(): FeaturesData {
  return {
    ...DEFAULTS,
    theme: {},
    items: SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
  };
}

function withDefaults(data: FeaturesData): FeaturesData {
  return {
    ...DEFAULTS,
    ...data,
    items: data.items ?? DEFAULTS.items,
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
  l: 'text-[32px] @2xl:text-[42px]',
  xl: 'text-[38px] @2xl:text-[52px]',
};

const ALIGN_CLASS: Record<FeaturesAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Solutions that make a difference',
  'Professional services you can count on',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  "We're here to make your life easier with services you can count on.",
  'We deliver reliable solutions with a focus on quality, transparency, and customer satisfaction.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<FeaturesLayout>[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'plain', label: 'Plain' },
];

const MEDIA_OPTIONS: readonly VariantOption<FeaturesMediaStyle>[] = [
  { id: 'icon', label: 'Icon' },
  { id: 'image', label: 'Photo' },
  { id: 'image-icon', label: 'Photo + icon' },
];

const ICON_OPTIONS: readonly VariantOption<FeaturesIconStyle>[] = [
  { id: 'soft', label: 'Soft tint' },
  { id: 'solid', label: 'Solid' },
  { id: 'bare', label: 'Bare glyph' },
];

const ALIGN_OPTIONS: readonly VariantOption<FeaturesAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const CTA_STYLE_OPTIONS: readonly VariantOption<CtaStyle>[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'outline', label: 'Outline' },
];

// -- Fields -----------------------------------------------------------------

function FeaturesFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<FeaturesData>) {
  const d = withDefaults(data);
  const set = <K extends keyof FeaturesData>(key: K, value: FeaturesData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FEATURES_HARDCODED_THEME,
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
    (index: number, next: FeatureItem) => {
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
        {
          id: makeId(),
          icon: DEFAULT_SECTION_ICON,
          imageUrl: '',
          title: '',
          description: '',
          linkLabel: 'Learn more',
          linkHref: '#',
        },
      ],
    });
  }, [d, onChange]);

  const removeItem = useCallback(
    (id: string) => {
      onChange({ ...d, items: d.items.filter((it) => it.id !== id) });
    },
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
          placeholder="OUR SERVICES"
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
          helper={<>A short rule beneath the headline.</>}
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

  if (selectedElement === 'cta') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Visible"
          value={d.ctaVisible}
          onChange={(v) => set('ctaVisible', v)}
        />
        <CopyField
          label="Button · label"
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
          label="Button style"
          value={d.ctaStyle}
          options={CTA_STYLE_OPTIONS}
          onChange={(v) => set('ctaStyle', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'items') {
    const showImage = d.mediaStyle === 'image' || d.mediaStyle === 'image-icon';
    const showIcon = d.mediaStyle === 'icon' || d.mediaStyle === 'image-icon';
    return (
      <>
        <BuilderFormSection>
          <ColumnsField
            value={d.columns}
            onChange={(v) => set('columns', v)}
            helper={<>How many items sit side by side.</>}
          />
          <ToggleField
            label="Item links"
            value={d.showItemLinks}
            onChange={(v) => set('showItemLinks', v)}
            helper={<>Show the per-item “Learn more” link.</>}
          />
        </BuilderFormSection>
        <BuilderFormSection>
          {d.items.map((item, i) => (
            <div
              key={item.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Item {i + 1}
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
              {showIcon ? (
                <IconField
                  value={item.icon}
                  onChange={(v) => setItem(i, { ...item, icon: v })}
                />
              ) : null}
              {showImage ? (
                <MediaField
                  label="Image"
                  value={item.imageUrl}
                  onChange={(v) => setItem(i, { ...item, imageUrl: v })}
                />
              ) : null}
              <CopyField
                label="Title"
                value={item.title}
                onChange={(v) => setItem(i, { ...item, title: v })}
              />
              <CopyField
                label="Description"
                value={item.description}
                onChange={(v) => setItem(i, { ...item, description: v })}
                multiline
                rows={2}
              />
              {d.showItemLinks ? (
                <BuilderFormRow>
                  <CopyField
                    label="Link · label"
                    value={item.linkLabel}
                    onChange={(v) => setItem(i, { ...item, linkLabel: v })}
                  />
                  <CopyField
                    label="Link · href"
                    value={item.linkHref}
                    onChange={(v) => setItem(i, { ...item, linkHref: v })}
                  />
                </BuilderFormRow>
              ) : null}
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button
                variant="secondary"
                size="sm"
                onClick={addItem}
                className="w-full"
              >
                + Add item
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  // -- section-level settings (no element selected) --
  const showIconStyle = d.mediaStyle !== 'image';
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
          label="Item style"
          value={d.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => set('layout', v)}
        />
        <VariantField
          label="Item media"
          value={d.mediaStyle}
          options={MEDIA_OPTIONS}
          onChange={(v) => set('mediaStyle', v)}
        />
        {showIconStyle ? (
          <VariantField
            label="Icon style"
            value={d.iconStyle}
            options={ICON_OPTIONS}
            onChange={(v) => set('iconStyle', v)}
          />
        ) : null}
        <ColumnsField
          value={d.columns}
          onChange={(v) => set('columns', v)}
        />
        <VariantField
          label="Header alignment"
          value={d.headerAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('headerAlign', v)}
        />
        {d.layout === 'plain' ? (
          <ToggleField
            label="Column dividers"
            value={d.showDividers}
            onChange={(v) => set('showDividers', v)}
            helper={<>Hairline rules between plain columns.</>}
          />
        ) : null}
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function FeaturesPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<FeaturesData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FEATURES_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: FeaturesElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const editing = !!onSelectElement;

        const ctaShown = d.ctaVisible && !!d.ctaLabel;
        const renderCta = ctaShown || (editing && !!d.ctaLabel);

        return (
          <div className="flex flex-col">
            {/* -- header band -- */}
            <div
              className={`flex flex-col ${ALIGN_CLASS[d.headerAlign]} mb-12`}
            >
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
                  className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} font-bold leading-[1.12] tracking-[-0.02em]`}
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
                    className="max-w-[560px] text-[15px] leading-[1.6]"
                    style={{ color: theme.body }}
                  >
                    {d.sub}
                  </p>
                </SelectableElement>
              ) : null}
            </div>

            {/* -- items grid -- */}
            {d.items.length === 0 ? (
              <p
                className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px]"
                style={{ borderColor: theme.border, color: theme.muted }}
              >
                No items yet. Add one in the editor.
              </p>
            ) : (
              <div className={`grid gap-6 ${gridColumnsClass(d.columns)}`}>
                {d.items.map((item, i) => (
                  <SelectableElement key={item.id} {...sel('items')}>
                    <FeatureCard
                      item={item}
                      data={d}
                      theme={theme}
                      accent={accent}
                      headingFont={headingFont}
                      indexInRow={i % d.columns}
                    />
                  </SelectableElement>
                ))}
              </div>
            )}

            {/* -- bottom CTA -- */}
            {renderCta ? (
              <div className={`mt-12 flex ${ROW_JUSTIFY[d.headerAlign]}`}>
                <SelectableElement
                  {...sel('cta')}
                  display="inline-block"
                  className={ctaShown ? undefined : 'opacity-40'}
                >
                  <CtaButton label={d.ctaLabel} style={d.ctaStyle} accent={accent} />
                </SelectableElement>
              </div>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

const ROW_JUSTIFY: Record<FeaturesAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

function CtaButton({
  label,
  style,
  accent,
}: {
  label: string;
  style: CtaStyle;
  accent: string;
}) {
  if (style === 'outline') {
    return (
      <span
        className="inline-flex items-center rounded-lg border-2 px-6 py-3 text-[14px] font-semibold"
        style={{ borderColor: accent, color: accent }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-lg px-6 py-3 text-[14px] font-semibold"
      style={{ backgroundColor: accent, color: '#ffffff' }}
    >
      {label}
    </span>
  );
}

function FeatureIcon({
  iconId,
  style,
  accent,
  background,
}: {
  iconId: string;
  style: FeaturesIconStyle;
  accent: string;
  background: string;
}) {
  const def = getSectionIcon(iconId);
  if (!def) return null;
  const Icon = def.Icon;
  if (style === 'bare') {
    return <Icon size={36} strokeWidth={1.6} color={accent} aria-hidden />;
  }
  const isSolid = style === 'solid';
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full"
      style={{
        backgroundColor: isSolid ? accent : mixHex(accent, background, 0.86),
      }}
    >
      <Icon
        size={24}
        strokeWidth={1.9}
        color={isSolid ? '#ffffff' : accent}
        aria-hidden
      />
    </span>
  );
}

function FeatureImage({
  url,
  theme,
  rounded,
}: {
  url: string;
  theme: ResolvedTheme;
  rounded: boolean;
}) {
  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden ${rounded ? 'rounded-lg' : ''}`}
      style={{ backgroundColor: theme.card }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.muted }}
          >
            Image
          </span>
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  item,
  data,
  theme,
  accent,
  headingFont,
  indexInRow,
}: {
  item: FeatureItem;
  data: FeaturesData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
  indexInRow: number;
}) {
  const isCard = data.layout === 'cards';
  const showImage = data.mediaStyle === 'image' || data.mediaStyle === 'image-icon';
  const showIcon = data.mediaStyle === 'icon' || data.mediaStyle === 'image-icon';
  const overlapIcon = data.mediaStyle === 'image-icon';

  const text = (
    <div className="flex flex-col items-center px-2 text-center">
      <h3
        className="text-[18px] font-bold leading-[1.2] tracking-[-0.01em]"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {item.title || 'Untitled'}
      </h3>
      {item.description ? (
        <p
          className="mt-2 text-[13.5px] leading-[1.55]"
          style={{ color: theme.body }}
        >
          {item.description}
        </p>
      ) : null}
      {data.showItemLinks && item.linkLabel ? (
        <span
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: accent }}
        >
          {item.linkLabel}
          <span aria-hidden>→</span>
        </span>
      ) : null}
    </div>
  );

  const cellStyle =
    !isCard && data.showDividers && indexInRow > 0
      ? { borderLeft: `1px solid ${theme.border}` }
      : undefined;

  // -- card layouts --------------------------------------------------------
  if (isCard) {
    if (showImage) {
      return (
        <div
          className="flex h-full flex-col overflow-hidden rounded-xl"
          style={{
            backgroundColor: theme.card,
            border: `1px solid ${theme.cardBorder}`,
          }}
        >
          <FeatureImage url={item.imageUrl} theme={theme} rounded={false} />
          <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-5">
            {overlapIcon && showIcon ? (
              <div className="-mt-12 mb-3">
                <FeatureIcon
                  iconId={item.icon}
                  style={data.iconStyle === 'bare' ? 'soft' : data.iconStyle}
                  accent={accent}
                  background={theme.card}
                />
              </div>
            ) : null}
            {text}
          </div>
        </div>
      );
    }
    return (
      <div
        className="flex h-full flex-col items-center px-5 py-7 rounded-xl"
        style={{
          backgroundColor: theme.card,
          border: `1px solid ${theme.cardBorder}`,
        }}
      >
        {showIcon ? (
          <div className="mb-4">
            <FeatureIcon
              iconId={item.icon}
              style={data.iconStyle}
              accent={accent}
              background={theme.card}
            />
          </div>
        ) : null}
        {text}
      </div>
    );
  }

  // -- plain layouts -------------------------------------------------------
  return (
    <div
      className="flex h-full flex-col items-center px-4 py-2"
      style={cellStyle}
    >
      {showImage ? (
        <div className="mb-4 w-full">
          <FeatureImage url={item.imageUrl} theme={theme} rounded />
        </div>
      ) : null}
      {showIcon && !overlapIcon ? (
        <div className="mb-4">
          <FeatureIcon
            iconId={item.icon}
            style={data.iconStyle}
            accent={accent}
            background={theme.background}
          />
        </div>
      ) : null}
      {overlapIcon && showIcon ? (
        <div className="-mt-11 mb-3">
          <FeatureIcon
            iconId={item.icon}
            style={data.iconStyle === 'bare' ? 'soft' : data.iconStyle}
            accent={accent}
            background={theme.background}
          />
        </div>
      ) : null}
      {text}
    </div>
  );
}

export const featuresSection = defineSection<FeaturesData>({
  type: 'features',
  label: '// FEATURES',
  description:
    'Icon / image grid showcase — header band over N item cards, optional CTA.',
  defaultData,
  Fields: FeaturesFields,
  Preview: FeaturesPreview,
  capabilityHints: {
    copyFields: ['eyebrow', 'headline', 'headlineAccent', 'sub', 'ctaLabel', 'ctaHref', 'items'],
    mediaFields: ['items'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Service items',
    cta: 'Button',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
