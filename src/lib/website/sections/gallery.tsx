'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { setBrandStyleValue } from '../brand-style';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { galleryMeta } from './registry-meta';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { ColumnsField } from './_shared/ColumnsField';
import { CopyField } from './_shared/CopyField';
import { SurfaceLink } from './_shared/live-surface';
import { gridColumnsClass, masonryColumnsClass } from './_shared/grid';
import { MediaField } from './_shared/MediaField';
import { coerceImageDisplay, imageBoxClasses, type ImageDisplay } from './_shared/image-display';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Gallery section — a project / photo gallery: a header band, an optional
// filter-chip row, then an image grid (uniform auto-cropped cells) or a
// masonry layout (natural image heights). Element-inspector model +
// brand-default colour inheritance, the hero pattern.
//
// Uploads are size-capped (see upload-image.ts) so a gallery of large
// photos doesn't run up storage.
// =============================================================================

export type GalleryLayout = 'grid' | 'masonry';
export type GalleryAspect = 'square' | 'landscape' | 'wide' | 'portrait';
export type GalleryAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';
export type GalleryCtaStyle = 'solid' | 'outline';

type GalleryElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'filters'
  | 'items'
  | 'cta';

export type GalleryItem = {
  id: string;
  imageUrl: string;
  /** Per-image fit / focal point. Absent on old data — coerced on read. */
  display?: ImageDisplay;
  caption: string;
  /** Filter category — should match one of the filter chips. */
  category: string;
};

export type GalleryData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: GalleryLayout;
  columns: number;
  /** Cell aspect ratio in grid layout — images are auto-cropped to fit. */
  aspect: GalleryAspect;
  headerAlign: GalleryAlign;
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  showFilters: boolean;
  categories: string[];
  items: GalleryItem[];
  showCaptions: boolean;
  ctaVisible: boolean;
  ctaStyle: GalleryCtaStyle;
  ctaLabel: string;
  ctaHref: string;
};

