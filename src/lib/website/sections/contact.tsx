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
import { POPUP_HREF } from '../popup-config';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { contactMeta } from './registry-meta';
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
import { LinkField } from './_shared/LinkField';
import { MediaField } from './_shared/MediaField';
import {
  coerceImageDisplay,
  defaultImageDisplay,
  imageBoxClasses,
  type ImageDisplay,
} from './_shared/image-display';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { BundleButton } from './_shared/BundleButton';
import { SurfaceLink } from './_shared/live-surface';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Contact section — a header band, a row/grid of contact-detail items
// (phone, email, address, hours), and a "send us a message" form, in one of
// four arrangements. Element-inspector model + brand-default colour
// inheritance, the hero pattern.
//
// The form is a visual placeholder this session — submission + validation
// land in the dedicated forms session, the same as the hero's form block.
// The map renders an uploaded image (a live embed waits for a maps
// integration).
// =============================================================================

export type ContactLayout =
  | 'details'
  | 'cards'
  | 'map'
  | 'stacked'
  /** V3 — single column centred, one big headline, one primary CTA opening
   *  the popup form modal, optional phone number prominently below as a
   *  `tel:` link. No details grid, no image. Pass D image-injection is
   *  skipped for this variant (see `shouldSkipStockImageInjection`). */
  | 'minimal-cta';
export type ContactAlign = 'left' | 'center' | 'right';
export type HeadlineSize = 'm' | 'l' | 'xl';

type ContactElement =
  | 'eyebrow'
  | 'headline'
  | 'subheadline'
  | 'items'
  | 'cta'
  | 'form'
  | 'media';

export type ContactInfoItem = {
  id: string;
  icon: string;
  label: string;
  value: string;
  sub: string;
};

export type ContactData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: ContactLayout;
  headerAlign: ContactAlign;
  headlineSize: HeadlineSize;
  showHeadlineRule: boolean;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  items: ContactInfoItem[];
  /** When true, the inline message form renders alongside the contact
   *  details (the historical contact-section shape). When false (the
   *  default for new sections), a single primary CTA renders instead —
   *  its `ctaHref` decides what happens (open the popup form modal,
   *  navigate to a page, dial a phone, open an email client). The
   *  reusable popup modal is the platform-level `Section.popup`
   *  envelope + `PopupHost` — no contact-specific modal. */
  showInlineForm: boolean;
  /** Label shown on the contact CTA (when `showInlineForm` is false). */
  ctaLabel: string;
  /** CTA destination. `'#popup'` (POPUP_HREF) → opens the section's popup
   *  form modal. A page path / full URL / `tel:` / `mailto:` → SurfaceLink
   *  routes accordingly. Empty → button renders inert. */
  ctaHref: string;
  formTitle: string;
  formButtonLabel: string;
  showPhoneField: boolean;
  imageUrl: string;
  mapImageUrl: string;
  imageDisplay: ImageDisplay;
  mapImageDisplay: ImageDisplay;
};

/** The contact block's own colours — last link in the resolve chain. */
const CONTACT_HARDCODED_THEME: SectionTheme = {
  background: '#f6f7f9',
  heading: '#0f1115',
  body: '#5b6270',
};

function makeId(): string {
  return `con-${Math.random().toString(36).slice(2, 9)}`;
}

/** Pull the phone value out of a contact items list — used by V3 minimal-CTA
 *  to render an optional `tel:` fallback link beneath the primary CTA. Looks
 *  for an item whose icon === 'phone' first, then whose label looks phoney,
 *  and returns the trimmed `value` (or empty string when no phone item is
 *  present). The renderer hides the line entirely when this is empty. */
function pickPhoneFromItems(items: readonly ContactInfoItem[]): string {
  if (!Array.isArray(items)) return '';
  const byIcon = items.find((it) => it.icon === 'phone' && it.value?.trim());
  if (byIcon) return byIcon.value.trim();
  const byLabel = items.find(
    (it) => /phone|call|mobile|tel/i.test(it.label) && it.value?.trim(),
  );
  return byLabel?.value.trim() ?? '';
}

