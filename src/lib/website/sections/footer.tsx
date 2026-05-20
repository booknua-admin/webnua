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
import { footerMeta } from './registry-meta';
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
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import {
  SocialGlyph,
  SOCIAL_LABEL,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from './_shared/SocialGlyph';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Footer — website-level singleton. A brand block + link columns + contact
// details + an optional newsletter / CTA block, over a copyright bottom bar.
// Element-inspector model + brand-default colour inheritance, the hero
// pattern.
// =============================================================================

export type FooterRight = 'none' | 'newsletter' | 'cta';

type FooterElement = 'brand' | 'columns' | 'contact' | 'right' | 'legal';

export type FooterLink = {
  id: string;
  label: string;
  href: string;
};

export type FooterLinkColumn = {
  id: string;
  heading: string;
  links: FooterLink[];
};

export type FooterSocial = {
  id: string;
  network: SocialNetwork;
  href: string;
};

export type FooterData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  logoText: string;
  logoImageUrl: string;
  /** Tagline beneath the logo. */
  brandLine: string;
  socials: FooterSocial[];
  columns: FooterLinkColumn[];
  showContact: boolean;
  contactHeading: string;
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  rightBlock: FooterRight;
  newsletterTitle: string;
  newsletterText: string;
  ctaIcon: string;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaHref: string;
  legalText: string;
  legalLinks: FooterLink[];
};

