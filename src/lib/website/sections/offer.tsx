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
import { ColumnsField } from './_shared/ColumnsField';
import { CopyField } from './_shared/CopyField';
import { LinkField } from './_shared/LinkField';
import { gridColumnsClass } from './_shared/grid';
import { IconField } from './_shared/IconField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Offer section — two modes:
//   card  — a single-offer card: price, inclusions, scarcity, CTA, image.
//   stack — a value stack: a header over a grid/list of value components
//           (icon + title + description), trust signals, and a CTA.
// Element-inspector model + brand-default colour inheritance, the hero pattern.
// =============================================================================

export type OfferLayout = 'card' | 'stack';
export type OfferStackStyle = 'grid' | 'list';
export type OfferAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';

type OfferElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'price'
  | 'inclusions'
  | 'scarcity'
  | 'media'
  | 'items'
  | 'signals'
  | 'cta';

export type OfferInclusion = { id: string; text: string };
export type OfferValueItem = { id: string; icon: string; title: string; description: string };
export type OfferSignal = { id: string; icon: string; label: string };

export type OfferData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: OfferLayout;
  headerAlign: OfferAlign;
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  tag: string;
  title: string;
  titleAccent: string;
  sub: string;
  // -- card mode --
  priceLabel: string;
  priceCaption: string;
  inclusions: OfferInclusion[];
  scarcityCopy: string;
  imageUrl: string;
  // -- stack mode --
  items: OfferValueItem[];
  stackStyle: OfferStackStyle;
  columns: number;
  showNumbers: boolean;
  // -- shared --
  showSignals: boolean;
  signals: OfferSignal[];
  ctaVisible: boolean;
  ctaLabel: string;
  ctaHref: string;
};

/** The offer's own colours — last link in the resolve chain. */
const OFFER_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_INCLUSIONS: string[] = [
  'No call-out surcharges, ever',
  'Same-day repair quote, written',
  'All work covered by our 12-month workmanship guarantee',
];

const SEED_ITEMS: Omit<OfferValueItem, 'id'>[] = [
  {
    icon: 'monitor',
    title: 'A conversion-focused website',
    description: 'Built to turn visitors into booked jobs. Live in 14 days.',
  },
  {
    icon: 'target',
    title: 'Local ad targeting',
    description: 'Ads targeting high-intent local searches, managed daily.',
  },
  {
    icon: 'users',
    title: 'Retargeting that works',
    description: 'Lookalike audiences bring ready-to-buy locals back.',
  },
  {
    icon: 'message',
    title: 'Fast lead follow-up',
    description: 'Every lead contacted within 5 minutes via SMS + email.',
  },
  {
    icon: 'star',
    title: 'Automated reviews',
    description: 'Review requests fire after every completed job.',
  },
  {
    icon: 'gauge',
    title: 'A weekly scoreboard',
    description: 'One simple update every Monday — what is working.',
  },
];

const SEED_SIGNALS: Omit<OfferSignal, 'id'>[] = [
  { icon: 'check', label: 'No lock-in contracts' },
  { icon: 'check', label: 'Transparent reporting' },
  { icon: 'check', label: 'Built for trades' },
];

const DEFAULTS: OfferData = {
  theme: {},
  layout: 'card',
  headerAlign: 'center',
  headlineSize: 'l',
  showHeadlineRule: false,
  tag: 'THE OFFER',
  title: 'Local sparkie, $99 callout, on-site in under 60 minutes.',
  titleAccent: '',
  sub: 'Everything you need to win more jobs — done for you.',
  priceLabel: '$99',
  priceCaption: 'Fixed call-out fee',
  inclusions: SEED_INCLUSIONS.map((text) => ({ id: makeId('inc'), text })),
  scarcityCopy: 'Limited to 5 emergency slots per day.',
  imageUrl: '',
  items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('val') })),
  stackStyle: 'grid',
  columns: 2,
  showNumbers: false,
  showSignals: true,
  signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId('sig') })),
  ctaVisible: true,
  ctaLabel: 'Book my callout',
  ctaHref: '/schedule',
};