// Editor placeholder seed - populated only by `defaultData()`. Generic
// placeholder labels (no fake phone numbers / addresses / emails — those
// previously leaked as `(555) 123-4567` / `hello@example.com` to any
// customer page where the AI emitted a contact section without items).
// The generation pipeline goes through `withDefaults` with an empty
// fallback; the deterministic path fills these from `ctx.business`.
const EDITOR_SEED_ITEMS: Omit<ContactInfoItem, 'id'>[] = [
  { icon: 'phone', label: 'Phone', value: '', sub: '' },
  { icon: 'mail', label: 'Email', value: '', sub: '' },
  { icon: 'map-pin', label: 'Address', value: '', sub: '' },
  { icon: 'clock', label: 'Business hours', value: '', sub: '' },
];

const DEFAULTS: ContactData = {
  theme: {},
  layout: 'details',
  headerAlign: 'left',
  headlineSize: 'l',
  showHeadlineRule: false,
  eyebrow: 'CONTACT US',
  headline: "We're here to help",
  headlineAccent: '',
  sub: 'Send a message and we will get back to you.',
  items: [],
  // New default: render a single CTA that opens the popup form modal,
  // instead of the inline two-column "details + form" layout. The popup
  // is the platform-standard `Section.popup` + `PopupHost` (the same
  // mechanism every other section uses for a button-opens-modal pattern),
  // so contact reuses the modal renderer rather than shipping its own.
  showInlineForm: false,
  ctaLabel: 'Send us a message',
  ctaHref: POPUP_HREF,
  formTitle: 'Send us a message',
  formButtonLabel: 'Send message',
  showPhoneField: true,
  imageUrl: '',
  mapImageUrl: '',
  imageDisplay: defaultImageDisplay(),
  mapImageDisplay: defaultImageDisplay(),
};

function defaultData(): ContactData {
  return {
    ...DEFAULTS,
    theme: {},
    items: EDITOR_SEED_ITEMS.map((it) => ({ ...it, id: makeId() })),
  };
}

