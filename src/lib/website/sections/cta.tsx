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
import { getSectionIcon } from '../section-icons';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
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
// CTA section — end-of-page call to action. Four layouts:
//   centered    — centred copy + buttons, optional trust-signal row
//   split       — copy + buttons on one side, image on the other
//   background  — copy over a full-bleed background image with a scrim
//   dual        — two side-by-side panels, each its own offer + button
// Element-inspector model + brand-default colour inheritance, the hero pattern.
// =============================================================================

export type CtaLayout = 'centered' | 'split' | 'background' | 'dual';
export type CtaAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';

type CtaElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'primaryCta'
  | 'secondaryCta'
  | 'signals'
  | 'panelA'
  | 'panelB';

export type CtaSignal = {
  id: string;
  icon: string;
  label: string;
};

export type CtaPanel = {
  icon: string;
  heading: string;
  sub: string;
  buttonLabel: string;
  buttonHref: string;
};

export type CTAData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: CtaLayout;
  align: CtaAlign;
  headlineSize: HeadlineSize;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  primaryVisible: boolean;
  primaryLabel: string;
  primaryHref: string;
  secondaryVisible: boolean;
  secondaryLabel: string;
  secondaryHref: string;
  showSignals: boolean;
  signals: CtaSignal[];
  imageUrl: string;
  imageSide: 'left' | 'right';
  overlayOpacity: number;
  panelA: CtaPanel;
  panelB: CtaPanel;
  dualDivider: string;
};

