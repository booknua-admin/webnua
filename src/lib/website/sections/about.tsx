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
import { aboutMeta } from './registry-meta';
import { getSectionIcon } from '../section-icons';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { SurfaceLink } from './_shared/live-surface';
import { IconField } from './_shared/IconField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// About section — a two-column "about us / why choose us" block: a copy
// column (eyebrow + headline + intro + an optional extra block) beside a
// media column (a single image, an image collage, or an image with a
// floating stat / quote card). Element-inspector model + brand-default
// colour inheritance, the hero pattern.
// =============================================================================

export type AboutExtra = 'none' | 'features' | 'stats' | 'note' | 'button';
export type AboutMediaMode = 'single' | 'collage';
export type AboutMediaShape = 'rounded' | 'arc';
export type AboutOverlay = 'none' | 'stat' | 'quote';
export type HeadlineSize = 'm' | 'l' | 'xl';

type AboutElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'extra'
  | 'overlay';

export type AboutFeature = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export type AboutStat = {
  id: string;
  icon: string;
  value: string;
  label: string;
};

export type AboutData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  imageSide: 'left' | 'right';
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  /** Which extra content block sits beneath the intro. */
  extra: AboutExtra;
  features: AboutFeature[];
  stats: AboutStat[];
  noteText: string;
  buttonLabel: string;
  buttonHref: string;
  mediaMode: AboutMediaMode;
  mediaShape: AboutMediaShape;
  imageUrl: string;
  imageUrl2: string;
  imageUrl3: string;
  /** Floating card layered over the media column. */
  overlay: AboutOverlay;
  badgeIcon: string;
  badgeValue: string;
  badgeLabel: string;
  badgeQuote: string;
};

/** The about block's own colours — last link in the resolve chain. */
const ABOUT_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_FEATURES: Omit<AboutFeature, 'id'>[] = [
  {
    icon: 'users',
    title: 'Locally owned & operated',
    description: 'We know the area, and we care about our community.',
  },
  {
    icon: 'shield-check',
    title: 'Licensed & insured',
    description: 'Your home or business is in safe, professional hands.',
  },
  {
    icon: 'star',
    title: 'Quality you can trust',
    description: 'We use the best materials and stand behind our work.',
  },
  {
    icon: 'message',
    title: 'Friendly, reliable service',
    description: 'We show up on time and treat you with respect.',
  },
];

const SEED_STATS: Omit<AboutStat, 'id'>[] = [
  { icon: 'clock', value: '10+', label: 'Years in business' },
  { icon: 'users', value: '500+', label: 'Happy clients' },
  { icon: 'map-pin', value: 'Local', label: 'Proudly local' },
];

const DEFAULTS: AboutData = {
  theme: {},
  imageSide: 'right',
  headlineSize: 'l',
  showHeadlineRule: true,
  eyebrow: 'WHY CHOOSE US',
  headline: 'Local experts. Personal service.',
  headlineAccent: 'Trusted results.',
  sub: "We're committed to providing top-quality service with honest pricing and a focus on customer satisfaction.",
  extra: 'features',
  features: SEED_FEATURES.map((f) => ({ ...f, id: makeId('feat') })),
  stats: SEED_STATS.map((s) => ({ ...s, id: makeId('stat') })),
  noteText: 'Thank you for supporting local.',
  buttonLabel: 'Learn more about us',
  buttonHref: '#',
  mediaMode: 'single',
  mediaShape: 'rounded',
  imageUrl: '',
  imageUrl2: '',
  imageUrl3: '',
  overlay: 'stat',
  badgeIcon: 'check',
  badgeValue: '100%',
  badgeLabel: 'Satisfaction guaranteed',
  badgeQuote: 'Our promise is simple: quality work, honest service, every time.',
};

function defaultData(): AboutData {
  return {
    ...DEFAULTS,
    theme: {},
    features: SEED_FEATURES.map((f) => ({ ...f, id: makeId('feat') })),
    stats: SEED_STATS.map((s) => ({ ...s, id: makeId('stat') })),
  };
}

