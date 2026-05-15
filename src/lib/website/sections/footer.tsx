'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Footer — website-level singleton. Brand line + contact info + socials +
// legal copy. Wraps every page on the website.
// =============================================================================

export type FooterData = {
  brandLine: string;
  contactPhone: string;
  contactEmail: string;
  addressLine: string;
  socialTwitter: string;
  socialInstagram: string;
  socialFacebook: string;
  legalText: string;
};

const DEFAULTS: FooterData = {
  brandLine: 'Voltline · Licensed electricians in Perth metro',
  contactPhone: '0411 222 333',
  contactEmail: 'hello@voltline.com.au',
  addressLine: 'Servicing Perth metro, WA',
  socialTwitter: '',
  socialInstagram: '@voltline',
  socialFacebook: 'voltline.perth',
  legalText: '© 2026 Voltline Pty Ltd · Lic #EC-12345 · ABN 12 345 678 901',
};

function defaultData(): FooterData {
  return { ...DEFAULTS };
}

const BRAND_ALTS = [
  DEFAULTS.brandLine,
  'Voltline · Perth\'s after-hours sparkies',
  'Voltline · Same-day electrical · Perth metro',
] as const;

function FooterFields({ data, onChange }: SectionFieldsProps<FooterData>) {
  const set = <K extends keyof FooterData>(key: K, value: FooterData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Brand line"
          value={data.brandLine}
          originalValue={DEFAULTS.brandLine}
          alternatives={BRAND_ALTS}
          onChange={(v) => set('brandLine', v)}
        />
        <BuilderFormRow>
          <CopyField
            label="Phone"
            value={data.contactPhone}
            originalValue={DEFAULTS.contactPhone}
            onChange={(v) => set('contactPhone', v)}
          />
          <CopyField
            label="Email"
            value={data.contactEmail}
            originalValue={DEFAULTS.contactEmail}
            onChange={(v) => set('contactEmail', v)}
          />
        </BuilderFormRow>
        <CopyField
          label="Address / service area"
          value={data.addressLine}
          originalValue={DEFAULTS.addressLine}
          onChange={(v) => set('addressLine', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Twitter / X handle"
            value={data.socialTwitter}
            onChange={(v) => set('socialTwitter', v)}
            placeholder="@handle"
          />
          <CopyField
            label="Instagram"
            value={data.socialInstagram}
            onChange={(v) => set('socialInstagram', v)}
            placeholder="@handle"
          />
        </BuilderFormRow>
        <CopyField
          label="Facebook"
          value={data.socialFacebook}
          onChange={(v) => set('socialFacebook', v)}
          placeholder="page-slug"
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Legal / copyright line"
          value={data.legalText}
          originalValue={DEFAULTS.legalText}
          onChange={(v) => set('legalText', v)}
          multiline
          rows={2}
        />
      </BuilderFormSection>
    </>
  );
}

function FooterPreview({ data, brand }: SectionPreviewProps<FooterData>) {
  const socials = [
    data.socialTwitter ? `Twitter: ${data.socialTwitter}` : null,
    data.socialInstagram ? `Instagram: ${data.socialInstagram}` : null,
    data.socialFacebook ? `Facebook: ${data.socialFacebook}` : null,
  ].filter((s): s is string => s !== null);

  return (
    <footer
      data-section-type="footer"
      className="rounded-xl bg-ink px-7 py-8 text-paper md:px-9"
    >
      <div className="mb-5 grid gap-5 md:grid-cols-3">
        <div>
          <p
            className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: brand.accentColor }}
          >
            // BRAND
          </p>
          <p className="text-[14px] font-bold text-paper">{data.brandLine}</p>
        </div>
        <div>
          <p
            className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: brand.accentColor }}
          >
            // CONTACT
          </p>
          {data.contactPhone ? (
            <p className="text-[13px] text-paper">{data.contactPhone}</p>
          ) : null}
          {data.contactEmail ? (
            <p className="text-[13px] text-paper/70">{data.contactEmail}</p>
          ) : null}
          {data.addressLine ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55">
              {data.addressLine}
            </p>
          ) : null}
        </div>
        <div>
          <p
            className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: brand.accentColor }}
          >
            // SOCIAL
          </p>
          {socials.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55">
              No socials configured
            </p>
          ) : (
            <ul className="space-y-0.5 text-[12.5px] text-paper/80">
              {socials.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {data.legalText ? (
        <p className="border-t border-paper/10 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55">
          {data.legalText}
        </p>
      ) : null}
    </footer>
  );
}

export const footerSection = defineSection<FooterData>({
  type: 'footer',
  label: '// FOOTER',
  description: 'Site footer — brand line + contact + socials + legal. Wraps every page.',
  defaultData,
  Fields: FooterFields,
  Preview: FooterPreview,
  capabilityHints: {
    copyFields: [
      'brandLine',
      'contactPhone',
      'contactEmail',
      'addressLine',
      'socialTwitter',
      'socialInstagram',
      'socialFacebook',
      'legalText',
    ],
  },
  allowedContainers: ['websiteFooter'],
  implemented: true,
});
