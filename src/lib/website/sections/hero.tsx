'use client';

import { BuilderFormSection } from '@/components/shared/builder/BuilderField';
import { FormBlock } from '@/components/shared/website/FormBlock';

import { setBrandStyleValue } from '../brand-style-stub';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { brandThemeDefaults, resolveTheme, type SectionTheme } from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { LinkField } from './_shared/LinkField';
import { MediaField } from './_shared/MediaField';
import { RangeField } from './_shared/RangeField';
import { SectionShell } from './_shared/SectionShell';
import { useSectionFormSlot } from './_shared/section-form-slot';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Hero section — above-the-fold lead. Element-inspector model + brand-default
// colour inheritance: `theme` holds per-section colour *overrides*; the
// effective colour resolves `override ?? brand default ?? hero hardcoded`.
// =============================================================================

export type HeroLayout = 'split' | 'overlay';
export type HeadlineSize = 'm' | 'l' | 'xl';
export type SubSize = 's' | 'm' | 'l';
export type HeroAlign = 'left' | 'center' | 'right';

type HeroElement = 'eyebrow' | 'headline' | 'subheadline' | 'ctaPrimary' | 'ctaSecondary';

export type HeroData = {
  layout: HeroLayout;
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  imageSide: 'left' | 'right';
  overlayOpacity: number;
  /** Content alignment within the hero. */
  contentAlign: HeroAlign;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  headlineSize: HeadlineSize;
  sub: string;
  subSize: SubSize;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaPrimaryVisible: boolean;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  ctaSecondaryVisible: boolean;
  heroImageUrl: string;
};

/** The hero's own colours — the last link in the resolve chain, so a fresh
 *  hero looks striking even with no brand defaults set. */
const HERO_HARDCODED_THEME: SectionTheme = {
  background: '#0d1f3a',
  heading: '#ffffff',
  body: '#c4cdda',
};

const DEFAULTS: HeroData = {
  layout: 'split',
  theme: {}, // overrides nothing — inherits brand defaults / the hardcoded look
  imageSide: 'right',
  overlayOpacity: 88,
  contentAlign: 'left',
  eyebrow: 'LOCAL · TRUSTED',
  headline: 'Power back on,',
  headlineAccent: 'guaranteed within the hour.',
  headlineSize: 'l',
  sub: 'Licensed sparkies covering Perth metro. Fixed callout, transparent quote — no surprises, ever.',
  subSize: 'm',
  ctaPrimaryLabel: 'Book a callout',
  ctaPrimaryHref: '/schedule',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: 'Call now',
  ctaSecondaryHref: 'tel:0400000000',
  ctaSecondaryVisible: true,
  heroImageUrl: '',
};

function defaultData(): HeroData {
  return { ...DEFAULTS, theme: {} };
}

