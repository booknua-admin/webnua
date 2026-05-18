'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

import { setBrandStyleValue } from '../brand-style-stub';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { DEFAULT_SECTION_ICON, getSectionIcon } from '../section-icons';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { ColumnsField } from './_shared/ColumnsField';
import { CopyField } from './_shared/CopyField';
import { IconField } from './_shared/IconField';
import { MediaField } from './_shared/MediaField';
import { RangeField } from './_shared/RangeField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Trust section — social-proof band. Two displays: a row of trust *stats*
// (icon + value + label, e.g. "500+ Happy customers"), or a row of client
// *logos*. An optional badge strip ("Fully licensed · Insured · …") sits
// below. Element-inspector model + brand-default colour inheritance, the
// hero pattern.
// =============================================================================

export type TrustDisplay = 'stats' | 'logos';
export type TrustAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';

type TrustElement = 'eyebrow' | 'headline' | 'subheadline' | 'items' | 'badges';

const STAR_COLOR = '#e6a619';

export type TrustItem = {
  id: string;
  /** Icon id from the curated `section-icons` library. */
  icon: string;
  /** Headline value — a number ("500+") or short phrase. May be empty. */
  value: string;
  /** Caption beneath the value. */
  label: string;
  /** 0 hides the star row; 1–5 renders that many filled stars. */
  rating: number;
  /** Logo image — used in `logos` display when set (else the text logo). */
  imageUrl: string;
};

export type TrustBadge = {
  id: string;
  icon: string;
  label: string;
};

export type TrustData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  display: TrustDisplay;
  columns: number;
  headerAlign: TrustAlign;
  showDividers: boolean;
  showHeadlineRule: boolean;
  headlineSize: HeadlineSize;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  items: TrustItem[];
  showBadges: boolean;
  badges: TrustBadge[];
};

/** The trust band's own colours — last link in the resolve chain. */
const TRUST_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_ITEMS: Omit<TrustItem, 'id'>[] = [
  { icon: 'users', value: '500+', label: 'Happy customers', rating: 0, imageUrl: '' },
  { icon: 'star', value: '4.9/5', label: 'From 200+ reviews', rating: 5, imageUrl: '' },
  { icon: 'shield-check', value: '', label: 'Licensed & insured', rating: 0, imageUrl: '' },
  { icon: 'award', value: '10+', label: 'Years in business', rating: 0, imageUrl: '' },
  { icon: 'map-pin', value: 'Local', label: 'Proudly serving our community', rating: 0, imageUrl: '' },
];

const SEED_BADGES: Omit<TrustBadge, 'id'>[] = [
  { icon: 'shield-check', label: 'Fully licensed' },
  { icon: 'check', label: 'Insured' },
  { icon: 'check', label: 'Background checked' },
  { icon: 'check', label: 'Satisfaction guaranteed' },
];

const DEFAULTS: TrustData = {
  theme: {},
  display: 'stats',
  columns: 5,
  headerAlign: 'center',
  showDividers: true,
  showHeadlineRule: true,
  headlineSize: 'l',
  eyebrow: 'TRUSTED BY OUR COMMUNITY',
  headline: 'Local service. Proven results.',
  headlineAccent: '',
  sub: "We're proud to be the go-to choice for homeowners and businesses across the area.",
  items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('trust') })),
  showBadges: false,
  badges: SEED_BADGES.map((b) => ({ ...b, id: makeId('badge') })),
};

function defaultData(): TrustData {
  return {
    ...DEFAULTS,
    theme: {},
    items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('trust') })),
    badges: SEED_BADGES.map((b) => ({ ...b, id: makeId('badge') })),
  };
}

function withDefaults(data: TrustData): TrustData {
  return {
    ...DEFAULTS,
    ...data,
    items: data.items ?? DEFAULTS.items,
    badges: data.badges ?? DEFAULTS.badges,
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

const COL_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 @md:grid-cols-3',
  4: 'grid-cols-2 @md:grid-cols-4',
  5: 'grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-5',
  6: 'grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-6',
};

const ALIGN_CLASS: Record<TrustAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Proud to work with great clients.',
  'Trusted work, backed by results.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  "We've earned the trust of homeowners and businesses throughout the community.",
  'Reliable service that keeps customers coming back — and recommending us.',
] as const;

const DISPLAY_OPTIONS: readonly VariantOption<TrustDisplay>[] = [
  { id: 'stats', label: 'Stat tiles' },
  { id: 'logos', label: 'Client logos' },
];