/** The footer's own colours — last link in the resolve chain. */
const FOOTER_HARDCODED_THEME: SectionTheme = {
  background: '#14171f',
  heading: '#ffffff',
  body: '#9aa3b2',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function mkLinks(labels: string[]): FooterLink[] {
  return labels.map((label) => ({ id: makeId('lnk'), label, href: '#' }));
}

function seedColumns(): FooterLinkColumn[] {
  return [
    { id: makeId('col'), heading: 'Services', links: mkLinks(['Overview', 'Pricing', 'Book a job', 'Service areas']) },
    { id: makeId('col'), heading: 'Company', links: mkLinks(['About us', 'Our work', 'Reviews', 'Careers']) },
    { id: makeId('col'), heading: 'Resources', links: mkLinks(['FAQs', 'Guides', 'Contact', 'Blog']) },
  ];
}

function seedSocials(): FooterSocial[] {
  return [
    { id: makeId('soc'), network: 'facebook', href: '#' },
    { id: makeId('soc'), network: 'instagram', href: '#' },
    { id: makeId('soc'), network: 'linkedin', href: '#' },
  ];
}

function seedLegalLinks(): FooterLink[] {
  return [
    { id: makeId('leg'), label: 'Privacy Policy', href: '#' },
    { id: makeId('leg'), label: 'Terms of Service', href: '#' },
    { id: makeId('leg'), label: 'Sitemap', href: '#' },
  ];
}

const DEFAULTS: FooterData = {
  theme: {},
  logoText: 'Your Business',
  logoImageUrl: '',
  brandLine: 'Quality service you can count on.',
  socials: seedSocials(),
  columns: seedColumns(),
  showContact: true,
  contactHeading: 'Contact us',
  contactAddress: '123 Main Street, Anytown',
  contactPhone: '(555) 123-4567',
  contactEmail: 'hello@example.com',
  rightBlock: 'newsletter',
  newsletterTitle: 'Stay in the loop',
  newsletterText: 'Subscribe for tips, ideas, and exclusive offers.',
  ctaIcon: 'message',
  ctaTitle: "Let's build something great",
  ctaText: 'Have a project in mind? Let’s talk about how we can help.',
  ctaLabel: 'Get a free quote',
  ctaHref: '/contact',
  legalText: '© 2026 Your Business. All rights reserved.',
  legalLinks: seedLegalLinks(),
};

function defaultData(): FooterData {
  return {
    ...DEFAULTS,
    theme: {},
    socials: seedSocials(),
    columns: seedColumns(),
    legalLinks: seedLegalLinks(),
  };
}

function withDefaults(data: FooterData): FooterData {
  return {
    ...DEFAULTS,
    ...data,
    socials: data.socials ?? DEFAULTS.socials,
    columns: data.columns ?? DEFAULTS.columns,
    legalLinks: data.legalLinks ?? DEFAULTS.legalLinks,
  };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

const RIGHT_OPTIONS: readonly VariantOption<FooterRight>[] = [
  { id: 'none', label: 'None' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'cta', label: 'CTA card' },
];

const NETWORK_OPTIONS: readonly VariantOption<SocialNetwork>[] = SOCIAL_NETWORKS.map(
  (n) => ({ id: n, label: SOCIAL_LABEL[n] }),
);

// -- Fields -----------------------------------------------------------------

function FooterFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<FooterData>) {
  const d = withDefaults(data);
  const set = <K extends keyof FooterData>(key: K, value: FooterData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FOOTER_HARDCODED_THEME,
  );

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) =>
    set('theme', omitThemeKey(d.theme, key));
  const applyHeading = (color: string) => {
    if (clientId) setBrandStyleValue(clientId, 'headingColor', color);
    set('theme', omitThemeKey(d.theme, 'heading'));
  };

  // -- social helpers --
  const setSocial = useCallback(
    (index: number, next: FooterSocial) => {
      const socials = d.socials.slice();
      socials[index] = next;
      onChange({ ...d, socials });
    },
    [d, onChange],
  );
  const addSocial = useCallback(() => {
    onChange({
      ...d,
      socials: [...d.socials, { id: makeId('soc'), network: 'facebook', href: '#' }],
    });
  }, [d, onChange]);
  const removeSocial = useCallback(
    (id: string) => onChange({ ...d, socials: d.socials.filter((s) => s.id !== id) }),
    [d, onChange],
  );

  // -- column helpers --
  const setColumn = useCallback(
    (index: number, next: FooterLinkColumn) => {
      const columns = d.columns.slice();
      columns[index] = next;
      onChange({ ...d, columns });
    },
    [d, onChange],
  );
  const addColumn = useCallback(() => {
    onChange({
      ...d,
      columns: [...d.columns, { id: makeId('col'), heading: '', links: [] }],
    });
  }, [d, onChange]);
  const removeColumn = useCallback(
    (id: string) => onChange({ ...d, columns: d.columns.filter((c) => c.id !== id) }),
    [d, onChange],
  );

  // -- legal-link helpers --
  const setLegal = useCallback(
    (index: number, next: FooterLink) => {
      const legalLinks = d.legalLinks.slice();
      legalLinks[index] = next;
      onChange({ ...d, legalLinks });
    },
    [d, onChange],
  );
  const addLegal = useCallback(() => {
    onChange({
      ...d,
      legalLinks: [...d.legalLinks, { id: makeId('leg'), label: '', href: '#' }],
    });
  }, [d, onChange]);
  const removeLegal = useCallback(
    (id: string) => onChange({ ...d, legalLinks: d.legalLinks.filter((l) => l.id !== id) }),
    [d, onChange],
  );

  if (selectedElement === 'brand') {
    return (
      <>
        <BuilderFormSection>
          <CopyField
            label="Logo text"
            value={d.logoText}
            originalValue={DEFAULTS.logoText}
            onChange={(v) => set('logoText', v)}
          />
          <MediaField
            label="Logo image"
            value={d.logoImageUrl}
            onChange={(v) => set('logoImageUrl', v)}
          />
          <CopyField
            label="Tagline"
            value={d.brandLine}
            originalValue={DEFAULTS.brandLine}
            onChange={(v) => set('brandLine', v)}
            multiline
            rows={2}
          />
        </BuilderFormSection>
        <BuilderFormSection>
          {d.socials.map((social, i) => (
            <div
              key={social.id}
              className="mb-2.5 rounded-lg border border-rule bg-paper p-3 last:mb-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Social {i + 1}
                </p>
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() => removeSocial(social.id)}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                  >
                    Remove ×
                  </button>
                </CapabilityGate>
              </div>
              <VariantField
                label="Network"
                value={social.network}
                options={NETWORK_OPTIONS}
                onChange={(v) => setSocial(i, { ...social, network: v })}
                capability="editCopy"
              />
              <CopyField
                label="Link"
                value={social.href}
                onChange={(v) => setSocial(i, { ...social, href: v })}
              />
            </div>
          ))}
          <CapabilityGate capability="editLayout" mode="disable">
            <BuilderField label="">
              <Button variant="secondary" size="sm" onClick={addSocial} className="w-full">
                + Add social
              </Button>
            </BuilderField>
          </CapabilityGate>
        </BuilderFormSection>
      </>
    );
  }

  if (selectedElement === 'columns') {
    return (
      <BuilderFormSection>
        {d.columns.map((column, ci) => (
          <div
            key={column.id}
            className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Column {ci + 1}
              </p>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeColumn(column.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  Remove ×
                </button>
              </CapabilityGate>
            </div>
            <CopyField
              label="Heading"
              value={column.heading}
              onChange={(v) => setColumn(ci, { ...column, heading: v })}
            />
            {column.links.map((link, li) => (
              <BuilderFormRow key={link.id}>
                <CopyField
                  label={`Link ${li + 1}`}
                  value={link.label}
                  onChange={(v) => {
                    const links = column.links.slice();
                    links[li] = { ...link, label: v };
                    setColumn(ci, { ...column, links });
                  }}
                />
                <CopyField
                  label="URL"
                  value={link.href}
                  onChange={(v) => {
                    const links = column.links.slice();
                    links[li] = { ...link, href: v };
                    setColumn(ci, { ...column, links });
                  }}
                />
              </BuilderFormRow>
            ))}
            <div className="mt-1.5 flex gap-2">
              <CapabilityGate capability="editLayout" mode="disable">
                <button
                  type="button"
                  onClick={() =>
                    setColumn(ci, {
                      ...column,
                      links: [...column.links, { id: makeId('lnk'), label: '', href: '#' }],
                    })
                  }
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  + Add link
                </button>
              </CapabilityGate>
              {column.links.length > 0 ? (
                <CapabilityGate capability="editLayout" mode="hide">
                  <button
                    type="button"
                    onClick={() =>
                      setColumn(ci, { ...column, links: column.links.slice(0, -1) })
                    }
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-warn"
                  >
                    − Remove link
                  </button>
                </CapabilityGate>
              ) : null}
            </div>
          </div>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button variant="secondary" size="sm" onClick={addColumn} className="w-full">
              + Add column
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'contact') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Show contact block"
          value={d.showContact}
          onChange={(v) => set('showContact', v)}
        />
        <CopyField
          label="Heading"
          value={d.contactHeading}
          originalValue={DEFAULTS.contactHeading}
          onChange={(v) => set('contactHeading', v)}
        />
        <CopyField
          label="Address"
          value={d.contactAddress}
          onChange={(v) => set('contactAddress', v)}
          multiline
          rows={2}
        />
        <BuilderFormRow>
          <CopyField
            label="Phone"
            value={d.contactPhone}
            onChange={(v) => set('contactPhone', v)}
          />
          <CopyField
            label="Email"
            value={d.contactEmail}
            onChange={(v) => set('contactEmail', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'right') {
    return (
      <BuilderFormSection>
        <VariantField
          label="Block type"
          value={d.rightBlock}
          options={RIGHT_OPTIONS}
          onChange={(v) => set('rightBlock', v)}
        />
        {d.rightBlock === 'newsletter' ? (
          <>
            <CopyField
              label="Title"
              value={d.newsletterTitle}
              originalValue={DEFAULTS.newsletterTitle}
              onChange={(v) => set('newsletterTitle', v)}
            />
            <CopyField
              label="Text"
              value={d.newsletterText}
              originalValue={DEFAULTS.newsletterText}
              onChange={(v) => set('newsletterText', v)}
              multiline
              rows={2}
            />
          </>
        ) : null}
        {d.rightBlock === 'cta' ? (
          <>
            <IconField value={d.ctaIcon} onChange={(v) => set('ctaIcon', v)} />
            <CopyField
              label="Title"
              value={d.ctaTitle}
              originalValue={DEFAULTS.ctaTitle}
              onChange={(v) => set('ctaTitle', v)}
            />
            <CopyField
              label="Text"
              value={d.ctaText}
              originalValue={DEFAULTS.ctaText}
              onChange={(v) => set('ctaText', v)}
              multiline
              rows={2}
            />
            <BuilderFormRow>
              <CopyField
                label="Button label"
                value={d.ctaLabel}
                originalValue={DEFAULTS.ctaLabel}
                onChange={(v) => set('ctaLabel', v)}
              />
              <CopyField
                label="Button link"
                value={d.ctaHref}
                originalValue={DEFAULTS.ctaHref}
                onChange={(v) => set('ctaHref', v)}
              />
            </BuilderFormRow>
          </>
        ) : null}
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'legal') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Copyright line"
          value={d.legalText}
          originalValue={DEFAULTS.legalText}
          onChange={(v) => set('legalText', v)}
        />
        {d.legalLinks.map((link, i) => (
          <BuilderFormRow key={link.id}>
            <CopyField
              label={`Link ${i + 1}`}
              value={link.label}
              onChange={(v) => setLegal(i, { ...link, label: v })}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <CopyField
                  label="URL"
                  value={link.href}
                  onChange={(v) => setLegal(i, { ...link, href: v })}
                />
              </div>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeLegal(link.id)}
                  className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  ×
                </button>
              </CapabilityGate>
            </div>
          </BuilderFormRow>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button variant="secondary" size="sm" onClick={addLegal} className="w-full">
              + Add legal link
            </Button>
          </BuilderField>
        </CapabilityGate>
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
        <ColorField
          label="Heading colour"
          value={resolved.heading}
          inherited={d.theme.heading === undefined}
          onChange={(v) => setColor('heading', v)}
          onReset={() => clearColor('heading')}
          applyToAll={{ scopeLabel: 'headings', onApply: applyHeading }}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <VariantField
          label="Side block"
          value={d.rightBlock}
          options={RIGHT_OPTIONS}
          onChange={(v) => set('rightBlock', v)}
        />
        <ToggleField
          label="Contact block"
          value={d.showContact}
          onChange={(v) => set('showContact', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function FooterPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<FooterData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    FOOTER_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="default">
      {({ theme, headingFont, accent }) => {
        const sel = (id: FooterElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        return (
          <div className="flex flex-col">
            {/* -- top region -- */}
            <div className="flex flex-wrap gap-x-10 gap-y-9">
              {/* brand block */}
              <SelectableElement {...sel('brand')} className="w-[240px] shrink-0">
                <div>
                  {d.logoImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.logoImageUrl} alt={d.logoText} className="h-9 w-auto" />
                  ) : (
                    <p
                      className="text-[20px] font-extrabold tracking-[-0.02em]"
                      style={{ fontFamily: headingFont, color: theme.heading }}
                    >
                      {d.logoText || 'Logo'}
                    </p>
                  )}
                  {d.brandLine ? (
                    <p
                      className="mt-3 whitespace-pre-line text-[13.5px] leading-[1.55]"
                      style={{ color: theme.body }}
                    >
                      {d.brandLine}
                    </p>
                  ) : null}
                  {d.socials.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {d.socials.map((social) => (
                        <span
                          key={social.id}
                          className="flex h-9 w-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: mixHex(theme.heading, theme.background, 0.86) }}
                        >
                          <SocialGlyph network={social.network} size={16} color={theme.heading} />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </SelectableElement>

              {/* link columns */}
              {d.columns.length > 0 ? (
                <SelectableElement {...sel('columns')} className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap gap-x-10 gap-y-7">
                    {d.columns.map((column) => (
                      <div key={column.id} className="min-w-[130px]">
                        <p
                          className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: theme.muted }}
                        >
                          {column.heading || 'Column'}
                        </p>
                        <ul className="flex flex-col gap-2.5">
                          {column.links.map((link) => (
                            <li
                              key={link.id}
                              className="text-[13.5px]"
                              style={{ color: theme.body }}
                            >
                              {link.label || 'Link'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </SelectableElement>
              ) : null}

              {/* contact block */}
              {d.showContact ? (
                <SelectableElement {...sel('contact')} className="min-w-[180px]">
                  <div>
                    <p
                      className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: theme.muted }}
                    >
                      {d.contactHeading || 'Contact'}
                    </p>
                    <div className="flex flex-col gap-2 text-[13.5px]" style={{ color: theme.body }}>
                      {d.contactAddress ? (
                        <p className="whitespace-pre-line">{d.contactAddress}</p>
                      ) : null}
                      {d.contactPhone ? <p>{d.contactPhone}</p> : null}
                      {d.contactEmail ? <p>{d.contactEmail}</p> : null}
                    </div>
                  </div>
                </SelectableElement>
              ) : null}

              {/* right block */}
              {d.rightBlock !== 'none' ? (
                <SelectableElement {...sel('right')} className="min-w-[260px]">
                  {d.rightBlock === 'newsletter' ? (
                    <NewsletterBlock data={d} theme={theme} accent={accent} headingFont={headingFont} />
                  ) : (
                    <CtaCard data={d} theme={theme} accent={accent} headingFont={headingFont} />
                  )}
                </SelectableElement>
              ) : null}
            </div>

            {/* -- bottom bar -- */}
            <SelectableElement {...sel('legal')} className="mt-9">
              <div
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-6"
                style={{ borderColor: mixHex(theme.heading, theme.background, 0.82) }}
              >
                <p className="text-[12.5px]" style={{ color: theme.muted }}>
                  {d.legalText}
                </p>
                {d.legalLinks.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {d.legalLinks.map((link, i) => (
                      <span key={link.id} className="flex items-center gap-2.5">
                        {i > 0 ? (
                          <span
                            aria-hidden
                            className="h-3 w-px"
                            style={{ backgroundColor: theme.border }}
                          />
                        ) : null}
                        <span className="text-[12.5px]" style={{ color: theme.body }}>
                          {link.label || 'Link'}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </SelectableElement>
          </div>
        );
      }}
    </SectionShell>
  );
}

function NewsletterBlock({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: FooterData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  return (
    <div className="max-w-[300px]">
      <p
        className="text-[16px] font-bold"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {data.newsletterTitle || 'Stay in the loop'}
      </p>
      {data.newsletterText ? (
        <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: theme.body }}>
          {data.newsletterText}
        </p>
      ) : null}
      <div className="mt-3.5 flex items-stretch gap-2">
        <div
          className="flex-1 rounded-md px-3 py-2.5 text-[13px]"
          style={{
            backgroundColor: mixHex(theme.background, theme.heading, 0.06),
            border: `1px solid ${theme.border}`,
            color: theme.muted,
          }}
        >
          Enter your email
        </div>
        <span
          className="flex w-10 items-center justify-center rounded-md text-[15px] font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          →
        </span>
      </div>
    </div>
  );
}

function CtaCard({
  data,
  theme,
  accent,
  headingFont,
}: {
  data: FooterData;
  theme: ResolvedTheme;
  accent: string;
  headingFont: string;
}) {
  const def = getSectionIcon(data.ctaIcon);
  const Icon = def?.Icon;
  return (
    <div
      className="max-w-[320px] rounded-xl p-5"
      style={{
        backgroundColor: mixHex(theme.background, theme.heading, 0.05),
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {Icon ? (
        <span
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: mixHex(accent, theme.background, 0.84) }}
        >
          <Icon size={18} strokeWidth={2} color={accent} aria-hidden />
        </span>
      ) : null}
      <p
        className="text-[16px] font-bold"
        style={{ fontFamily: headingFont, color: theme.heading }}
      >
        {data.ctaTitle || 'Get in touch'}
      </p>
      {data.ctaText ? (
        <p className="mt-1 text-[13px] leading-[1.5]" style={{ color: theme.body }}>
          {data.ctaText}
        </p>
      ) : null}
      {data.ctaLabel ? (
        <span
          className="mt-3.5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold"
          style={{ backgroundColor: accent, color: '#ffffff' }}
        >
          {data.ctaLabel}
          <span aria-hidden>→</span>
        </span>
      ) : null}
    </div>
  );
}

export const footerSection = defineSection<FooterData>({
  ...footerMeta,
  defaultData,
  Fields: FooterFields,
  Preview: FooterPreview,
});