function defaultData(): OfferData {
  return {
    ...DEFAULTS,
    theme: {},
    inclusions: SEED_INCLUSIONS.map((text) => ({ id: makeId('inc'), text })),
    items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('val') })),
    signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId('sig') })),
  };
}

function withDefaults(data: OfferData): OfferData {
  return {
    ...DEFAULTS,
    ...data,
    inclusions: data.inclusions ?? DEFAULTS.inclusions,
    items: data.items ?? DEFAULTS.items,
    signals: data.signals ?? DEFAULTS.signals,
  };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

// Static class strings — Tailwind scans these literals.
const HEADLINE_SIZE_CLASS: Record<HeadlineSize, string> = {
  m: 'text-[24px] @2xl:text-[30px]',
  l: 'text-[28px] @2xl:text-[38px]',
  xl: 'text-[34px] @2xl:text-[46px]',
};

const ALIGN_CLASS: Record<OfferAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const ROW_JUSTIFY: Record<OfferAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const TITLE_ALTS = [
  DEFAULTS.title,
  '$99 emergency callout — sparkie at your door inside the hour.',
  'The all-in-one growth system for trades.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'Everything we do, built to get you more jobs.',
  'We handle the marketing. You handle the job.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<OfferLayout>[] = [
  { id: 'card', label: 'Offer card' },
  { id: 'stack', label: 'Value stack' },
];

const STACK_STYLE_OPTIONS: readonly VariantOption<OfferStackStyle>[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'list', label: 'List' },
];