function withDefaults(data: AboutData): AboutData {
  return {
    ...DEFAULTS,
    ...data,
    features: data.features ?? DEFAULTS.features,
    stats: data.stats ?? DEFAULTS.stats,
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
  xl: 'text-[38px] @2xl:text-[50px]',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'We go beyond expectations.',
  'Built on integrity. Focused on you.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'From start to finish, we deliver exceptional service and lasting value.',
  'We believe in honest communication, transparent pricing, and doing the job right the first time.',
] as const;

const IMAGE_SIDE_OPTIONS: readonly VariantOption<'left' | 'right'>[] = [
  { id: 'left', label: 'Image left' },
  { id: 'right', label: 'Image right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const EXTRA_OPTIONS: readonly VariantOption<AboutExtra>[] = [
  { id: 'none', label: 'None' },
  { id: 'features', label: 'Feature list' },
  { id: 'stats', label: 'Stat row' },
  { id: 'note', label: 'Signoff note' },
  { id: 'button', label: 'Button' },
];

const MEDIA_MODE_OPTIONS: readonly VariantOption<AboutMediaMode>[] = [
  { id: 'single', label: 'Single image' },
  { id: 'collage', label: 'Image collage' },
];

const MEDIA_SHAPE_OPTIONS: readonly VariantOption<AboutMediaShape>[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'arc', label: 'Arc edge' },
];

const OVERLAY_OPTIONS: readonly VariantOption<AboutOverlay>[] = [
  { id: 'none', label: 'None' },
  { id: 'stat', label: 'Stat badge' },
  { id: 'quote', label: 'Quote card' },
];

// -- Fields -----------------------------------------------------------------

function AboutFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<AboutData>) {
  const d = withDefaults(data);
  const set = <K extends keyof AboutData>(key: K, value: AboutData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    ABOUT_HARDCODED_THEME,
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

  const setFeature = useCallback(
    (index: number, next: AboutFeature) => {
      const features = d.features.slice();
      features[index] = next;
      onChange({ ...d, features });
    },
    [d, onChange],
  );
  const addFeature = useCallback(() => {
    onChange({
      ...d,
      features: [
        ...d.features,
        { id: makeId('feat'), icon: 'check', title: '', description: '' },
      ],
    });
  }, [d, onChange]);
  const removeFeature = useCallback(
    (id: string) => onChange({ ...d, features: d.features.filter((f) => f.id !== id) }),
    [d, onChange],
  );

  const setStat = useCallback(
    (index: number, next: AboutStat) => {
      const stats = d.stats.slice();
      stats[index] = next;
      onChange({ ...d, stats });
    },
    [d, onChange],
  );
  const addStat = useCallback(() => {
    onChange({
      ...d,
      stats: [...d.stats, { id: makeId('stat'), icon: 'check', value: '', label: '' }],
    });
  }, [d, onChange]);
  const removeStat = useCallback(
    (id: string) => onChange({ ...d, stats: d.stats.filter((s) => s.id !== id) }),
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
          helper={<>Optional last line — rendered in the brand accent colour.</>}
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
          label="Intro paragraph"
          value={d.sub}
          originalValue={DEFAULTS.sub}
          alternatives={SUB_ALTS}
          onChange={(v) => set('sub', v)}
          multiline
          rows={4}
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

  if (selectedElement === 'extra') {
    if (d.extra === 'features') {
      return (
        <BuilderFormSection>
          {d.features.map((feature, i) => (
            <div
              key={feature.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Feature {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeFeature(feature.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <IconField
                value={feature.icon}
                onChange={(v) => setFeature(i, { ...feature, icon: v })}
              />
              <CopyField
                label="Title"
                value={feature.title}
                onChange={(v) => setFeature(i, { ...feature, title: v })}
              />
              <CopyField
                label="Description"
                value={feature.description}
                onChange={(v) => setFeature(i, { ...feature, description: v })}
                multiline
                rows={2}
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addFeature} className="w-full">
                + Add feature
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      );
    }
    if (d.extra === 'stats') {
      return (
        <BuilderFormSection>
          {d.stats.map((stat, i) => (
            <div
              key={stat.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Stat {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeStat(stat.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <IconField
                value={stat.icon}
                onChange={(v) => setStat(i, { ...stat, icon: v })}
              />
              <BuilderFormRow>
                <CopyField
                  label="Value"
                  value={stat.value}
                  onChange={(v) => setStat(i, { ...stat, value: v })}
                  placeholder="500+"
                />
                <CopyField
                  label="Label"
                  value={stat.label}
                  onChange={(v) => setStat(i, { ...stat, label: v })}
                />
              </BuilderFormRow>
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addStat} className="w-full">
                + Add stat
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      );
    }
    if (d.extra === 'note') {
      return (
        <BuilderFormSection>
          <CopyField
            label="Signoff note"
            value={d.noteText}
            originalValue={DEFAULTS.noteText}
            onChange={(v) => set('noteText', v)}
            multiline
            rows={2}
            helper={<>A handwritten-style line — e.g. a thank-you.</>}
          />
        </BuilderFormSection>
      );
    }
    if (d.extra === 'button') {
      return (
        <BuilderFormSection>
          <CopyField
            label="Button label"
            value={d.buttonLabel}
            originalValue={DEFAULTS.buttonLabel}
            onChange={(v) => set('buttonLabel', v)}
          />
          <CopyField
            label="Link"
            value={d.buttonHref}
            originalValue={DEFAULTS.buttonHref}
            onChange={(v) => set('buttonHref', v)}
          />
        </BuilderFormSection>
      );
    }
    return (
      <BuilderFormSection>
        <p className="text-[13px] text-ink-quiet">
          No extra block. Pick one in the section settings.
        </p>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'overlay') {
    if (d.overlay === 'stat') {
      return (
        <BuilderFormSection>
          <IconField value={d.badgeIcon} onChange={(v) => set('badgeIcon', v)} />
          <CopyField
            label="Badge value"
            value={d.badgeValue}
            originalValue={DEFAULTS.badgeValue}
            onChange={(v) => set('badgeValue', v)}
            placeholder="100%"
          />
          <CopyField
            label="Badge label"
            value={d.badgeLabel}
            originalValue={DEFAULTS.badgeLabel}
            onChange={(v) => set('badgeLabel', v)}
          />
        </BuilderFormSection>
      );
    }
    if (d.overlay === 'quote') {
      return (
        <BuilderFormSection>
          <CopyField
            label="Quote"
            value={d.badgeQuote}
            originalValue={DEFAULTS.badgeQuote}
            onChange={(v) => set('badgeQuote', v)}
            multiline
            rows={3}
          />
        </BuilderFormSection>
      );
    }
    return (
      <BuilderFormSection>
        <p className="text-[13px] text-ink-quiet">
          No overlay card. Pick one in the section settings.
        </p>
      </BuilderFormSection>
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
          label="Image side"
          value={d.imageSide}
          options={IMAGE_SIDE_OPTIONS}
          onChange={(v) => set('imageSide', v)}
        />
        <VariantField
          label="Extra block"
          value={d.extra}
          options={EXTRA_OPTIONS}
          onChange={(v) => set('extra', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <VariantField
          label="Media"
          value={d.mediaMode}
          options={MEDIA_MODE_OPTIONS}
          onChange={(v) => set('mediaMode', v)}
        />
        {d.mediaMode === 'single' ? (
          <VariantField
            label="Image shape"
            value={d.mediaShape}
            options={MEDIA_SHAPE_OPTIONS}
            onChange={(v) => set('mediaShape', v)}
          />
        ) : null}
        {d.mediaMode === 'single' ? (
          <VariantField
            label="Overlay card"
            value={d.overlay}
            options={OVERLAY_OPTIONS}
            onChange={(v) => set('overlay', v)}
          />
        ) : null}
      </BuilderFormSection>
      <BuilderFormSection>
        <MediaField
          label={d.mediaMode === 'collage' ? 'Main image' : 'Image'}
          value={d.imageUrl}
          onChange={(v) => set('imageUrl', v)}
        />
        {d.mediaMode === 'collage' ? (
          <>
            <MediaField
              label="Collage image 2"
              value={d.imageUrl2}
              onChange={(v) => set('imageUrl2', v)}
            />
            <MediaField
              label="Collage image 3"
              value={d.imageUrl3}
              onChange={(v) => set('imageUrl3', v)}
            />
          </>
        ) : null}
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function AboutPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<AboutData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    ABOUT_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: AboutElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        const copy = (
          <div className="flex flex-col">
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
                className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} whitespace-pre-line font-bold leading-[1.12] tracking-[-0.02em]`}
                style={{ fontFamily: headingFont, color: theme.heading }}
              >
                {d.headline}
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
                  className="max-w-[460px] whitespace-pre-line text-[15px] leading-[1.65]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
            {d.extra !== 'none' ? (
              <SelectableElement {...sel('extra')} className="mt-7">
                <AboutExtraBlock
                  data={d}
                  theme={theme}
                  accent={accent}
                  headingFont={headingFont}
                />
              </SelectableElement>
            ) : null}
          </div>
        );

        const copyCell = (
          <div key="copy" className="flex flex-col justify-center">
            {copy}
          </div>
        );
        // The media column is hidden on a narrow canvas — on mobile the
        // copy carries the section on its own.
        const mediaCell = (
          <div key="media" className="hidden items-center @3xl:flex">
            <AboutMedia data={d} theme={theme} accent={accent} sel={sel} />
          </div>
        );

        return (
          <div className="grid items-center gap-12 @3xl:grid-cols-2">
            {d.imageSide === 'left'
              ? [mediaCell, copyCell]
              : [copyCell, mediaCell]}
          </div>
        );
      }}
    </SectionShell>
  );
}

// -- extra block ------------------------------------------------------------

function AboutExtraBlock({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: AboutData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  if (data.extra === 'features') {
    return (
      <div className="flex flex-col gap-5">
        {data.features.map((feature) => {
          const def = getSectionIcon(feature.icon);
          const Icon = def?.Icon;
          return (
            <div key={feature.id} className="flex items-start gap-3.5">
              {Icon ? (
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
                >
                  <Icon size={19} strokeWidth={1.9} color={accent} aria-hidden />
                </span>
              ) : null}
              <div>
                <p
                  className="text-[15px] font-bold leading-tight"
                  style={{ fontFamily: headingFont, color: theme.heading }}
                >
                  {feature.title || 'Feature'}
                </p>
                {feature.description ? (
                  <p
                    className="mt-1 text-[13px] leading-[1.5]"
                    style={{ color: theme.body }}
                  >
                    {feature.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (data.extra === 'stats') {
    return (
      <div className="flex flex-wrap gap-x-10 gap-y-5">
        {data.stats.map((stat) => {
          const def = getSectionIcon(stat.icon);
          const Icon = def?.Icon;
          return (
            <div key={stat.id} className="flex flex-col">
              {Icon ? (
                <Icon
                  size={22}
                  strokeWidth={1.8}
                  color={accent}
                  aria-hidden
                  className="mb-2"
                />
              ) : null}
              {stat.value ? (
                <span
                  className="text-[22px] font-bold leading-none"
                  style={{ fontFamily: headingFont, color: theme.heading }}
                >
                  {stat.value}
                </span>
              ) : null}
              {stat.label ? (
                <span
                  className="mt-1 text-[12.5px] font-medium"
                  style={{ color: theme.body }}
                >
                  {stat.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (data.extra === 'note') {
    return (
      <p
        className="max-w-[360px] text-[18px] italic leading-[1.5]"
        style={{ color: accent }}
      >
        {data.noteText}
      </p>
    );
  }

  if (data.extra === 'button') {
    return (
      <SurfaceLink
        href={data.buttonHref}
        className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold"
        style={{ backgroundColor: accent, color: '#ffffff' }}
      >
        {data.buttonLabel || 'Learn more'}
        <span aria-hidden>→</span>
      </SurfaceLink>
    );
  }

  return null;
}

// -- media column -----------------------------------------------------------

function AboutMedia({
  data,
  theme,
  accent,
  sel,
}: {
  data: AboutData;
  theme: ResolvedTheme;
  accent: string;
  sel: (id: AboutElement) => {
    id: AboutElement;
    selected: boolean;
    onSelect?: (id: string) => void;
  };
}) {
  if (data.mediaMode === 'collage') {
    return (
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="col-span-2">
          <ImageBox url={data.imageUrl} theme={theme} ratio="aspect-[16/9]" rounded />
        </div>
        <ImageBox url={data.imageUrl2} theme={theme} ratio="aspect-square" rounded />
        <ImageBox url={data.imageUrl3} theme={theme} ratio="aspect-square" rounded />
      </div>
    );
  }

  // single image — optionally arc-edged, with an optional floating card.
  const arc = data.mediaShape === 'arc';
  const radiusClass = arc
    ? data.imageSide === 'left'
      ? 'rounded-2xl rounded-r-[120px]'
      : 'rounded-2xl rounded-l-[120px]'
    : 'rounded-2xl';

  return (
    <div className="relative w-full">
      <ImageBox
        url={data.imageUrl}
        theme={theme}
        ratio="aspect-[4/5]"
        roundedClass={radiusClass}
      />
      {data.overlay !== 'none' ? (
        <div className="absolute -bottom-5 left-5 right-12 max-w-[320px]">
          <SelectableElement {...sel('overlay')}>
            {data.overlay === 'stat' ? (
              <StatBadge data={data} accent={accent} />
            ) : (
              <QuoteCard data={data} accent={accent} />
            )}
          </SelectableElement>
        </div>
      ) : null}
    </div>
  );
}

function ImageBox({
  url,
  theme,
  ratio,
  rounded,
  roundedClass,
}: {
  url: string;
  theme: ResolvedTheme;
  ratio: string;
  rounded?: boolean;
  roundedClass?: string;
}) {
  const rc = roundedClass ?? (rounded ? 'rounded-xl' : '');
  return (
    <div
      className={`relative ${ratio} w-full overflow-hidden ${rc}`}
      style={{ backgroundColor: theme.card }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.muted }}
          >
            Image
          </span>
        </div>
      )}
    </div>
  );
}

function StatBadge({ data, accent }: { data: AboutData; accent: string }) {
  const def = getSectionIcon(data.badgeIcon);
  const Icon = def?.Icon;
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-5 py-4 shadow-lg"
      style={{ backgroundColor: accent }}
    >
      {Icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <Icon size={22} strokeWidth={2} color="#ffffff" aria-hidden />
        </span>
      ) : null}
      <div>
        <p className="text-[22px] font-bold leading-none text-white">
          {data.badgeValue || '100%'}
        </p>
        <p className="mt-0.5 text-[12px] leading-tight text-white/80">
          {data.badgeLabel}
        </p>
      </div>
    </div>
  );
}

function QuoteCard({ data, accent }: { data: AboutData; accent: string }) {
  return (
    <div
      className="rounded-xl px-5 py-4 shadow-lg"
      style={{ backgroundColor: accent }}
    >
      <span
        aria-hidden
        className="font-serif text-[34px] font-bold leading-[0.5] text-white/40"
      >
        &ldquo;
      </span>
      <p className="mt-1 whitespace-pre-line text-[13.5px] font-medium leading-[1.5] text-white">
        {data.badgeQuote}
      </p>
    </div>
  );
}

export const aboutSection = defineSection<AboutData>({
  ...aboutMeta,
  defaultData,
  Fields: AboutFields,
  Preview: AboutPreview,
});