function withDefaults(data: HeroData): HeroData {
  return { ...DEFAULTS, ...data };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

// Static class strings — Tailwind scans these literals; the runtime lookup
// just picks one.
const HEADLINE_SIZE_CLASS: Record<HeadlineSize, string> = {
  m: 'text-[32px] @2xl:text-[40px]',
  l: 'text-[40px] @2xl:text-[52px]',
  xl: 'text-[48px] @2xl:text-[64px]',
};

const SUB_SIZE_CLASS: Record<SubSize, string> = {
  s: 'text-[14px]',
  m: 'text-[16px]',
  l: 'text-[18px]',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Local sparkies, on call.',
  'Same-day electrical work.',
] as const;

const HEADLINE_ACCENT_ALTS = [
  DEFAULTS.headlineAccent,
  'honest pricing, no surprises.',
  'quoted before we touch a wire.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'Vetted local sparkies. Same-day response. Twelve-month workmanship guarantee on every job.',
  'On-call electricians across Perth. We answer the phone, we quote on arrival, we stand behind the work.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<HeroLayout>[] = [
  { id: 'split', label: 'Split image' },
  { id: 'overlay', label: 'Image overlay' },
];

const IMAGE_SIDE_OPTIONS: readonly VariantOption<'left' | 'right'>[] = [
  { id: 'left', label: 'Image left' },
  { id: 'right', label: 'Image right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const SUB_SIZE_OPTIONS: readonly VariantOption<SubSize>[] = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
];

const ALIGN_OPTIONS: readonly VariantOption<HeroAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

// Static class strings — alignment of the hero content block.
const ALIGN_CLASS: Record<HeroAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};
const ALIGN_SELF: Record<HeroAlign, string> = {
  left: '',
  center: 'mx-auto',
  right: 'ml-auto',
};

// -- Fields -----------------------------------------------------------------

function HeroFields({
  data,
  onChange,
  selectedElement,
  pageLinks,
  clientId,
  brand,
}: SectionFieldsProps<HeroData>) {
  const d = withDefaults(data);
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), HERO_HARDCODED_THEME);

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) => set('theme', omitThemeKey(d.theme, key));
  const applyColorEverywhere = (
    brandKey: 'headingColor' | 'bodyColor',
    themeKey: keyof SectionTheme,
    color: string,
  ) => {
    if (clientId) setBrandStyleValue(clientId, brandKey, color);
    set('theme', omitThemeKey(d.theme, themeKey));
  };

  if (selectedElement === 'eyebrow') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={d.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          placeholder="LOCAL · TRUSTED"
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
          alternatives={HEADLINE_ACCENT_ALTS}
          onChange={(v) => set('headlineAccent', v)}
          multiline
          rows={2}
          helper={<>Second line — rendered in the brand accent colour.</>}
        />
        <VariantField
          label="Size"
          value={d.headlineSize}
          options={HEADLINE_SIZE_OPTIONS}
          onChange={(v) => set('headlineSize', v)}
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
        <VariantField
          label="Size"
          value={d.subSize}
          options={SUB_SIZE_OPTIONS}
          onChange={(v) => set('subSize', v)}
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

  if (selectedElement === 'ctaPrimary' || selectedElement === 'ctaSecondary') {
    const isPrimary = selectedElement === 'ctaPrimary';
    const labelKey = isPrimary ? 'ctaPrimaryLabel' : 'ctaSecondaryLabel';
    const hrefKey = isPrimary ? 'ctaPrimaryHref' : 'ctaSecondaryHref';
    const visibleKey = isPrimary ? 'ctaPrimaryVisible' : 'ctaSecondaryVisible';
    return (
      <BuilderFormSection>
        <ToggleField label="Visible" value={d[visibleKey]} onChange={(v) => set(visibleKey, v)} />
        <CopyField
          label={isPrimary ? 'Primary button · label' : 'Secondary button · label'}
          value={d[labelKey]}
          originalValue={DEFAULTS[labelKey]}
          onChange={(v) => set(labelKey, v)}
        />
        <LinkField
          label="Link"
          value={d[hrefKey]}
          pageLinks={pageLinks}
          onChange={(v) => set(hrefKey, v)}
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
        {d.layout === 'split' ? (
          <VariantField
            label="Image side"
            value={d.imageSide}
            options={IMAGE_SIDE_OPTIONS}
            onChange={(v) => set('imageSide', v)}
          />
        ) : (
          <RangeField
            label="Overlay strength"
            value={d.overlayOpacity}
            onChange={(v) => set('overlayOpacity', v)}
            min={40}
            max={100}
            suffix="%"
            helper={<>How strongly the scrim darkens the image.</>}
          />
        )}
        <VariantField
          label="Alignment"
          value={d.contentAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('contentAlign', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <MediaField
          label="Hero image"
          value={d.heroImageUrl}
          onChange={(v) => set('heroImageUrl', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function HeroPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<HeroData>) {
  const d = withDefaults(data);
  const overlay = d.layout === 'overlay';
  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), HERO_HARDCODED_THEME);
  // The hero places its attached form in its own column — so it tells
  // SectionShell `formSlot="self"` and renders the form itself.
  const slot = useSectionFormSlot();
  const formColumn = slot ? (
    <FormBlock
      form={slot.form}
      brand={slot.brand}
      selectedElement={slot.selectedElement}
      onSelectElement={slot.onSelectElement}
      testSubmitCtx={slot.testSubmitCtx}
    />
  ) : null;

  return (
    <SectionShell
      theme={resolved}
      brand={brand}
      inset="flush"
      pad="none"
      formSlot="self"
      backgroundLayer={
        overlay ? (
          <HeroBackground
            url={d.heroImageUrl}
            scrim={resolved.background}
            opacity={d.overlayOpacity / 100}
          />
        ) : undefined
      }
    >
      {({ theme, headingFont, accent }) => {
        const sel = (id: HeroElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        // A CTA shows when visible + labelled. In the editor a hidden-but-
        // labelled CTA still renders (dimmed) so it can be re-selected.
        const editing = !!onSelectElement;
        const primaryShown = d.ctaPrimaryVisible && !!d.ctaPrimaryLabel;
        const secondaryShown = d.ctaSecondaryVisible && !!d.ctaSecondaryLabel;
        const renderPrimary = primaryShown || (editing && !!d.ctaPrimaryLabel);
        const renderSecondary = secondaryShown || (editing && !!d.ctaSecondaryLabel);

        const content = (
          <div className={`flex flex-col ${ALIGN_CLASS[d.contentAlign]}`}>
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
            <SelectableElement {...sel('headline')} className="mt-4">
              <h2
                className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} font-bold leading-[1.06] tracking-[-0.02em]`}
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
            {d.sub ? (
              <SelectableElement {...sel('subheadline')} className="mt-5">
                <p
                  className={`${SUB_SIZE_CLASS[d.subSize]} max-w-[460px] whitespace-pre-line leading-[1.6]`}
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
            {renderPrimary || renderSecondary ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {renderPrimary ? (
                  <SelectableElement
                    {...sel('ctaPrimary')}
                    display="inline-block"
                    className={primaryShown ? undefined : 'opacity-40'}
                  >
                    <span
                      className="inline-flex items-center rounded-lg px-6 py-3 text-[14px] font-semibold"
                      style={{ backgroundColor: accent, color: '#ffffff' }}
                    >
                      {d.ctaPrimaryLabel}
                    </span>
                  </SelectableElement>
                ) : null}
                {renderSecondary ? (
                  <SelectableElement
                    {...sel('ctaSecondary')}
                    display="inline-block"
                    className={secondaryShown ? undefined : 'opacity-40'}
                  >
                    <span
                      className="inline-flex items-center rounded-lg border px-6 py-3 text-[14px] font-semibold"
                      style={{ borderColor: theme.heading, color: theme.heading }}
                    >
                      {d.ctaSecondaryLabel}
                    </span>
                  </SelectableElement>
                ) : null}
              </div>
            ) : null}
          </div>
        );

        const hasForm = formColumn != null;

        if (overlay) {
          return (
            <div className="flex min-h-[480px] items-center px-8 py-20 @2xl:px-12">
              {hasForm ? (
                // Content + form sit in a centred band so the form is a real
                // column, not a small panel lost in empty space.
                <div className="mx-auto grid w-full max-w-[1060px] items-center gap-12 @2xl:grid-cols-[1fr_400px]">
                  <div className="w-full">{content}</div>
                  {formColumn}
                </div>
              ) : (
                <div className={`w-full max-w-[600px] ${ALIGN_SELF[d.contentAlign]}`}>
                  {content}
                </div>
              )}
            </div>
          );
        }

        const contentCell = (
          <div
            key="content"
            className="flex flex-col justify-center px-8 py-14 @2xl:px-12 @2xl:py-16"
          >
            <div className={`w-full max-w-[520px] ${ALIGN_SELF[d.contentAlign]}`}>{content}</div>
          </div>
        );
        // The second column is the form (when toggled on) or the image.
        const sideCell = hasForm ? (
          <div key="side" className="flex items-center justify-center px-8 py-14 @2xl:px-12">
            {formColumn}
          </div>
        ) : (
          <HeroImage key="side" url={d.heroImageUrl} theme={theme} />
        );

        return (
          <div className="grid min-h-[460px] @2xl:grid-cols-2">
            {d.imageSide === 'left' ? [sideCell, contentCell] : [contentCell, sideCell]}
          </div>
        );
      }}
    </SectionShell>
  );
}

function HeroImage({ url, theme }: { url: string; theme: { card: string; muted: string } }) {
  return (
    <div
      className="relative min-h-[280px] w-full overflow-hidden @2xl:min-h-full"
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
            Hero image
          </span>
        </div>
      )}
    </div>
  );
}

function HeroBackground({ url, scrim, opacity }: { url: string; scrim: string; opacity: number }) {
  const a = (multiplier: number) => {
    const v = Math.round(Math.max(0, Math.min(1, opacity * multiplier)) * 255);
    return v.toString(16).padStart(2, '0');
  };
  return (
    <>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, ${scrim}${a(1)} 0%, ${scrim}${a(0.92)} 38%, ${scrim}${a(0.5)} 100%)`,
        }}
      />
    </>
  );
}

export const heroSection = defineSection<HeroData>({
  type: 'hero',
  label: '// HERO',
  description: 'Above-the-fold lead — eyebrow, two-line headline, sub, two CTAs, image.',
  defaultData,
  Fields: HeroFields,
  Preview: HeroPreview,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'ctaPrimaryLabel',
      'ctaPrimaryHref',
      'ctaSecondaryLabel',
      'ctaSecondaryHref',
    ],
    mediaFields: ['heroImageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    ctaPrimary: 'Primary button',
    ctaSecondary: 'Secondary button',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