/** The CTA's own colours — last link in the resolve chain. */
const CTA_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(): string {
  return `sig-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_SIGNALS: Omit<CtaSignal, 'id'>[] = [
  { icon: 'shield-check', label: '100% satisfaction' },
  { icon: 'lock', label: 'Secure & reliable' },
  { icon: 'headphones', label: '24/7 support' },
];

const DEFAULTS: CTAData = {
  theme: {},
  layout: 'centered',
  align: 'center',
  headlineSize: 'l',
  eyebrow: 'READY TO GET STARTED?',
  headline: "Let's build something great together",
  headlineAccent: '',
  sub: 'Join thousands of satisfied customers who trust us to deliver quality and results.',
  primaryVisible: true,
  primaryLabel: 'Get started now',
  primaryHref: '#',
  secondaryVisible: true,
  secondaryLabel: 'Contact us',
  secondaryHref: '#',
  showSignals: true,
  signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId() })),
  imageUrl: '',
  imageSide: 'right',
  overlayOpacity: 72,
  panelA: {
    icon: 'mail',
    heading: 'Stay in the loop',
    sub: 'Subscribe to our newsletter for the latest updates, tips, and offers.',
    buttonLabel: 'Subscribe now',
    buttonHref: '#',
  },
  panelB: {
    icon: 'headphones',
    heading: 'Need help?',
    sub: 'Our support team is here to help you with anything you need.',
    buttonLabel: 'Contact support',
    buttonHref: '#',
  },
  dualDivider: 'OR',
};

function defaultData(): CTAData {
  return {
    ...DEFAULTS,
    theme: {},
    signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId() })),
    panelA: { ...DEFAULTS.panelA },
    panelB: { ...DEFAULTS.panelB },
  };
}

function withDefaults(data: CTAData): CTAData {
  return {
    ...DEFAULTS,
    ...data,
    signals: data.signals ?? DEFAULTS.signals,
    panelA: { ...DEFAULTS.panelA, ...data.panelA },
    panelB: { ...DEFAULTS.panelB, ...data.panelB },
  };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

// Static class strings — Tailwind scans these literals.
const HEADLINE_SIZE_CLASS: Record<HeadlineSize, string> = {
  m: 'text-[28px] @2xl:text-[34px]',
  l: 'text-[34px] @2xl:text-[44px]',
  xl: 'text-[40px] @2xl:text-[56px]',
};

const ALIGN_ITEMS: Record<CtaAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const ROW_JUSTIFY: Record<CtaAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

// Horizontal placement of a max-width content block within its container.
const ALIGN_SELF: Record<CtaAlign, string> = {
  left: '',
  center: 'mx-auto',
  right: 'ml-auto',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'We help you achieve more',
  'Escape. Explore. Experience.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'Powerful solutions designed to help your business grow, scale, and succeed.',
  'Discover breathtaking results and create something that lasts.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<CtaLayout>[] = [
  { id: 'centered', label: 'Centered' },
  { id: 'split', label: 'Split image' },
  { id: 'background', label: 'Background image' },
  { id: 'dual', label: 'Dual panel' },
];

const ALIGN_OPTIONS: readonly VariantOption<CtaAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const IMAGE_SIDE_OPTIONS: readonly VariantOption<'left' | 'right'>[] = [
  { id: 'left', label: 'Image left' },
  { id: 'right', label: 'Image right' },
];

// -- Fields -----------------------------------------------------------------

function CTAFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<CTAData>) {
  const d = withDefaults(data);
  const set = <K extends keyof CTAData>(key: K, value: CTAData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    CTA_HARDCODED_THEME,
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

  const setSignal = useCallback(
    (index: number, next: CtaSignal) => {
      const signals = d.signals.slice();
      signals[index] = next;
      onChange({ ...d, signals });
    },
    [d, onChange],
  );
  const addSignal = useCallback(() => {
    onChange({
      ...d,
      signals: [...d.signals, { id: makeId(), icon: 'check', label: '' }],
    });
  }, [d, onChange]);
  const removeSignal = useCallback(
    (id: string) => onChange({ ...d, signals: d.signals.filter((s) => s.id !== id) }),
    [d, onChange],
  );

  const setPanel = (key: 'panelA' | 'panelB', next: CtaPanel) =>
    set(key, next);

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

  if (selectedElement === 'primaryCta' || selectedElement === 'secondaryCta') {
    const isPrimary = selectedElement === 'primaryCta';
    const labelKey = isPrimary ? 'primaryLabel' : 'secondaryLabel';
    const hrefKey = isPrimary ? 'primaryHref' : 'secondaryHref';
    const visibleKey = isPrimary ? 'primaryVisible' : 'secondaryVisible';
    return (
      <BuilderFormSection>
        <ToggleField
          label="Visible"
          value={d[visibleKey]}
          onChange={(v) => set(visibleKey, v)}
        />
        <CopyField
          label="Button label"
          value={d[labelKey]}
          originalValue={DEFAULTS[labelKey]}
          onChange={(v) => set(labelKey, v)}
        />
        <CopyField
          label="Link"
          value={d[hrefKey]}
          originalValue={DEFAULTS[hrefKey]}
          onChange={(v) => set(hrefKey, v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'signals') {
    return (
      <>
        <BuilderFormSection>
          <ToggleField
            label="Show signal row"
            value={d.showSignals}
            onChange={(v) => set('showSignals', v)}
          />
        </BuilderFormSection>
        <BuilderFormSection>
          {d.signals.map((signal, i) => (
            <div
              key={signal.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Signal {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeSignal(signal.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <IconField
                value={signal.icon}
                onChange={(v) => setSignal(i, { ...signal, icon: v })}
              />
              <CopyField
                label="Label"
                value={signal.label}
                onChange={(v) => setSignal(i, { ...signal, label: v })}
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addSignal} className="w-full">
                + Add signal
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  if (selectedElement === 'panelA' || selectedElement === 'panelB') {
    const key = selectedElement;
    const panel = d[key];
    const upd = (patch: Partial<CtaPanel>) => setPanel(key, { ...panel, ...patch });
    return (
      <BuilderFormSection>
        <IconField value={panel.icon} onChange={(v) => upd({ icon: v })} />
        <CopyField
          label="Heading"
          value={panel.heading}
          onChange={(v) => upd({ heading: v })}
        />
        <CopyField
          label="Text"
          value={panel.sub}
          onChange={(v) => upd({ sub: v })}
          multiline
          rows={3}
        />
        <BuilderFormRow>
          <CopyField
            label="Button label"
            value={panel.buttonLabel}
            onChange={(v) => upd({ buttonLabel: v })}
          />
          <CopyField
            label="Button link"
            value={panel.buttonHref}
            onChange={(v) => upd({ buttonHref: v })}
          />
        </BuilderFormRow>
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
        {d.layout !== 'dual' ? (
          <VariantField
            label="Alignment"
            value={d.align}
            options={ALIGN_OPTIONS}
            onChange={(v) => set('align', v)}
          />
        ) : null}
        {d.layout === 'split' ? (
          <VariantField
            label="Image side"
            value={d.imageSide}
            options={IMAGE_SIDE_OPTIONS}
            onChange={(v) => set('imageSide', v)}
          />
        ) : null}
        {d.layout === 'background' ? (
          <RangeField
            label="Overlay strength"
            value={d.overlayOpacity}
            onChange={(v) => set('overlayOpacity', v)}
            min={30}
            max={100}
            suffix="%"
          />
        ) : null}
        {d.layout !== 'dual' ? (
          <ToggleField
            label="Trust signals"
            value={d.showSignals}
            onChange={(v) => set('showSignals', v)}
          />
        ) : null}
      </BuilderFormSection>
      {d.layout === 'split' || d.layout === 'background' ? (
        <BuilderFormSection>
          <MediaField
            label={d.layout === 'split' ? 'Side image' : 'Background image'}
            value={d.imageUrl}
            onChange={(v) => set('imageUrl', v)}
          />
        </BuilderFormSection>
      ) : null}
      {d.layout === 'dual' ? (
        <BuilderFormSection>
          <CopyField
            label="Divider label"
            value={d.dualDivider}
            originalValue={DEFAULTS.dualDivider}
            onChange={(v) => set('dualDivider', v)}
            helper={<>The badge between the two panels — e.g. “OR”. Blank hides it.</>}
          />
        </BuilderFormSection>
      ) : null}
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function CTAPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<CTAData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    CTA_HARDCODED_THEME,
  );

  const background = d.layout === 'background';
  const dual = d.layout === 'dual';

  return (
    <SectionShell
      theme={resolved}
      brand={brand}
      pad={background || dual ? 'none' : 'roomy'}
      inset={background || dual ? 'flush' : 'band'}
      backgroundLayer={
        background ? (
          <BackgroundLayer
            url={d.imageUrl}
            scrim={resolved.background}
            opacity={d.overlayOpacity / 100}
          />
        ) : undefined
      }
    >
      {({ theme, headingFont, accent }) => {
        const sel = (id: CtaElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const editing = !!onSelectElement;

        if (dual) {
          return (
            <DualPanels
              data={d}
              theme={theme}
              accent={accent}
              headingFont={headingFont}
              sel={sel}
            />
          );
        }

        // -- centered / split / background share the copy block --
        const primaryShown = d.primaryVisible && !!d.primaryLabel;
        const secondaryShown = d.secondaryVisible && !!d.secondaryLabel;
        const renderPrimary = primaryShown || (editing && !!d.primaryLabel);
        const renderSecondary = secondaryShown || (editing && !!d.secondaryLabel);

        const copy = (
          <div className={`flex flex-col ${ALIGN_ITEMS[d.align]}`}>
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
            {d.sub ? (
              <SelectableElement {...sel('subheadline')} className="mt-4">
                <p
                  className="max-w-[520px] whitespace-pre-line text-[15px] leading-[1.6]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
            {renderPrimary || renderSecondary ? (
              <div className={`mt-7 flex flex-wrap items-center gap-3 ${ROW_JUSTIFY[d.align]}`}>
                {renderPrimary ? (
                  <SelectableElement
                    {...sel('primaryCta')}
                    display="inline-block"
                    className={primaryShown ? undefined : 'opacity-40'}
                  >
                    <CtaButton
                      label={d.primaryLabel}
                      tone={background ? 'light' : 'solid'}
                      accent={accent}
                      theme={theme}
                      arrow
                    />
                  </SelectableElement>
                ) : null}
                {renderSecondary ? (
                  <SelectableElement
                    {...sel('secondaryCta')}
                    display="inline-block"
                    className={secondaryShown ? undefined : 'opacity-40'}
                  >
                    <CtaButton
                      label={d.secondaryLabel}
                      tone="outline"
                      accent={accent}
                      theme={theme}
                    />
                  </SelectableElement>
                ) : null}
              </div>
            ) : null}
            {d.showSignals && d.signals.length > 0 ? (
              <SelectableElement {...sel('signals')} className="mt-8">
                <SignalRow signals={d.signals} theme={theme} accent={accent} />
              </SelectableElement>
            ) : null}
          </div>
        );

        if (d.layout === 'split') {
          const imageCell = (
            <SplitImage key="img" url={d.imageUrl} theme={theme} />
          );
          const copyCell = (
            <div key="copy" className="flex flex-col justify-center">
              {copy}
            </div>
          );
          return (
            <div className="grid items-center gap-10 @3xl:grid-cols-2">
              {d.imageSide === 'left' ? [imageCell, copyCell] : [copyCell, imageCell]}
            </div>
          );
        }

        if (background) {
          return (
            <div className="flex min-h-[360px] flex-col justify-center px-8 py-20 @2xl:px-16">
              <div className={`w-full max-w-[640px] ${ALIGN_SELF[d.align]}`}>
                {copy}
              </div>
            </div>
          );
        }

        // centered
        return <div className="mx-auto w-full max-w-[720px]">{copy}</div>;
      }}
    </SectionShell>
  );
}

// -- layout pieces ----------------------------------------------------------

function DualPanels({
  data,
  theme,
  accent,
  headingFont,
  sel,
}: {
  data: CTAData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
  sel: (id: CtaElement) => { id: CtaElement; selected: boolean; onSelect?: (id: string) => void };
}) {
  return (
    <div className="relative grid @2xl:grid-cols-2">
      <SelectableElement {...sel('panelA')}>
        <DualPanel
          panel={data.panelA}
          variant="soft"
          theme={theme}
          accent={accent}
          headingFont={headingFont}
        />
      </SelectableElement>
      <SelectableElement {...sel('panelB')}>
        <DualPanel
          panel={data.panelB}
          variant="solid"
          theme={theme}
          accent={accent}
          headingFont={headingFont}
        />
      </SelectableElement>
      {data.dualDivider ? (
        <span
          className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] font-bold uppercase tracking-[0.08em]"
          style={{
            backgroundColor: theme.background,
            color: theme.heading,
            border: `1px solid ${theme.border}`,
          }}
        >
          {data.dualDivider}
        </span>
      ) : null}
    </div>
  );
}

function DualPanel({
  panel,
  variant,
  theme,
  accent,
  headingFont,
}: {
  panel: CtaPanel;
  variant: 'soft' | 'solid';
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const solid = variant === 'solid';
  const bg = solid ? accent : mixHex(accent, theme.background, 0.9);
  const heading = solid ? '#ffffff' : theme.heading;
  const body = solid ? 'rgba(255,255,255,0.82)' : theme.body;
  const def = getSectionIcon(panel.icon);
  const Icon = def?.Icon;

  return (
    <div
      className="flex h-full flex-col items-start px-9 py-12 @2xl:px-12"
      style={{ backgroundColor: bg }}
    >
      {Icon ? (
        <span
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: solid ? 'rgba(255,255,255,0.16)' : mixHex(accent, theme.background, 0.72),
          }}
        >
          <Icon size={24} strokeWidth={1.9} color={solid ? '#ffffff' : accent} aria-hidden />
        </span>
      ) : null}
      <h3
        className="text-[22px] font-bold tracking-[-0.01em]"
        style={{ fontFamily: headingFont, color: heading }}
      >
        {panel.heading || 'Panel heading'}
      </h3>
      {panel.sub ? (
        <p
          className="mt-2 max-w-[340px] whitespace-pre-line text-[14px] leading-[1.55]"
          style={{ color: body }}
        >
          {panel.sub}
        </p>
      ) : null}
      {panel.buttonLabel ? (
        <span
          className="mt-5 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13.5px] font-semibold"
          style={{
            backgroundColor: solid ? '#ffffff' : accent,
            color: solid ? accent : '#ffffff',
          }}
        >
          {panel.buttonLabel}
          <span aria-hidden>→</span>
        </span>
      ) : null}
    </div>
  );
}

function CtaButton({
  label,
  tone,
  accent,
  theme,
  arrow = false,
}: {
  label: string;
  tone: 'solid' | 'outline' | 'light';
  accent: string;
  theme: ResolvedTheme;
  arrow?: boolean;
}) {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold';
  if (tone === 'outline') {
    return (
      <span
        className={`${base} border-2`}
        style={{ borderColor: theme.heading, color: theme.heading }}
      >
        {label}
      </span>
    );
  }
  if (tone === 'light') {
    return (
      <span className={base} style={{ backgroundColor: '#ffffff', color: '#0f1115' }}>
        {label}
        {arrow ? <span aria-hidden>→</span> : null}
      </span>
    );
  }
  return (
    <span className={base} style={{ backgroundColor: accent, color: '#ffffff' }}>
      {label}
      {arrow ? <span aria-hidden>→</span> : null}
    </span>
  );
}

function SignalRow({
  signals,
  theme,
  accent,
}: {
  signals: CtaSignal[];
  theme: ResolvedTheme;
  accent: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {signals.map((signal, i) => {
        const def = getSectionIcon(signal.icon);
        const Icon = def?.Icon;
        return (
          <span key={signal.id} className="flex items-center gap-3">
            {i > 0 ? (
              <span
                aria-hidden
                className="h-4 w-px"
                style={{ backgroundColor: theme.border }}
              />
            ) : null}
            <span className="flex items-center gap-1.5">
              {Icon ? (
                <Icon size={16} strokeWidth={2} color={accent} aria-hidden />
              ) : null}
              <span className="text-[13px] font-medium" style={{ color: theme.body }}>
                {signal.label || 'Signal'}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function SplitImage({ url, theme }: { url: string; theme: ResolvedTheme }) {
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl"
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

function BackgroundLayer({
  url,
  scrim,
  opacity,
}: {
  url: string;
  scrim: string;
  opacity: number;
}) {
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
          background: `linear-gradient(100deg, ${scrim}${a(1)} 0%, ${scrim}${a(0.86)} 45%, ${scrim}${a(0.45)} 100%)`,
        }}
      />
    </>
  );
}

export const ctaSection = defineSection<CTAData>({
  type: 'cta',
  label: '// CTA',
  description:
    'Call-to-action block — centered, split-image, background-image, or dual-panel layouts.',
  defaultData,
  Fields: CTAFields,
  Preview: CTAPreview,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'primaryLabel',
      'primaryHref',
      'secondaryLabel',
      'secondaryHref',
      'signals',
      'panelA',
      'panelB',
      'dualDivider',
    ],
    mediaFields: ['imageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    primaryCta: 'Primary button',
    secondaryCta: 'Secondary button',
    signals: 'Trust signals',
    panelA: 'Left panel',
    panelB: 'Right panel',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
