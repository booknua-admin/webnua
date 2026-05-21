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
import { faqMeta } from './registry-meta';
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
import { SurfaceLink } from './_shared/live-surface';
import { gridColumnsClass } from './_shared/grid';
import { IconField } from './_shared/IconField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// FAQ section — a header band and an accordion of question / answer pairs, in
// a centred, grid, or sidebar layout, with an optional footer block (a
// contact link, a help card, or a trust-signal row). Element-inspector model
// + brand-default colour inheritance, the hero pattern.
//
// The preview renders the first item open and the rest collapsed; the live
// site wires the accordion toggle.
// =============================================================================

export type FAQLayout = 'centered' | 'grid' | 'sidebar';
export type FAQAlign = 'left' | 'center' | 'right';
export type FAQFooter = 'none' | 'link' | 'card' | 'signals';
export type HeadlineSize = 'm' | 'l' | 'xl';

type FAQElement = 'eyebrow' | 'headline' | 'subheadline' | 'items' | 'footer';

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export type FAQSignal = {
  id: string;
  icon: string;
  title: string;
  sub: string;
};

export type FAQData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: FAQLayout;
  columns: number;
  headerAlign: FAQAlign;
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  items: FAQItem[];
  footer: FAQFooter;
  footerText: string;
  footerLinkLabel: string;
  footerLinkHref: string;
  footerCardIcon: string;
  footerCardTitle: string;
  footerCardText: string;
  signals: FAQSignal[];
};

/** The FAQ's own colours — last link in the resolve chain. */
const FAQ_HARDCODED_THEME: SectionTheme = {
  background: '#f6f7f9',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_ITEMS: Omit<FAQItem, 'id'>[] = [
  {
    question: 'What areas do you service?',
    answer:
      "We proudly serve all surrounding areas within 50 miles. If you're unsure whether we cover your location, give us a call or send a message.",
  },
  {
    question: 'How do I get a quote?',
    answer:
      'Reach out via the contact form or give us a call — we’ll get back to you with a clear, written quote, usually the same day.',
  },
  {
    question: 'How long does a typical project take?',
    answer:
      'It depends on the scope, but most standard jobs are done within a day. We’ll give you a realistic timeframe up front.',
  },
  {
    question: 'Do you offer warranties on your work?',
    answer:
      'Yes — all our work is backed by a workmanship guarantee, so you can book with confidence.',
  },
];

const SEED_SIGNALS: Omit<FAQSignal, 'id'>[] = [
  { icon: 'shield-check', title: 'Licensed & insured', sub: 'Your property is in safe hands.' },
  { icon: 'star', title: 'Satisfaction guaranteed', sub: "We're not happy until you are." },
  { icon: 'headphones', title: 'Friendly support', sub: 'Here to help, every step of the way.' },
];

const DEFAULTS: FAQData = {
  theme: {},
  layout: 'centered',
  columns: 2,
  headerAlign: 'center',
  headlineSize: 'l',
  showHeadlineRule: false,
  eyebrow: 'FAQ',
  headline: 'Frequently asked questions',
  headlineAccent: '',
  sub: 'Find answers to the most common questions about our services and process.',
  items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('faq') })),
  footer: 'link',
  footerText: 'Still have questions?',
  footerLinkLabel: 'Contact us',
  footerLinkHref: '/contact',
  footerCardIcon: 'headphones',
  footerCardTitle: 'Need more help?',
  footerCardText: 'Our team is here for you.',
  signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId('sig') })),
};

function defaultData(): FAQData {
  return {
    ...DEFAULTS,
    theme: {},
    items: SEED_ITEMS.map((it) => ({ ...it, id: makeId('faq') })),
    signals: SEED_SIGNALS.map((s) => ({ ...s, id: makeId('sig') })),
  };
}