function withDefaults(data: ContactData): ContactData {
  // Back-compat: a stored contact section from before C1 has no
  // `ctaLabel` / `ctaHref` / `showInlineForm` fields. Such rows kept their
  // inline-form behaviour for years — we MUST NOT flip them to a CTA they
  // never asked for. Detect "pre-C1 row" by the absence of `ctaLabel` AND
  // `ctaHref`, and force `showInlineForm: true` (the old shape) in that
  // case. New rows (`defaultData()`) explicitly opt into the CTA-only
  // shape by setting `showInlineForm: false` + `ctaLabel`/`ctaHref`. AI
  // injection paths get whatever DEFAULTS say (which is now CTA-only).
  const dataKeys = data as Partial<ContactData>;
  const isPreC1 =
    dataKeys.ctaLabel === undefined &&
    dataKeys.ctaHref === undefined &&
    dataKeys.showInlineForm === undefined;
  return {
    ...DEFAULTS,
    ...data,
    // Empty-array fallback (NOT editor seed) so an AI omission shows
    // no placeholder contact info, not "(555) 123-4567" / "hello@example.com".
    items: data.items ?? [],
    showInlineForm: isPreC1 ? true : data.showInlineForm ?? DEFAULTS.showInlineForm,
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

const ALIGN_CLASS: Record<ContactAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  "Let's start your project",
  "We'd love to hear from you",
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  "Reach out today and let's bring your vision to life.",
  "We're here to answer your questions and provide the support you need.",
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<ContactLayout>[] = [
  { id: 'details', label: 'Details + form' },
  { id: 'cards', label: 'Info cards + form' },
  { id: 'map', label: 'Map + form' },
  { id: 'stacked', label: 'Cards row + image' },
  { id: 'minimal-cta', label: 'Minimal CTA' },
];

const ALIGN_OPTIONS: readonly VariantOption<ContactAlign>[] = [
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

function ContactFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
  pageLinks,
}: SectionFieldsProps<ContactData>) {
  const d = withDefaults(data);
  const set = <K extends keyof ContactData>(key: K, value: ContactData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    CONTACT_HARDCODED_THEME,
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
    (index: number, next: ContactInfoItem) => {
      const items = d.items.slice();
      items[index] = next;
      onChange({ ...d, items });
    },
    [d, onChange],
  );
  const addItem = useCallback(() => {
    onChange({
      ...d,
      items: [...d.items, { id: makeId(), icon: 'phone', label: '', value: '', sub: '' }],
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
    return (
      <BuilderFormSection>
        {d.items.map((item, i) => (
          <div
            key={item.id}
            className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Detail {i + 1}
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
            <CopyField
              label="Label"
              value={item.label}
              onChange={(v) => setItem(i, { ...item, label: v })}
            />
            <CopyField
              label="Value"
              value={item.value}
              onChange={(v) => setItem(i, { ...item, value: v })}
            />
            <CopyField
              label="Caption"
              value={item.sub}
              onChange={(v) => setItem(i, { ...item, sub: v })}
            />
          </div>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button variant="secondary" size="sm" onClick={addItem} className="w-full">
              + Add detail
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'cta') {
    return (
      <BuilderFormSection>
        <CopyField
          label="CTA label"
          value={d.ctaLabel}
          originalValue={DEFAULTS.ctaLabel}
          onChange={(v) => set('ctaLabel', v)}
        />
        <LinkField
          label="CTA destination"
          value={d.ctaHref}
          pageLinks={pageLinks ?? []}
          onChange={(v) => set('ctaHref', v)}
          helper={
            <>
              Pick &quot;Open a popup&quot; to capture leads inside this page
              without sending the visitor anywhere. The popup form lives below.
              Other options route to a page, a phone (<code>tel:</code>), or an
              email (<code>mailto:</code>).
            </>
          }
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'form') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Show inline form (instead of a CTA button)"
          value={d.showInlineForm}
          onChange={(v) => set('showInlineForm', v)}
        />
        <CopyField
          label="Form title"
          value={d.formTitle}
          originalValue={DEFAULTS.formTitle}
          onChange={(v) => set('formTitle', v)}
        />
        <CopyField
          label="Send button label"
          value={d.formButtonLabel}
          originalValue={DEFAULTS.formButtonLabel}
          onChange={(v) => set('formButtonLabel', v)}
        />
        <ToggleField
          label="Phone field"
          value={d.showPhoneField}
          onChange={(v) => set('showPhoneField', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'media') {
    if (d.layout === 'map') {
      return (
        <BuilderFormSection>
          <MediaField
            label="Map image"
            value={d.mapImageUrl}
            onChange={(v) => set('mapImageUrl', v)}
            helper={<>A static map image. A live embed lands with the maps integration.</>}
            display={coerceImageDisplay(d.mapImageDisplay)}
            onDisplayChange={(v) => set('mapImageDisplay', v)}
          />
        </BuilderFormSection>
      );
    }
    if (d.layout === 'stacked') {
      return (
        <BuilderFormSection>
          <MediaField
            label="Image"
            value={d.imageUrl}
            onChange={(v) => set('imageUrl', v)}
            display={coerceImageDisplay(d.imageDisplay)}
            onDisplayChange={(v) => set('imageDisplay', v)}
          />
        </BuilderFormSection>
      );
    }
    return (
      <BuilderFormSection>
        <p className="text-[13px] text-ink-quiet">
          This layout has no image. Pick the “Map + form” or “Cards row + image”
          layout to use one.
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
          label="Layout"
          value={d.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => set('layout', v)}
        />
        {/* Minimal-CTA is a single-CTA shape — the inline-form toggle is
            irrelevant there. Other layouts: keep the toggle. */}
        {d.layout !== 'minimal-cta' ? (
          <ToggleField
            label="Show inline form (instead of a CTA button)"
            value={d.showInlineForm}
            onChange={(v) => set('showInlineForm', v)}
          />
        ) : null}
        <VariantField
          label="Header alignment"
          value={d.headerAlign}
          options={ALIGN_OPTIONS}
          onChange={(v) => set('headerAlign', v)}
        />
        {d.layout === 'minimal-cta' ? (
          <p className="text-[12px] text-ink-quiet">
            Minimal CTA — one big headline + one primary button. The button
            opens the popup form modal by default; pick a different
            destination on the CTA element. A phone number in the details
            list renders inline as a fallback channel.
          </p>
        ) : null}
      </BuilderFormSection>
      {d.layout === 'map' || d.layout === 'stacked' ? (
        <BuilderFormSection>
          <MediaField
            label={d.layout === 'map' ? 'Map image' : 'Image'}
            value={d.layout === 'map' ? d.mapImageUrl : d.imageUrl}
            onChange={(v) => set(d.layout === 'map' ? 'mapImageUrl' : 'imageUrl', v)}
            display={coerceImageDisplay(
              d.layout === 'map' ? d.mapImageDisplay : d.imageDisplay,
            )}
            onDisplayChange={(v) =>
              set(d.layout === 'map' ? 'mapImageDisplay' : 'imageDisplay', v)
            }
          />
        </BuilderFormSection>
      ) : null}
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function ContactPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<ContactData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    CONTACT_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: ContactElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        const header = (align: ContactAlign) => (
          <div className={`flex flex-col ${ALIGN_CLASS[align]}`}>
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
                  className="max-w-[480px] whitespace-pre-line text-[15px] leading-[1.6]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
          </div>
        );

        const form = (
          <SelectableElement {...sel('form')}>
            <ContactForm data={d} theme={theme} accent={accent} headingFont={headingFont} />
          </SelectableElement>
        );

        // Either an inline form (legacy + opt-in) OR a CTA button that
        // hands the lead off to the popup modal / a page / a phone /
        // an email. SurfaceLink dispatches on the href: POPUP_HREF →
        // opens the section's popup (the platform-standard popup modal,
        // shared with every other section that uses this pattern).
        const cta = (
          <SelectableElement {...sel('cta')}>
            <ContactCta data={d} theme={theme} accent={accent} headingFont={headingFont} />
          </SelectableElement>
        );

        const formOrCta = d.showInlineForm ? form : cta;

        const detailItems = (
          <SelectableElement {...sel('items')}>
            <DetailsBlock data={d} theme={theme} accent={accent} headingFont={headingFont} />
          </SelectableElement>
        );

        // V3 — minimal CTA. Single centred column: headline + sub +
        // primary CTA (rendered through ContactCta so the popup wiring
        // is unchanged) + optional phone link as a fallback channel.
        // No details grid, no image. Pass D skips image injection for
        // this variant (see `shouldSkipStockImageInjection`).
        //
        // The CTA card itself is suppressed; we render an inline button
        // so the section reads as one focused call-to-action, not a card
        // inside a section. Phone fallback: surface a `tel:` link when the
        // contact items list carries one (icon === 'phone' OR label ~ 'phone').
        if (d.layout === 'minimal-cta') {
          const phone = pickPhoneFromItems(d.items);
          const ctaLabel = (d.ctaLabel?.trim() || 'Send us a message').trim();
          const ctaHref = d.ctaHref || POPUP_HREF;
          return (
            <div className="flex flex-col items-center text-center">
              <div className="w-full max-w-[680px]">
                {header('center')}
                <SelectableElement {...sel('cta')} className="mt-9" display="inline-block">
                  <BundleButton
                    href={ctaHref}
                    variant="primary"
                    size="lg"
                    accent={accent}
                    trailing={<span aria-hidden>➤</span>}
                  >
                    {ctaLabel}
                  </BundleButton>
                </SelectableElement>
                {phone ? (
                  <p
                    className="mt-5 text-[14px] @sm:text-[15px]"
                    style={{ color: theme.body }}
                  >
                    Or call{' '}
                    <SurfaceLink
                      href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                      className="font-bold underline-offset-2 hover:underline"
                      style={{ color: theme.heading }}
                    >
                      {phone}
                    </SurfaceLink>
                  </p>
                ) : null}
              </div>
            </div>
          );
        }

        // -- map + form: media beside header+form, details bar below --
        if (d.layout === 'map') {
          return (
            <div className="flex flex-col gap-9">
              <div className="grid items-center gap-9 @3xl:grid-cols-2">
                <SelectableElement {...sel('media')}>
                  <MapBox
                    url={d.mapImageUrl}
                    theme={theme}
                    accent={accent}
                    display={d.mapImageDisplay}
                  />
                </SelectableElement>
                <div className="flex flex-col gap-6">
                  {header(d.headerAlign)}
                  {formOrCta}
                </div>
              </div>
              {detailItems}
            </div>
          );
        }

        // -- cards row + image: centred header, cards, then image | form --
        if (d.layout === 'stacked') {
          return (
            <div className="flex flex-col">
              <div className="mb-9">{header('center')}</div>
              <div className="mb-9">{detailItems}</div>
              <div className="grid items-stretch gap-6 @3xl:grid-cols-2">
                <SelectableElement {...sel('media')} className="hidden @3xl:block">
                  <ImageBox url={d.imageUrl} theme={theme} display={d.imageDisplay} />
                </SelectableElement>
                {formOrCta}
              </div>
            </div>
          );
        }

        // -- details / cards: header on top, then details | form-or-cta --
        return (
          <div className="flex flex-col">
            <div className="mb-9">{header(d.headerAlign)}</div>
            <div className="grid items-start gap-9 @3xl:grid-cols-2">
              {detailItems}
              {formOrCta}
            </div>
          </div>
        );
      }}
    </SectionShell>
  );
}

// -- contact details --------------------------------------------------------

function DetailsBlock({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: ContactData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  // `details` → vertical list; `cards`/`stacked` → card grid; `map` → row.
  if (data.layout === 'details') {
    return (
      <div className="flex flex-col gap-5">
        {data.items.map((item) => (
          <DetailRow key={item.id} item={item} theme={theme} accent={accent} headingFont={headingFont} />
        ))}
      </div>
    );
  }

  const rowLayout = data.layout === 'map';
  return (
    <div
      className={
        rowLayout
          ? 'grid grid-cols-2 gap-3 @lg:grid-cols-4'
          : 'grid grid-cols-1 gap-3 @sm:grid-cols-2'
      }
    >
      {data.items.map((item) => (
        <DetailCard
          key={item.id}
          item={item}
          theme={theme}
          accent={accent}
          headingFont={headingFont}
          center={rowLayout || data.layout === 'stacked'}
        />
      ))}
    </div>
  );
}

function DetailRow({
  item,
  theme,
  accent,
  headingFont,
}: {
  item: ContactInfoItem;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  return (
    <div className="flex items-start gap-3.5">
      {Icon ? (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
        >
          <Icon size={20} strokeWidth={1.9} color={accent} aria-hidden />
        </span>
      ) : null}
      <div>
        <p
          className="text-[14px] font-bold leading-tight"
          style={{ fontFamily: headingFont, color: theme.heading }}
        >
          {item.label || 'Detail'}
        </p>
        {item.value ? (
          <p className="mt-0.5 text-[13.5px]" style={{ color: theme.body }}>
            {item.value}
          </p>
        ) : null}
        {item.sub ? (
          <p className="text-[12px]" style={{ color: theme.muted }}>
            {item.sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DetailCard({
  item,
  theme,
  accent,
  headingFont,
  center,
}: {
  item: ContactInfoItem;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
  center: boolean;
}) {
  const def = getSectionIcon(item.icon);
  const Icon = def?.Icon;
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl p-5 ${center ? 'items-center text-center' : 'items-start'}`}
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {Icon ? (
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: mixHex(accent, theme.background, 0.86) }}
        >
          <Icon size={20} strokeWidth={1.9} color={accent} aria-hidden />
        </span>
      ) : null}
      <p
        className="text-[14px] font-bold leading-tight"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {item.label || 'Detail'}
      </p>
      {item.value ? (
        <p className="text-[13px] leading-snug" style={{ color: theme.body }}>
          {item.value}
        </p>
      ) : null}
      {item.sub ? (
        <p className="text-[12px]" style={{ color: theme.muted }}>
          {item.sub}
        </p>
      ) : null}
    </div>
  );
}

// -- message form (visual placeholder) --------------------------------------

function ContactForm({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: ContactData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 @2xl:p-7"
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      <p
        className="text-[17px] font-bold"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {data.formTitle || 'Send us a message'}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <FormFieldBox label="Your name" theme={theme} />
          <FormFieldBox label="Email address" theme={theme} />
        </div>
        {data.showPhoneField ? (
          <FormFieldBox label="Phone number" theme={theme} />
        ) : null}
        <FormFieldBox label="How can we help?" theme={theme} tall />
        <span
          className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold"
          style={{ backgroundColor: accent, color: '#ffffff' }}
        >
          {data.formButtonLabel || 'Send message'}
          <span aria-hidden>➤</span>
        </span>
      </div>
    </div>
  );
}

// -- contact CTA (the new default; replaces the inline form) ---------------

function ContactCta({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: ContactData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  // The CTA card mirrors the form card's chrome (card surface, padding,
  // rounded corners) so swapping between "inline form" and "CTA only"
  // doesn't change the section's visual rhythm in either layout. The
  // SurfaceLink dispatches by href: POPUP_HREF → opens the section popup
  // (reusable platform modal); tel:/mailto:/path → routes normally.
  const label = data.ctaLabel?.trim() || 'Send us a message';
  return (
    <div
      className="flex flex-col items-start gap-4 rounded-2xl p-6 @2xl:p-7"
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      <p
        className="text-[17px] font-bold"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {data.formTitle || 'Get in touch'}
      </p>
      <p className="text-[14px] leading-[1.55]" style={{ color: theme.body }}>
        {data.sub ||
          'Tap the button — we will get straight back to you.'}
      </p>
      <BundleButton
        href={data.ctaHref}
        variant="primary"
        size="sm"
        accent={accent}
        trailing={<span aria-hidden>➤</span>}
      >
        {label}
      </BundleButton>
    </div>
  );
}

function FormFieldBox({
  label,
  theme,
  tall = false,
}: {
  label: string;
  theme: ResolvedTheme;
  tall?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-3.5 text-[13px] ${tall ? 'py-3 pb-12' : 'py-2.5'}`}
      style={{
        backgroundColor: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.muted,
      }}
    >
      {label}
    </div>
  );
}

// -- media boxes ------------------------------------------------------------

function ImageBox({
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
  const sizing = box.aspectClass ?? 'h-full min-h-[280px]';
  return (
    <div
      className={`relative ${sizing} w-full overflow-hidden rounded-2xl`}
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
            Image
          </span>
        </div>
      )}
    </div>
  );
}

function MapBox({
  url,
  theme,
  accent,
  display,
}: {
  url: string;
  theme: ResolvedTheme;
  accent: string;
  display: ImageDisplay;
}) {
  const box = imageBoxClasses(display);
  if (url && box.isOriginal) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ backgroundColor: mixHex(theme.card, theme.heading, 0.05) }}
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
      style={{ backgroundColor: mixHex(theme.card, theme.heading, 0.05) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`absolute inset-0 h-full w-full ${box.fitClass}`} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: accent }}
          >
            <span className="text-[20px] text-white">●</span>
          </span>
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.muted }}
          >
            Map
          </span>
        </div>
      )}
    </div>
  );
}

export const contactSection = defineSection<ContactData>({
  ...contactMeta,
  defaultData,
  Fields: ContactFields,
  Preview: ContactPreview,
});
