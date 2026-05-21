'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { setBrandStyleValue } from '../brand-style-stub';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { headerMeta } from './registry-meta';
import {
  brandThemeDefaults,
  resolveTheme,
  type ResolvedTheme,
  type SectionTheme,
} from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { LinkField } from './_shared/LinkField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';
import { useWebsiteNav } from './_shared/website-nav-slot';

// =============================================================================
// Header — website-level singleton. Logo + navigation + an optional global
// CTA, in one of three layouts. Element-inspector model + brand-default
// colour inheritance, the hero pattern.
//
// **Nav links live on `Website.nav`, NOT in HeaderData** (design doc §2.5).
// The header editor does not edit nav — the preview renders representative
// nav links so the bar looks complete; the live site substitutes the real
// Website.nav at render time.
// =============================================================================

export type HeaderLayout = 'logo-left' | 'logo-center' | 'menu-right';
export type HeaderCtaStyle = 'solid' | 'outline';

type HeaderElement = 'logo' | 'cta';

export type HeaderData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  layout: HeaderLayout;
  logoText: string;
  /** Small line beneath the logo text — e.g. "Electrical". */
  logoTagline: string;
  logoImageUrl: string;
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
  ctaStyle: HeaderCtaStyle;
};

/** The header's own colours — last link in the resolve chain. */
const HEADER_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

/** A nav entry — `href` null means decorative (the editor's representative
 *  links); a real href renders a navigable `<a>` (the live site). */
type HeaderNavItem = { label: string; href: string | null };

/** Representative nav links — shown in the editor; the live site substitutes
 *  the real `Website.nav` via the website-nav slot. */
const SAMPLE_NAV: readonly HeaderNavItem[] = [
  { label: 'Home', href: null },
  { label: 'Services', href: null },
  { label: 'About', href: null },
  { label: 'Contact', href: null },
];

const DEFAULTS: HeaderData = {
  theme: {},
  layout: 'logo-left',
  logoText: 'Your Business',
  logoTagline: '',
  logoImageUrl: '',
  showCta: true,
  ctaLabel: 'Get a quote',
  ctaHref: '/contact',
  ctaStyle: 'solid',
};

function defaultData(): HeaderData {
  return { ...DEFAULTS, theme: {} };
}

function withDefaults(data: HeaderData): HeaderData {
  return { ...DEFAULTS, ...data };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

const LAYOUT_OPTIONS: readonly VariantOption<HeaderLayout>[] = [
  { id: 'logo-left', label: 'Logo left' },
  { id: 'logo-center', label: 'Logo centred' },
  { id: 'menu-right', label: 'Menu right' },
];

const CTA_STYLE_OPTIONS: readonly VariantOption<HeaderCtaStyle>[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'outline', label: 'Outline' },
];

// -- Fields -----------------------------------------------------------------