function withDefaults(data: FAQData): FAQData {
  return {
    ...DEFAULTS,
    ...data,
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
  m: 'text-[26px] @2xl:text-[32px]',
  l: 'text-[30px] @2xl:text-[40px]',
  xl: 'text-[36px] @2xl:text-[48px]',
};

const ALIGN_CLASS: Record<FAQAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  "Got questions? We've got answers.",
  'Everything you need to know',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'Here are some of the most common questions we get.',
  'Clear answers to help you feel confident from start to finish.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<FAQLayout>[] = [
  { id: 'centered', label: 'Centred' },
  { id: 'grid', label: 'Grid' },
  { id: 'sidebar', label: 'Sidebar' },
];

const ALIGN_OPTIONS: readonly VariantOption<FAQAlign>[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const HEADLINE_SIZE_OPTIONS: readonly VariantOption<HeadlineSize>[] = [
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

const FOOTER_OPTIONS: readonly VariantOption<FAQFooter>[] = [
  { id: 'none', label: 'None' },
  { id: 'link', label: 'Contact link' },
  { id: 'card', label: 'Help card' },
  { id: 'signals', label: 'Trust signals' },
];

// -- Fields -----------------------------------------------------------------

function FAQFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<FAQData>) {
  const d = withDefaults(data);
  const set = <K extends keyof FAQData>(key: K, value: FAQData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FAQ_HARDCODED_THEME,
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
    (index: number, next: FAQItem) => {
      const items = d.items.slice();
      items[index] = next;
      onChange({ ...d, items });
    },
    [d, onChange],
  );
  const addItem = useCallback(() => {
    onChange({
      ...d,
      items: [...d.items, { id: makeId('faq'), question: '', answer: '' }],
    });
  }, [d, onChange]);
  const removeItem = useCallback(
    (id: string) => onChange({ ...d, items: d.items.filter((it) => it.id !== id) }),
    [d, onChange],
  );

  const setSignal = useCallback(
    (index: number, next: FAQSignal) => {
      const signals = d.signals.slice();
      signals[index] = next;
      onChange({ ...d, signals });
    },
    [d, onChange],
  );
  const addSignal = useCallback(() => {
    onChange({
      ...d,
      signals: [...d.signals, { id: makeId('sig'), icon: 'check', title: '', sub: '' }],
    });
  }, [d, onChange]);
  const removeSignal = useCallback(
    (id: string) => onChange({ ...d, signals: d.signals.filter((s) => s.id !== id) }),
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
    return (
      <>
        <BuilderFormSection>
          {d.layout === 'grid' ? (
            <ColumnsField
              value={d.columns}
              onChange={(v) => set('columns', v)}
              min={1}
              max={2}
            />
          ) : (
            <p className="text-[12px] text-ink-quiet">
              This layout shows questions in a single column.
            </p>
          )}
        </BuilderFormSection>
        <BuilderFormSection>
          {d.items.map((item, i) => (
            <div
              key={item.id}
              className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Q · {i + 1}
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
                label="Question"
                value={item.question}
                onChange={(v) => setItem(i, { ...item, question: v })}
              />
              <CopyField
                label="Answer"
                value={item.answer}
                onChange={(v) => setItem(i, { ...item, answer: v })}
                multiline
                rows={3}
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
                + Add question
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  if (selectedElement === 'footer') {
    return (
      <>
        <BuilderFormSection>
          <VariantField
            label="Footer block"
            value={d.footer}
            options={FOOTER_OPTIONS}
            onChange={(v) => set('footer', v)}
          />
        </BuilderFormSection>
        {d.footer === 'link' ? (
          <BuilderFormSection>
            <CopyField
              label="Text"
              value={d.footerText}
              originalValue={DEFAULTS.footerText}
              onChange={(v) => set('footerText', v)}
            />
            <BuilderFormRow>
              <CopyField
                label="Link label"
                value={d.footerLinkLabel}
                originalValue={DEFAULTS.footerLinkLabel}
                onChange={(v) => set('footerLinkLabel', v)}
              />
              <CopyField
                label="Link URL"
                value={d.footerLinkHref}
                originalValue={DEFAULTS.footerLinkHref}
                onChange={(v) => set('footerLinkHref', v)}
              />
            </BuilderFormRow>
          </BuilderFormSection>
        ) : null}
        {d.footer === 'card' ? (
          <BuilderFormSection>
            <IconField value={d.footerCardIcon} onChange={(v) => set('footerCardIcon', v)} />
            <CopyField
              label="Card title"
              value={d.footerCardTitle}
              originalValue={DEFAULTS.footerCardTitle}
              onChange={(v) => set('footerCardTitle', v)}
            />
            <CopyField
              label="Card text"
              value={d.footerCardText}
              originalValue={DEFAULTS.footerCardText}
              onChange={(v) => set('footerCardText', v)}
            />
            <BuilderFormRow>
              <CopyField
                label="Link label"
                value={d.footerLinkLabel}
                originalValue={DEFAULTS.footerLinkLabel}
                onChange={(v) => set('footerLinkLabel', v)}
              />
              <CopyField
                label="Link URL"
                value={d.footerLinkHref}
                originalValue={DEFAULTS.footerLinkHref}
                onChange={(v) => set('footerLinkHref', v)}
              />
            </BuilderFormRow>
          </BuilderFormSection>
        ) : null}
        {d.footer === 'signals' ? (
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
                  label="Title"
                  value={signal.title}
                  onChange={(v) => setSignal(i, { ...signal, title: v })}
                />
                <CopyField
                  label="Caption"
                  value={signal.sub}
                  onChange={(v) => setSignal(i, { ...signal, sub: v })}
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
        ) : null}
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
          <ColumnsField value={d.columns} onChange={(v) => set('columns', v)} min={1} max={2} />
        ) : null}
        {d.layout !== 'sidebar' ? (
          <VariantField
            label="Header alignment"
            value={d.headerAlign}
            options={ALIGN_OPTIONS}
            onChange={(v) => set('headerAlign', v)}
          />
        ) : null}
        <VariantField
          label="Footer block"
          value={d.footer}
          options={FOOTER_OPTIONS}
          onChange={(v) => set('footer', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function FAQPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<FAQData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FAQ_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: FAQElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const sidebar = d.layout === 'sidebar';

        const header = (
          <div
            className={`flex flex-col ${ALIGN_CLASS[sidebar ? 'left' : d.headerAlign]}`}
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
                className={`${HEADLINE_SIZE_CLASS[d.headlineSize]} whitespace-pre-line font-bold leading-[1.14] tracking-[-0.02em]`}
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
                  className="max-w-[520px] whitespace-pre-line text-[15px] leading-[1.6]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
          </div>
        );

        const accordion = (
          <SelectableElement {...sel('items')}>
            {d.items.length === 0 ? (
              <p
                className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px]"
                style={{ borderColor: theme.border, color: theme.muted }}
              >
                No questions yet. Add one in the editor.
              </p>
            ) : (
              <div
                className={
                  d.layout === 'grid'
                    ? `grid gap-3 ${gridColumnsClass(d.columns)}`
                    : 'flex flex-col gap-3'
                }
              >
                {d.items.map((item, i) => (
                  <FaqRow
                    key={item.id}
                    item={item}
                    open={i === 0}
                    theme={theme}
                    accent={accent}
                    headingFont={headingFont}
                  />
                ))}
              </div>
            )}
          </SelectableElement>
        );

        const footer =
          d.footer !== 'none' ? (
            <SelectableElement {...sel('footer')} className="mt-8">
              <FaqFooter
                data={d}
                theme={theme}
                accent={accent}
                headingFont={headingFont}
                centered={!sidebar}
              />
            </SelectableElement>
          ) : null;

        if (sidebar) {
          return (
            <div className="grid gap-10 @3xl:grid-cols-[0.8fr_1.2fr]">
              <div className="flex flex-col justify-start">{header}</div>
              <div className="flex flex-col">
                {accordion}
                {footer}
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col">
            <div className="mb-9">{header}</div>
            <div className="mx-auto w-full max-w-[860px]">{accordion}</div>
            {footer ? (
              <div className="mx-auto w-full max-w-[860px]">{footer}</div>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

function FaqRow({
  item,
  open,
  theme,
  accent,
  headingFont,
}: {
  item: FAQItem;
  open: boolean;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        backgroundColor: open ? mixHex(accent, theme.background, 0.9) : theme.card,
        border: `1px solid ${open ? mixHex(accent, theme.background, 0.6) : theme.cardBorder}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <p
          className="text-[15px] font-semibold leading-snug"
          style={{ fontFamily: headingFont, color: open ? accent : theme.heading }}
        >
          {item.question || 'Question'}
        </p>
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-[18px] font-bold leading-none"
          style={{ color: open ? accent : theme.muted }}
        >
          {open ? '−' : '+'}
        </span>
      </div>
      {open && item.answer ? (
        <p
          className="mt-2.5 max-w-[640px] whitespace-pre-line text-[13.5px] leading-[1.6]"
          style={{ color: theme.body }}
        >
          {item.answer}
        </p>
      ) : null}
    </div>
  );
}

function FaqFooter({
  data,
  theme,
  accent,
  headingFont,
  centered,
}: {
  data: FAQData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
  centered: boolean;
}) {
  if (data.footer === 'link') {
    return (
      <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
        <span className="text-[14px]" style={{ color: theme.body }}>
          {data.footerText}
        </span>
        <SurfaceLink
          href={data.footerLinkHref}
          className="text-[14px] font-semibold"
          style={{ color: accent }}
        >
          {data.footerLinkLabel || 'Contact us'}
        </SurfaceLink>
      </div>
    );
  }

  if (data.footer === 'card') {
    const def = getSectionIcon(data.footerCardIcon);
    const Icon = def?.Icon;
    return (
      <div
        className="flex flex-wrap items-center gap-4 rounded-xl px-5 py-4"
        style={{
          backgroundColor: mixHex(accent, theme.background, 0.9),
          border: `1px solid ${mixHex(accent, theme.background, 0.62)}`,
        }}
      >
        {Icon ? (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: mixHex(accent, theme.background, 0.7) }}
          >
            <Icon size={20} strokeWidth={1.9} color={accent} aria-hidden />
          </span>
        ) : null}
        <div className="flex-1">
          <p
            className="text-[14px] font-bold"
            style={{ fontFamily: headingFont, color: theme.heading }}
          >
            {data.footerCardTitle || 'Need help?'}
          </p>
          {data.footerCardText ? (
            <p className="text-[12.5px]" style={{ color: theme.body }}>
              {data.footerCardText}
            </p>
          ) : null}
        </div>
        {data.footerLinkLabel ? (
          <SurfaceLink
            href={data.footerLinkHref}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold"
            style={{ backgroundColor: accent, color: '#ffffff' }}
          >
            {data.footerLinkLabel}
            <span aria-hidden>→</span>
          </SurfaceLink>
        ) : null}
      </div>
    );
  }

  // signals
  return (
    <div className="grid grid-cols-1 gap-5 @lg:grid-cols-3">
      {data.signals.map((signal) => {
        const def = getSectionIcon(signal.icon);
        const Icon = def?.Icon;
        return (
          <div key={signal.id} className="flex items-start gap-3">
            {Icon ? (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
              >
                <Icon size={19} strokeWidth={1.9} color={accent} aria-hidden />
              </span>
            ) : null}
            <div>
              <p
                className="text-[14px] font-bold leading-tight"
                style={{ fontFamily: headingFont, color: theme.heading }}
              >
                {signal.title || 'Signal'}
              </p>
              {signal.sub ? (
                <p className="mt-0.5 text-[12.5px]" style={{ color: theme.body }}>
                  {signal.sub}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const faqSection = defineSection<FAQData>({
  ...faqMeta,
  defaultData,
  Fields: FAQFields,
  Preview: FAQPreview,
});