const ALIGN_OPTIONS: readonly VariantOption<TrustAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

// -- Fields -----------------------------------------------------------------

function TrustFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<TrustData>) {
  const d = withDefaults(data);
  const set = <K extends keyof TrustData>(key: K, value: TrustData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    TRUST_HARDCODED_THEME,
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
    (index: number, next: TrustItem) => {
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
        { id: makeId('trust'), icon: DEFAULT_SECTION_ICON, value: '', label: '', rating: 0, imageUrl: '' },
      ],
    });
  }, [d, onChange]);
  const removeItem = useCallback(
    (id: string) => onChange({ ...d, items: d.items.filter((it) => it.id !== id) }),
    [d, onChange],
  );

  const setBadge = useCallback(
    (index: number, next: TrustBadge) => {
      const badges = d.badges.slice();
      badges[index] = next;
      onChange({ ...d, badges });
    },
    [d, onChange],
  );
  const addBadge = useCallback(() => {
    onChange({
      ...d,
      badges: [...d.badges, { id: makeId('badge'), icon: 'check', label: '' }],
    });
  }, [d, onChange]);
  const removeBadge = useCallback(
    (id: string) => onChange({ ...d, badges: d.badges.filter((b) => b.id !== id) }),
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
          placeholder="TRUSTED BY OUR COMMUNITY"
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

  if (selectedElement === 'items') {
    const isLogos = d.display === 'logos';
    return (
      <>
        <BuilderFormSection>
          <ColumnsField
            value={d.columns}
            onChange={(v) => set('columns', v)}
            min={2}
            max={6}
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
                  {isLogos ? 'Logo' : 'Stat'} {i + 1}
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
              <IconField
                value={item.icon}
                onChange={(v) => setItem(i, { ...item, icon: v })}
              />
              {isLogos ? (
                <MediaField
                  label="Logo image"
                  value={item.imageUrl}
                  onChange={(v) => setItem(i, { ...item, imageUrl: v })}
                  helper={<>Optional — falls back to the text below.</>}
                />
              ) : null}
              <BuilderFormRow>
                <CopyField
                  label={isLogos ? 'Logo name' : 'Value'}
                  value={item.value}
                  onChange={(v) => setItem(i, { ...item, value: v })}
                  placeholder={isLogos ? 'Pinewood' : '500+'}
                />
                <CopyField
                  label={isLogos ? 'Sub-line' : 'Label'}
                  value={item.label}
                  onChange={(v) => setItem(i, { ...item, label: v })}
                />
              </BuilderFormRow>
              {!isLogos ? (
                <RangeField
                  label="Star rating"
                  value={item.rating}
                  onChange={(v) => setItem(i, { ...item, rating: v })}
                  min={0}
                  max={5}
                  suffix="★"
                  helper={<>0 hides the star row.</>}
                />
              ) : null}
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
                + Add {isLogos ? 'logo' : 'stat'}
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  if (selectedElement === 'badges') {
    return (
      <>
        <BuilderFormSection>
          <ToggleField
            label="Show badge strip"
            value={d.showBadges}
            onChange={(v) => set('showBadges', v)}
          />
        </BuilderFormSection>
        <BuilderFormSection>
          {d.badges.map((badge, i) => (
            <div
              key={badge.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Badge {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeBadge(badge.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <IconField
                value={badge.icon}
                onChange={(v) => setBadge(i, { ...badge, icon: v })}
              />
              <CopyField
                label="Label"
                value={badge.label}
                onChange={(v) => setBadge(i, { ...badge, label: v })}
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addBadge} className="w-full">
                + Add badge
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
          label="Display"
          value={d.display}
          options={DISPLAY_OPTIONS}
          onChange={(v) => set('display', v)}
        />
        <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={2} max={6} />
        <VariantField
          label="Header alignment"
          value={d.headerAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('headerAlign', v)}
        />
        <ToggleField
          label="Column dividers"
          value={d.showDividers}
          onChange={(v) => set('showDividers', v)}
        />
        <ToggleField
          label="Badge strip"
          value={d.showBadges}
          onChange={(v) => set('showBadges', v)}
          helper={<>A row of trust badges beneath the items.</>}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function TrustPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<TrustData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    TRUST_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: TrustElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        return (
          <div className="flex flex-col">
            {/* -- header band -- */}
            <div className={`flex flex-col ${ALIGN_CLASS[d.headerAlign]} mb-12`}>
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
                    className="max-w-[620px] text-[15px] leading-[1.6]"
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
              <div className={`grid gap-y-8 ${COL_CLASS[d.columns] ?? COL_CLASS[5]}`}>
                {d.items.map((item, i) => (
                  <SelectableElement key={item.id} {...sel('items')}>
                    <div
                      style={
                        d.showDividers && i % d.columns > 0
                          ? { borderLeft: `1px solid ${theme.border}` }
                          : undefined
                      }
                    >
                      {d.display === 'logos' ? (
                        <TrustLogo item={item} theme={theme} headingFont={headingFont} />
                      ) : (
                        <TrustStat
                          item={item}
                          theme={theme}
                          accent={accent}
                          headingFont={headingFont}
                        />
                      )}
                    </div>
                  </SelectableElement>
                ))}
              </div>
            )}

            {/* -- badge strip -- */}
            {d.showBadges && d.badges.length > 0 ? (
              <SelectableElement {...sel('badges')} className="mt-12">
                <div
                  className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 border-t pt-7"
                  style={{ borderColor: theme.border }}
                >
                  {d.badges.map((badge, i) => (
                    <span key={badge.id} className="flex items-center gap-2.5">
                      {i > 0 ? (
                        <span
                          aria-hidden
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: theme.muted }}
                        />
                      ) : null}
                      <BadgeChip badge={badge} theme={theme} accent={accent} />
                    </span>
                  ))}
                </div>
              </SelectableElement>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

function StarRow({ count }: { count: number }) {
  const n = Math.max(0, Math.min(5, Math.round(count)));
  if (n === 0) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={16} color={STAR_COLOR} fill={STAR_COLOR} aria-hidden />
      ))}
    </span>
  );
}

function TrustStat({
  item,
  theme,
  accent,
  headingFont,
}: {
  item: TrustItem;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  const primary = item.value || item.label;
  const secondary = item.value ? item.label : '';

  return (
    <div className="flex flex-col items-center px-4 text-center">
      {Icon ? (
        <span
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
        >
          <Icon size={24} strokeWidth={1.9} color={accent} aria-hidden />
        </span>
      ) : null}
      <div className="flex items-center justify-center gap-2">
        {primary ? (
          <span
            className="text-[24px] font-bold leading-none tracking-[-0.01em]"
            style={{ fontFamily: headingFont, color: theme.heading }}
          >
            {primary}
          </span>
        ) : null}
        <StarRow count={item.rating} />
      </div>
      {secondary ? (
        <p className="mt-2 text-[13.5px] leading-[1.45]" style={{ color: theme.body }}>
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

function TrustLogo({
  item,
  theme,
  headingFont,
}: {
  item: TrustItem;
  theme: ResolvedTheme;
  headingFont: string;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 text-center">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.value} className="h-10 w-auto object-contain" />
      ) : (
        <>
          {Icon ? (
            <Icon size={22} strokeWidth={1.7} color={theme.heading} aria-hidden />
          ) : null}
          {item.value ? (
            <span
              className="text-[17px] font-bold tracking-[-0.01em]"
              style={{ fontFamily: headingFont, color: theme.heading }}
            >
              {item.value}
            </span>
          ) : null}
          {item.label ? (
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: theme.muted }}
            >
              {item.label}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function BadgeChip({
  badge,
  theme,
  accent,
}: {
  badge: TrustBadge;
  theme: ResolvedTheme;
  accent: string;
}) {
  const def = getSectionIcon(badge.icon);
  const Icon = def?.Icon;
  return (
    <span className="flex items-center gap-1.5">
      {Icon ? <Icon size={15} strokeWidth={2} color={accent} aria-hidden /> : null}
      <span className="text-[13px] font-medium" style={{ color: theme.body }}>
        {badge.label || 'Badge'}
      </span>
    </span>
  );
}

export const trustSection = defineSection<TrustData>({
  type: 'trust',
  label: '// TRUST',
  description:
    'Social-proof band — a row of trust stats or client logos, optional badge strip.',
  defaultData,
  Fields: TrustFields,
  Preview: TrustPreview,
  capabilityHints: {
    copyFields: ['eyebrow', 'headline', 'headlineAccent', 'sub', 'items', 'badges'],
    mediaFields: ['items'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    items: 'Trust items',
    badges: 'Badge strip',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