function HeaderFields({
  data,
  onChange,
  selectedElement,
  pageLinks,
  clientId,
  brand,
}: SectionFieldsProps<HeaderData>) {
  const d = withDefaults(data);
  const set = <K extends keyof HeaderData>(key: K, value: HeaderData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), HEADER_HARDCODED_THEME);

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) => set('theme', omitThemeKey(d.theme, key));
  const applyColorEverywhere = (color: string) => {
    if (clientId) setBrandStyleValue(clientId, 'headingColor', color);
    set('theme', omitThemeKey(d.theme, 'heading'));
  };

  if (selectedElement === 'logo') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Logo text"
          value={d.logoText}
          originalValue={DEFAULTS.logoText}
          onChange={(v) => set('logoText', v)}
          helper={<>Shown when no logo image is set.</>}
        />
        <CopyField
          label="Tagline"
          value={d.logoTagline}
          onChange={(v) => set('logoTagline', v)}
          helper={<>Optional small line beneath the logo text.</>}
        />
        <MediaField
          label="Logo image"
          value={d.logoImageUrl}
          onChange={(v) => set('logoImageUrl', v)}
        />
        <ColorField
          label="Logo / nav colour"
          value={resolved.heading}
          inherited={d.theme.heading === undefined}
          onChange={(v) => setColor('heading', v)}
          onReset={() => clearColor('heading')}
          applyToAll={{ scopeLabel: 'headings', onApply: applyColorEverywhere }}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'cta') {
    return (
      <BuilderFormSection>
        <ToggleField label="Show CTA" value={d.showCta} onChange={(v) => set('showCta', v)} />
        <CopyField
          label="Label"
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
        <VariantField
          label="Style"
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
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          Nav links are set on the website (capped at 6). The preview shows representative links.
        </p>
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function HeaderPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<HeaderData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), HEADER_HARDCODED_THEME);

  // The real Website.nav arrives through the slot: the public site provides
  // it `live` (links navigate); the header editor provides it inert (`live:
  // false` — real labels show, but clicks select the element). With no
  // provider at all the header falls back to representative sample links.
  const navCtx = useWebsiteNav();
  const live = navCtx != null && navCtx.live;
  const navItems: readonly HeaderNavItem[] =
    navCtx && navCtx.links.length > 0
      ? live
        ? navCtx.links
        : navCtx.links.map((l) => ({ label: l.label, href: null }))
      : SAMPLE_NAV;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SectionShell theme={resolved} brand={brand} inset="flush" pad="none">
      {({ theme, headingFont, accent }) => {
        const sel = (id: HeaderElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        const logo = (
          <SelectableElement {...sel('logo')} display="inline-block">
            <Logo data={d} theme={theme} accent={accent} headingFont={headingFont} />
          </SelectableElement>
        );

        const cta =
          d.showCta && d.ctaLabel ? (
            <SelectableElement {...sel('cta')} display="inline-block">
              <CtaButton
                label={d.ctaLabel}
                style={d.ctaStyle}
                accent={accent}
                theme={theme}
                href={live ? d.ctaHref || undefined : undefined}
              />
            </SelectableElement>
          ) : null;

        // `ml-auto` keeps the toggle pinned to the right edge on mobile in
        // every layout (the desktop layouts hide it via `@2xl:hidden`).
        const hamburger = (
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md @2xl:hidden"
            style={{ border: `1px solid ${theme.border}`, color: theme.heading }}
          >
            {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        );

        return (
          <div>
            <div className="flex items-center gap-6 px-8 py-4 @2xl:px-12">
              {d.layout === 'logo-center' ? (
                <>
                  <NavLinks
                    items={navItems.slice(0, 2)}
                    theme={theme}
                    accent={accent}
                    className="hidden flex-1 @2xl:flex"
                  />
                  {logo}
                  <div className="hidden flex-1 items-center justify-end gap-6 @2xl:flex">
                    <NavLinks items={navItems.slice(2)} theme={theme} accent={accent} />
                    {cta}
                  </div>
                  {hamburger}
                </>
              ) : d.layout === 'menu-right' ? (
                <>
                  {logo}
                  <div className="hidden flex-1 items-center justify-end gap-7 @2xl:flex">
                    <NavLinks items={navItems} theme={theme} accent={accent} />
                    {cta}
                  </div>
                  {hamburger}
                </>
              ) : (
                <>
                  {logo}
                  <NavLinks
                    items={navItems}
                    theme={theme}
                    accent={accent}
                    className="hidden flex-1 justify-center @2xl:flex"
                  />
                  <span className="hidden @2xl:inline-block">{cta}</span>
                  {hamburger}
                </>
              )}
            </div>
            {menuOpen ? (
              <MobileMenu
                items={navItems}
                theme={theme}
                accent={accent}
                cta={
                  d.showCta && d.ctaLabel
                    ? { label: d.ctaLabel, href: d.ctaHref, style: d.ctaStyle }
                    : null
                }
                live={live}
              />
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

/** The mobile nav panel — drops below the header bar when the toggle is open.
 *  Hidden at `@2xl` and up, where the inline nav takes over. */
function MobileMenu({
  items,
  theme,
  accent,
  cta,
  live,
}: {
  items: readonly HeaderNavItem[];
  theme: ResolvedTheme;
  accent: string;
  cta: { label: string; href: string; style: HeaderCtaStyle } | null;
  live: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 border-t px-8 py-3 @2xl:hidden"
      style={{ borderColor: theme.border, backgroundColor: theme.background }}
    >
      {items.map((item, i) =>
        item.href ? (
          <a
            key={`${item.label}-${i}`}
            href={item.href}
            className="py-2 text-[15px] font-medium no-underline"
            style={{ color: theme.heading }}
          >
            {item.label}
          </a>
        ) : (
          <span
            key={`${item.label}-${i}`}
            className="py-2 text-[15px] font-medium"
            style={{ color: theme.heading }}
          >
            {item.label}
          </span>
        ),
      )}
      {cta ? (
        live ? (
          <a
            href={cta.href || '#'}
            className="mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[14px] font-semibold no-underline"
            style={
              cta.style === 'outline'
                ? { border: `2px solid ${theme.heading}`, color: theme.heading }
                : { backgroundColor: accent, color: '#ffffff' }
            }
          >
            {cta.label}
          </a>
        ) : (
          <span className="mt-2 inline-block">
            <CtaButton label={cta.label} style={cta.style} accent={accent} theme={theme} />
          </span>
        )
      ) : null}
    </div>
  );
}

function Logo({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: HeaderData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  if (data.logoImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={data.logoImageUrl} alt={data.logoText} className="h-9 w-auto" />
    );
  }
  return (
    <div className="leading-none">
      <span
        className="text-[19px] font-extrabold tracking-[-0.02em]"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {data.logoText || 'Logo'}
      </span>
      {data.logoTagline ? (
        <span
          className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {data.logoTagline}
        </span>
      ) : null}
    </div>
  );
}

function NavLinks({
  items,
  theme,
  accent,
  className,
}: {
  items: readonly HeaderNavItem[];
  theme: ResolvedTheme;
  accent: string;
  className?: string;
}) {
  return (
    <nav className={`flex items-center gap-7 ${className ?? ''}`} aria-label="Site navigation">
      {items.map((item, i) => {
        const color = i === 0 ? accent : theme.body;
        return item.href ? (
          <a
            key={`${item.label}-${i}`}
            href={item.href}
            className="text-[14px] font-medium no-underline"
            style={{ color }}
          >
            {item.label}
          </a>
        ) : (
          <span key={`${item.label}-${i}`} className="text-[14px] font-medium" style={{ color }}>
            {item.label}
          </span>
        );
      })}
    </nav>
  );
}

/** The header CTA. `href` set (live site) → a navigable `<a>`; absent
 *  (editor preview) → an inert `<span>` so the SelectableElement owns the
 *  click for element selection. */
function CtaButton({
  label,
  style,
  accent,
  theme,
  href,
}: {
  label: string;
  style: HeaderCtaStyle;
  accent: string;
  theme: ResolvedTheme;
  href?: string;
}) {
  const className = `inline-flex items-center rounded-lg px-4 py-2 text-[13px] font-semibold${
    style === 'outline' ? ' border-2' : ''
  }`;
  const style2 =
    style === 'outline'
      ? { borderColor: theme.heading, color: theme.heading }
      : { backgroundColor: accent, color: '#ffffff' };
  return href ? (
    <a href={href} className={`${className} no-underline`} style={style2}>
      {label}
    </a>
  ) : (
    <span className={className} style={style2}>
      {label}
    </span>
  );
}

export const headerSection = defineSection<HeaderData>({
  ...headerMeta,
  defaultData,
  Fields: HeaderFields,
  Preview: HeaderPreview,
});