/** The gallery's own colours — last link in the resolve chain. */
const GALLERY_HARDCODED_THEME: SectionTheme = {
  background: '#f6f7f9',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(): string {
  return `gal-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_ITEMS: Omit<GalleryItem, 'id'>[] = [
  { imageUrl: '', caption: 'Recent project', category: 'Interior' },
  { imageUrl: '', caption: 'Recent project', category: 'Renovation' },
  { imageUrl: '', caption: 'Recent project', category: 'Exterior' },
  { imageUrl: '', caption: 'Recent project', category: 'Interior' },
  { imageUrl: '', caption: 'Recent project', category: 'Renovation' },
  { imageUrl: '', caption: 'Recent project', category: 'Exterior' },
];

const DEFAULTS: GalleryData = {
  theme: {},
  layout: 'grid',
  columns: 3,
  aspect: 'landscape',
  headerAlign: 'center',
  headlineSize: 'l',
  showHeadlineRule: true,
  eyebrow: 'OUR WORK',
  headline: 'Quality work. Real results.',
  headlineAccent: '',
  sub: "Take a look at some of the projects we've completed for our clients.",
  showFilters: true,
  categories: ['Interior', 'Renovation', 'Exterior'],
  items: SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
  showCaptions: false,
  ctaVisible: true,
  ctaStyle: 'outline',
  ctaLabel: 'View more projects',
  ctaHref: '#',
};

function defaultData(): GalleryData {
  return {
    ...DEFAULTS,
    theme: {},
    categories: [...DEFAULTS.categories],
    items: SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
  };
}

function withDefaults(data: GalleryData): GalleryData {
  return {
    ...DEFAULTS,
    ...data,
    categories: data.categories ?? DEFAULTS.categories,
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

const ASPECT_CLASS: Record<GalleryAspect, string> = {
  square: 'aspect-square',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/10]',
  portrait: 'aspect-[3/4]',
};

const ALIGN_CLASS: Record<GalleryAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const ROW_JUSTIFY: Record<GalleryAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Clean spaces. Happy faces.',
  'Comfort you can count on.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'See the difference our work makes.',
  'Explore a selection of our recent projects.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<GalleryLayout>[] = [
  { id: 'grid', label: 'Uniform grid' },
  { id: 'masonry', label: 'Masonry' },
];

const ASPECT_OPTIONS: readonly VariantOption<GalleryAspect>[] = [
  { id: 'square', label: 'Square' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'wide', label: 'Wide' },
  { id: 'portrait', label: 'Portrait' },
];

const ALIGN_OPTIONS: readonly VariantOption<GalleryAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const CTA_STYLE_OPTIONS: readonly VariantOption<GalleryCtaStyle>[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'outline', label: 'Outline' },
];

// -- Fields -----------------------------------------------------------------

function GalleryFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<GalleryData>) {
  const d = withDefaults(data);
  const set = <K extends keyof GalleryData>(key: K, value: GalleryData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    GALLERY_HARDCODED_THEME,
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
    (index: number, next: GalleryItem) => {
      const items = d.items.slice();
      items[index] = next;
      onChange({ ...d, items });
    },
    [d, onChange],
  );
  const addItem = useCallback(() => {
    onChange({
      ...d,
      items: [...d.items, { id: makeId(), imageUrl: '', caption: '', category: '' }],
    });
  }, [d, onChange]);
  const removeItem = useCallback(
    (id: string) => onChange({ ...d, items: d.items.filter((it) => it.id !== id) }),
    [d, onChange],
  );

  const setCategory = useCallback(
    (index: number, value: string) => {
      const categories = d.categories.slice();
      categories[index] = value;
      onChange({ ...d, categories });
    },
    [d, onChange],
  );
  const addCategory = useCallback(() => {
    onChange({ ...d, categories: [...d.categories, ''] });
  }, [d, onChange]);
  const removeCategory = useCallback(
    (index: number) =>
      onChange({ ...d, categories: d.categories.filter((_, i) => i !== index) }),
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

  if (selectedElement === 'filters') {
    return (
      <>
        <BuilderFormSection>
          <ToggleField
            label="Show filter chips"
            value={d.showFilters}
            onChange={(v) => set('showFilters', v)}
            helper={<>An “All” chip is added automatically.</>}
          />
        </BuilderFormSection>
        <BuilderFormSection>
          {d.categories.map((category, i) => (
            <div key={i} className="mb-2.5 flex items-end gap-2 last:mb-0">
              <div className="flex-1">
                <CopyField
                  label={`Filter ${i + 1}`}
                  value={category}
                  onChange={(v) => setCategory(i, v)}
                />
              </div>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeCategory(i)}
                  className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  ×
                </button>
              </CapabilityGate>
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addCategory} className="w-full">
                + Add filter
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  if (selectedElement === 'items') {
    return (
      <>
        <BuilderFormSection>
          <ColumnsField
            value={d.columns}
            onChange={(v) => set('columns', v)}
            min={2}
            max={5}
          />
          <ToggleField
            label="Show captions"
            value={d.showCaptions}
            onChange={(v) => set('showCaptions', v)}
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
                  Photo {i + 1}
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
              <MediaField
                label="Image"
                value={item.imageUrl}
                onChange={(v) => setItem(i, { ...item, imageUrl: v })}
                display={coerceImageDisplay(item.display)}
                onDisplayChange={(v) => setItem(i, { ...item, display: v })}
                displayControls={['fit', 'focal']}
              />
              <BuilderFormRow>
                <CopyField
                  label="Caption"
                  value={item.caption}
                  onChange={(v) => setItem(i, { ...item, caption: v })}
                />
                <CopyField
                  label="Filter category"
                  value={item.category}
                  onChange={(v) => setItem(i, { ...item, category: v })}
                  helper={<>Match a filter label.</>}
                />
              </BuilderFormRow>
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
                + Add photo
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
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
          label="Button label"
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
        <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={2} max={5} />
        {d.layout === 'grid' ? (
          <VariantField
            label="Image crop"
            value={d.aspect}
            options={ASPECT_OPTIONS}
            onChange={(v) => set('aspect', v)}
            helper={<>Images are auto-cropped to fill this ratio.</>}
          />
        ) : null}
        <VariantField
          label="Header alignment"
          value={d.headerAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('headerAlign', v)}
        />
        <ToggleField
          label="Filter chips"
          value={d.showFilters}
          onChange={(v) => set('showFilters', v)}
        />
        <ToggleField
          label="Captions"
          value={d.showCaptions}
          onChange={(v) => set('showCaptions', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function GalleryPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<GalleryData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    GALLERY_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: GalleryElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const editing = !!onSelectElement;
        const chips = ['All', ...d.categories.filter(Boolean)];

        const ctaShown = d.ctaVisible && !!d.ctaLabel;
        const renderCta = ctaShown || (editing && !!d.ctaLabel);

        return (
          <div className="flex flex-col">
            {/* -- header band -- */}
            <div className={`flex flex-col ${ALIGN_CLASS[d.headerAlign]} mb-9`}>
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
                <SelectableElement {...sel('subheadline')} className="mt-4">
                  <p
                    className="max-w-[560px] whitespace-pre-line text-[15px] leading-[1.6]"
                    style={{ color: theme.body }}
                  >
                    {d.sub}
                  </p>
                </SelectableElement>
              ) : null}
            </div>

            {/* -- filter chips -- */}
            {d.showFilters && chips.length > 0 ? (
              <SelectableElement {...sel('filters')} className="mb-8">
                <div className={`flex flex-wrap gap-2 ${ROW_JUSTIFY[d.headerAlign]}`}>
                  {chips.map((chip, i) => (
                    <span
                      key={`${chip}-${i}`}
                      className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
                      style={
                        i === 0
                          ? { backgroundColor: accent, color: '#ffffff' }
                          : { color: theme.body, backgroundColor: theme.card }
                      }
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </SelectableElement>
            ) : null}

            {/* -- image grid / masonry -- */}
            {d.items.length === 0 ? (
              <p
                className="rounded-lg border border-dashed px-4 py-10 text-center text-[13px]"
                style={{ borderColor: theme.border, color: theme.muted }}
              >
                No photos yet. Add one in the editor.
              </p>
            ) : d.layout === 'masonry' ? (
              <SelectableElement {...sel('items')}>
                <div className={`gap-4 ${masonryColumnsClass(d.columns)}`}>
                  {d.items.map((item) => (
                    <div key={item.id} className="mb-4 break-inside-avoid">
                      <GalleryTile item={item} data={d} theme={theme} natural />
                    </div>
                  ))}
                </div>
              </SelectableElement>
            ) : (
              <SelectableElement {...sel('items')}>
                <div className={`grid gap-4 ${gridColumnsClass(d.columns)}`}>
                  {d.items.map((item) => (
                    <GalleryTile key={item.id} item={item} data={d} theme={theme} />
                  ))}
                </div>
              </SelectableElement>
            )}

            {/* -- bottom CTA -- */}
            {renderCta ? (
              <div className={`mt-10 flex ${ROW_JUSTIFY[d.headerAlign]}`}>
                <SelectableElement
                  {...sel('cta')}
                  display="inline-block"
                  className={ctaShown ? undefined : 'opacity-40'}
                >
                  {d.ctaStyle === 'outline' ? (
                    <SurfaceLink
                      href={d.ctaHref}
                      className="inline-flex items-center gap-2 rounded-lg border-2 px-6 py-3 text-[14px] font-semibold"
                      style={{ borderColor: theme.heading, color: theme.heading }}
                    >
                      {d.ctaLabel}
                      <span aria-hidden>→</span>
                    </SurfaceLink>
                  ) : (
                    <SurfaceLink
                      href={d.ctaHref}
                      className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold"
                      style={{ backgroundColor: accent, color: '#ffffff' }}
                    >
                      {d.ctaLabel}
                      <span aria-hidden>→</span>
                    </SurfaceLink>
                  )}
                </SelectableElement>
              </div>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

function GalleryTile({
  item,
  data,
  theme,
  natural = false,
}: {
  item: GalleryItem;
  data: GalleryData;
  theme: ResolvedTheme;
  /** Masonry tiles keep the image's natural height. */
  natural?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-xl" style={{ backgroundColor: theme.card }}>
      {natural ? (
        item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.caption} className="block w-full" />
        ) : (
          <div
            className="flex aspect-[4/3] items-center justify-center"
            style={{ backgroundColor: mixHex(theme.card, theme.heading, 0.04) }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: theme.muted }}
            >
              Photo
            </span>
          </div>
        )
      ) : (
        <div className={`relative w-full ${ASPECT_CLASS[data.aspect]}`}>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.caption}
              className={`absolute inset-0 h-full w-full ${imageBoxClasses(item.display).fitClass}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: theme.muted }}
              >
                Photo
              </span>
            </div>
          )}
        </div>
      )}
      {data.showCaptions && item.caption ? (
        <figcaption
          className="px-3.5 py-2.5 text-[12.5px] font-medium"
          style={{ color: theme.body }}
        >
          {item.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export const gallerySection = defineSection<GalleryData>({
  ...galleryMeta,
  defaultData,
  Fields: GalleryFields,
  Preview: GalleryPreview,
});