const ALIGN_OPTIONS: readonly VariantOption<OfferAlign>[] = [
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

function OfferFields({
  data,
  onChange,
  selectedElement,
  pageLinks,
  clientId,
  brand,
}: SectionFieldsProps<OfferData>) {
  const d = withDefaults(data);
  const set = <K extends keyof OfferData>(key: K, value: OfferData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), OFFER_HARDCODED_THEME);

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

  const setInclusion = useCallback(
    (index: number, text: string) => {
      const inclusions = d.inclusions.slice();
      inclusions[index] = { ...inclusions[index], text };
      onChange({ ...d, inclusions });
    },
    [d, onChange],
  );
  const addInclusion = useCallback(() => {
    onChange({ ...d, inclusions: [...d.inclusions, { id: makeId('inc'), text: '' }] });
  }, [d, onChange]);
  const removeInclusion = useCallback(
    (id: string) => onChange({ ...d, inclusions: d.inclusions.filter((i) => i.id !== id) }),
    [d, onChange],
  );

  const setItem = useCallback(
    (index: number, next: OfferValueItem) => {
      const items = d.items.slice();
      items[index] = next;
      onChange({ ...d, items });
    },
    [d, onChange],
  );
  const addItem = useCallback(() => {
    onChange({
      ...d,
      items: [...d.items, { id: makeId('val'), icon: 'check', title: '', description: '' }],
    });
  }, [d, onChange]);
  const removeItem = useCallback(
    (id: string) => onChange({ ...d, items: d.items.filter((i) => i.id !== id) }),
    [d, onChange],
  );

  const setSignal = useCallback(
    (index: number, next: OfferSignal) => {
      const signals = d.signals.slice();
      signals[index] = next;
      onChange({ ...d, signals });
    },
    [d, onChange],
  );
  const addSignal = useCallback(() => {
    onChange({ ...d, signals: [...d.signals, { id: makeId('sig'), icon: 'check', label: '' }] });
  }, [d, onChange]);
  const removeSignal = useCallback(
    (id: string) => onChange({ ...d, signals: d.signals.filter((s) => s.id !== id) }),
    [d, onChange],
  );

  if (selectedElement === 'eyebrow') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Eyebrow / tag"
          value={d.tag}
          originalValue={DEFAULTS.tag}
          onChange={(v) => set('tag', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'headline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Headline"
          value={d.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => set('title', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Accent line"
          value={d.titleAccent}
          originalValue={DEFAULTS.titleAccent}
          onChange={(v) => set('titleAccent', v)}
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

  if (selectedElement === 'price') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Price"
          value={d.priceLabel}
          originalValue={DEFAULTS.priceLabel}
          onChange={(v) => set('priceLabel', v)}
          placeholder="$99"
        />
        <CopyField
          label="Price caption"
          value={d.priceCaption}
          originalValue={DEFAULTS.priceCaption}
          onChange={(v) => set('priceCaption', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'inclusions') {
    return (
      <BuilderFormSection>
        {d.inclusions.map((inc, i) => (
          <div key={inc.id} className="mb-2 flex items-end gap-2 last:mb-0">
            <div className="flex-1">
              <CopyField
                label={`Inclusion ${i + 1}`}
                value={inc.text}
                onChange={(v) => setInclusion(i, v)}
              />
            </div>
            <CapabilityGate capability="editLayout" mode="hide">
              <button
                type="button"
                onClick={() => removeInclusion(inc.id)}
                className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
              >
                ×
              </button>
            </CapabilityGate>
          </div>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button variant="secondary" size="sm" onClick={addInclusion} className="w-full">
              + Add inclusion
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'scarcity') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Scarcity line"
          value={d.scarcityCopy}
          originalValue={DEFAULTS.scarcityCopy}
          onChange={(v) => set('scarcityCopy', v)}
          helper={<>Leave blank to hide the scarcity banner.</>}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'media') {
    return (
      <BuilderFormSection>
        <MediaField label="Offer image" value={d.imageUrl} onChange={(v) => set('imageUrl', v)} />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'items') {
    return (
      <>
        <BuilderFormSection>
          <VariantField
            label="Stack style"
            value={d.stackStyle}
            options={STACK_STYLE_OPTIONS}
            onChange={(v) => set('stackStyle', v)}
          />
          {d.stackStyle === 'grid' ? (
            <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={2} max={6} />
          ) : null}
          <ToggleField
            label="Number the items"
            value={d.showNumbers}
            onChange={(v) => set('showNumbers', v)}
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
              <IconField value={item.icon} onChange={(v) => setItem(i, { ...item, icon: v })} />
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
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
                + Add item
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
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

  if (selectedElement === 'cta') {
    return (
      <BuilderFormSection>
        <ToggleField label="Visible" value={d.ctaVisible} onChange={(v) => set('ctaVisible', v)} />
        <CopyField
          label="Button label"
          value={d.ctaLabel}
          originalValue={DEFAULTS.ctaLabel}
          onChange={(v) => set('ctaLabel', v)}
        />
        <LinkField
          label="Link"
          value={d.ctaHref}
          pageLinks={pageLinks}
          onChange={(v) => set('ctaHref', v)}
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
        {d.layout === 'stack' ? (
          <>
            <VariantField
              label="Stack style"
              value={d.stackStyle}
              options={STACK_STYLE_OPTIONS}
              onChange={(v) => set('stackStyle', v)}
            />
            {d.stackStyle === 'grid' ? (
              <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={2} max={6} />
            ) : null}
            <ToggleField
              label="Number the items"
              value={d.showNumbers}
              onChange={(v) => set('showNumbers', v)}
            />
            <VariantField
              label="Header alignment"
              value={d.headerAlign}
              options={ALIGN_OPTIONS}
              onChange={(v) => set('headerAlign', v)}
            />
          </>
        ) : null}
        <ToggleField
          label="Trust signals"
          value={d.showSignals}
          onChange={(v) => set('showSignals', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function OfferPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<OfferData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), OFFER_HARDCODED_THEME);

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: OfferElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const editing = !!onSelectElement;

        const ctaShown = d.ctaVisible && !!d.ctaLabel;
        const renderCta = ctaShown || (editing && !!d.ctaLabel);
        const ctaNode = renderCta ? (
          <SelectableElement
            {...sel('cta')}
            display="inline-block"
            className={ctaShown ? undefined : 'opacity-40'}
          >
            <span
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold"
              style={{ backgroundColor: accent, color: '#ffffff' }}
            >
              {d.ctaLabel}
              <span aria-hidden>→</span>
            </span>
          </SelectableElement>
        ) : null;

        const signals =
          d.showSignals && d.signals.length > 0 ? (
            <SelectableElement {...sel('signals')}>
              <SignalRow signals={d.signals} theme={theme} accent={accent} />
            </SelectableElement>
          ) : null;

        // -- card mode -----------------------------------------------------
        if (d.layout === 'card') {
          return (
            <div className="grid items-center gap-10 @3xl:grid-cols-2">
              <div className="flex flex-col">
                {d.tag ? (
                  <SelectableElement {...sel('eyebrow')}>
                    <p
                      className="text-[12px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: accent }}
                    >
                      {d.tag}
                    </p>
                  </SelectableElement>
                ) : null}
                <SelectableElement {...sel('headline')} className="mt-3">
                  <h2
                    className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} whitespace-pre-line font-bold leading-[1.16] tracking-[-0.02em]`}
                    style={{ fontFamily: headingFont, color: theme.heading }}
                  >
                    {d.title}
                    {d.titleAccent ? (
                      <span className="block" style={{ color: accent }}>
                        {d.titleAccent}
                      </span>
                    ) : null}
                  </h2>
                </SelectableElement>
                <SelectableElement {...sel('price')} className="mt-5">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-[44px] font-extrabold leading-none tracking-[-0.02em]"
                      style={{ color: accent }}
                    >
                      {d.priceLabel}
                    </span>
                    {d.priceCaption ? (
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: theme.muted }}
                      >
                        {d.priceCaption}
                      </span>
                    ) : null}
                  </div>
                </SelectableElement>
                {d.inclusions.length > 0 ? (
                  <SelectableElement {...sel('inclusions')} className="mt-5">
                    <ul className="flex flex-col gap-2.5">
                      {d.inclusions.map((inc) => (
                        <li key={inc.id} className="flex items-start gap-2.5">
                          <CheckDot accent={accent} />
                          <span className="text-[14px]" style={{ color: theme.heading }}>
                            {inc.text || 'Inclusion'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SelectableElement>
                ) : null}
                {d.scarcityCopy ? (
                  <SelectableElement {...sel('scarcity')} className="mt-5">
                    <p
                      className="rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: mixHex('#c44444', theme.background, 0.86),
                        color: '#c44444',
                      }}
                    >
                      {d.scarcityCopy}
                    </p>
                  </SelectableElement>
                ) : null}
                {ctaNode ? <div className="mt-6">{ctaNode}</div> : null}
                {signals ? <div className="mt-6">{signals}</div> : null}
              </div>
              <SelectableElement {...sel('media')}>
                <OfferImage url={d.imageUrl} theme={theme} />
              </SelectableElement>
            </div>
          );
        }

        // -- stack mode ----------------------------------------------------
        return (
          <div className="flex flex-col">
            <div className={`mb-10 flex flex-col ${ALIGN_CLASS[d.headerAlign]}`}>
              {d.tag ? (
                <SelectableElement {...sel('eyebrow')}>
                  <p
                    className="text-[12px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent }}
                  >
                    {d.tag}
                  </p>
                </SelectableElement>
              ) : null}
              <SelectableElement {...sel('headline')} className="mt-3">
                <h2
                  className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} whitespace-pre-line font-bold leading-[1.14] tracking-[-0.02em]`}
                  style={{ fontFamily: headingFont, color: theme.heading }}
                >
                  {d.title}
                  {d.titleAccent ? (
                    <span className="block" style={{ color: accent }}>
                      {d.titleAccent}
                    </span>
                  ) : null}
                </h2>
              </SelectableElement>
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

            <SelectableElement {...sel('items')}>
              {d.stackStyle === 'list' ? (
                <div className="flex flex-col gap-3">
                  {d.items.map((item, i) => (
                    <ValueRow
                      key={item.id}
                      item={item}
                      index={i}
                      data={d}
                      theme={theme}
                      accent={accent}
                      headingFont={headingFont}
                    />
                  ))}
                </div>
              ) : (
                <div className={`grid gap-6 ${gridColumnsClass(d.columns)}`}>
                  {d.items.map((item, i) => (
                    <ValueCell
                      key={item.id}
                      item={item}
                      index={i}
                      data={d}
                      theme={theme}
                      accent={accent}
                      headingFont={headingFont}
                    />
                  ))}
                </div>
              )}
            </SelectableElement>

            {signals ? (
              <div className={`mt-9 flex ${ROW_JUSTIFY[d.headerAlign]}`}>{signals}</div>
            ) : null}
            {ctaNode ? (
              <div className={`mt-7 flex ${ROW_JUSTIFY[d.headerAlign]}`}>{ctaNode}</div>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

function CheckDot({ accent }: { accent: string }) {
  return (
    <span
      className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: accent }}
      aria-hidden
    >
      ✓
    </span>
  );
}

function NumberBadge({
  index,
  theme,
  accent,
}: {
  index: number;
  theme: ResolvedTheme;
  accent: string;
}) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-bold"
      style={{ backgroundColor: mixHex(accent, theme.background, 0.86), color: accent }}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  );
}

function ValueCell({
  item,
  index,
  data,
  theme,
  accent,
  headingFont,
}: {
  item: OfferValueItem;
  index: number;
  data: OfferData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {data.showNumbers ? <NumberBadge index={index} theme={theme} accent={accent} /> : null}
        {Icon ? (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
          >
            <Icon size={20} strokeWidth={1.9} color={accent} aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className="mt-1 text-[15px] font-bold leading-tight"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {item.title || 'Value item'}
      </p>
      {item.description ? (
        <p className="text-[13px] leading-[1.55]" style={{ color: theme.body }}>
          {item.description}
        </p>
      ) : null}
    </div>
  );
}

function ValueRow({
  item,
  index,
  data,
  theme,
  accent,
  headingFont,
}: {
  item: OfferValueItem;
  index: number;
  data: OfferData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  return (
    <div
      className="flex items-center gap-4 rounded-xl px-5 py-4"
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {data.showNumbers ? <NumberBadge index={index} theme={theme} accent={accent} /> : null}
      {Icon ? (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
        >
          <Icon size={20} strokeWidth={1.9} color={accent} aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p
          className="text-[15px] font-bold leading-tight"
          style={{ fontFamily: headingFont, color: theme.heading }}
        >
          {item.title || 'Value item'}
        </p>
        {item.description ? (
          <p className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: theme.body }}>
            {item.description}
          </p>
        ) : null}
      </div>
      <CheckDot accent={accent} />
    </div>
  );
}

function SignalRow({
  signals,
  theme,
  accent,
}: {
  signals: OfferSignal[];
  theme: ResolvedTheme;
  accent: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {signals.map((signal) => {
        const def = getSectionIcon(signal.icon);
        const Icon = def?.Icon;
        return (
          <span key={signal.id} className="flex items-center gap-1.5">
            {Icon ? <Icon size={16} strokeWidth={2} color={accent} aria-hidden /> : null}
            <span className="text-[13px] font-medium" style={{ color: theme.body }}>
              {signal.label || 'Signal'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function OfferImage({ url, theme }: { url: string; theme: ResolvedTheme }) {
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
            Offer image
          </span>
        </div>
      )}
    </div>
  );
}

export const offerSection = defineSection<OfferData>({
  type: 'offer',
  label: '// OFFER',
  description:
    'Offer block — a single-offer card (price, inclusions, scarcity) or a value stack of components.',
  defaultData,
  Fields: OfferFields,
  Preview: OfferPreview,
  capabilityHints: {
    copyFields: [
      'tag',
      'title',
      'titleAccent',
      'sub',
      'priceLabel',
      'priceCaption',
      'inclusions',
      'scarcityCopy',
      'items',
      'signals',
      'ctaLabel',
      'ctaHref',
    ],
    mediaFields: ['imageUrl'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    price: 'Price',
    inclusions: 'Inclusions',
    scarcity: 'Scarcity line',
    media: 'Image',
    items: 'Value items',
    signals: 'Trust signals',
    cta: 'Button',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
