'use client';

import {
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';

import { setBrandStyleValue } from '../brand-style-stub';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { thanksConfirmationMeta } from './registry-meta';
import { getSectionIcon } from '../section-icons';
import {
  brandThemeDefaults,
  resolveTheme,
  type SectionTheme,
} from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { SurfaceLink } from './_shared/live-surface';
import { IconField } from './_shared/IconField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { ToggleField } from './_shared/ToggleField';

// =============================================================================
// Thanks / confirmation section — funnel-only. A success icon, confirmation
// copy, and an optional referral block. Element-inspector model + brand-
// default colour inheritance, the hero pattern.
// =============================================================================

type ThanksElement = 'icon' | 'headline' | 'body' | 'referral';

export type ThanksConfirmationData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  icon: string;
  title: string;
  body: string;
  detailLine: string;
  showReferral: boolean;
  referralTag: string;
  referralTitle: string;
  referralBody: string;
  referralCtaLabel: string;
  referralCtaHref: string;
};

const THANKS_HARDCODED_THEME: SectionTheme = {
  background: '#f6f7f9',
  heading: '#0f1115',
  body: '#5b6270',
};

const DEFAULTS: ThanksConfirmationData = {
  theme: {},
  icon: 'check',
  title: "You're booked.",
  body: "We'll SMS to confirm within 10 minutes.",
  detailLine: "Look for a text from a local number — that's us.",
  showReferral: true,
  referralTag: 'REFER + EARN',
  referralTitle: 'Know someone who needs us?',
  referralBody:
    'Refer a friend — they get $25 off their first job, you get $25 credit on your next.',
  referralCtaLabel: 'Send a referral',
  referralCtaHref: '/refer',
};

function defaultData(): ThanksConfirmationData {
  return { ...DEFAULTS, theme: {} };
}

function withDefaults(data: ThanksConfirmationData): ThanksConfirmationData {
  return { ...DEFAULTS, ...data };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

const TITLE_ALTS = [
  DEFAULTS.title,
  'Booking confirmed.',
  "Sorted — we'll see you soon.",
] as const;

// -- Fields -----------------------------------------------------------------

function ThanksConfirmationFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<ThanksConfirmationData>) {
  const d = withDefaults(data);
  const set = <K extends keyof ThanksConfirmationData>(
    key: K,
    value: ThanksConfirmationData[K],
  ) => onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    THANKS_HARDCODED_THEME,
  );

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) =>
    set('theme', omitThemeKey(d.theme, key));
  const applyHeading = (color: string) => {
    if (clientId) setBrandStyleValue(clientId, 'headingColor', color);
    set('theme', omitThemeKey(d.theme, 'heading'));
  };

  if (selectedElement === 'icon') {
    return (
      <BuilderFormSection>
        <IconField label="Success icon" value={d.icon} onChange={(v) => set('icon', v)} />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'headline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Title"
          value={d.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => set('title', v)}
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
    );
  }

  if (selectedElement === 'body') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Body"
          value={d.body}
          originalValue={DEFAULTS.body}
          onChange={(v) => set('body', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Detail line"
          value={d.detailLine}
          originalValue={DEFAULTS.detailLine}
          onChange={(v) => set('detailLine', v)}
          helper={<>Smaller line beneath the body.</>}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'referral') {
    return (
      <BuilderFormSection>
        <ToggleField
          label="Show referral block"
          value={d.showReferral}
          onChange={(v) => set('showReferral', v)}
        />
        <CopyField
          label="Tag"
          value={d.referralTag}
          originalValue={DEFAULTS.referralTag}
          onChange={(v) => set('referralTag', v)}
        />
        <CopyField
          label="Title"
          value={d.referralTitle}
          originalValue={DEFAULTS.referralTitle}
          onChange={(v) => set('referralTitle', v)}
        />
        <CopyField
          label="Body"
          value={d.referralBody}
          originalValue={DEFAULTS.referralBody}
          onChange={(v) => set('referralBody', v)}
          multiline
          rows={2}
        />
        <BuilderFormRow>
          <CopyField
            label="Button label"
            value={d.referralCtaLabel}
            originalValue={DEFAULTS.referralCtaLabel}
            onChange={(v) => set('referralCtaLabel', v)}
          />
          <CopyField
            label="Button link"
            value={d.referralCtaHref}
            originalValue={DEFAULTS.referralCtaHref}
            onChange={(v) => set('referralCtaHref', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
    );
  }

  // -- section-level settings --
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
        <ToggleField
          label="Referral block"
          value={d.showReferral}
          onChange={(v) => set('showReferral', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function ThanksConfirmationPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<ThanksConfirmationData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    THANKS_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: ThanksElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        const def = getSectionIcon(d.icon);
        const Icon = def?.Icon;

        return (
          <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center">
            {Icon ? (
              <SelectableElement {...sel('icon')} display="inline-block">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: accent }}
                >
                  <Icon size={30} strokeWidth={2.4} color="#ffffff" aria-hidden />
                </span>
              </SelectableElement>
            ) : null}
            <SelectableElement {...sel('headline')} className="mt-6">
              <h2
                className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] @2xl:text-[40px]"
                style={{ fontFamily: headingFont, color: theme.heading }}
              >
                {d.title}
              </h2>
            </SelectableElement>
            {d.body || d.detailLine ? (
              <SelectableElement {...sel('body')} className="mt-3">
                {d.body ? (
                  <p
                    className="whitespace-pre-line text-[15px] leading-[1.6]"
                    style={{ color: theme.body }}
                  >
                    {d.body}
                  </p>
                ) : null}
                {d.detailLine ? (
                  <p
                    className="mt-2 text-[12px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: theme.muted }}
                  >
                    {d.detailLine}
                  </p>
                ) : null}
              </SelectableElement>
            ) : null}

            {d.showReferral ? (
              <SelectableElement {...sel('referral')} className="mt-8 w-full">
                <div
                  className="rounded-2xl px-6 py-6 text-center"
                  style={{
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.cardBorder}`,
                  }}
                >
                  {d.referralTag ? (
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: accent }}
                    >
                      {d.referralTag}
                    </p>
                  ) : null}
                  {d.referralTitle ? (
                    <p
                      className="mt-1.5 text-[17px] font-bold"
                      style={{ fontFamily: headingFont, color: theme.heading }}
                    >
                      {d.referralTitle}
                    </p>
                  ) : null}
                  {d.referralBody ? (
                    <p
                      className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-[1.55]"
                      style={{ color: theme.body }}
                    >
                      {d.referralBody}
                    </p>
                  ) : null}
                  {d.referralCtaLabel ? (
                    <SurfaceLink
                      href={d.referralCtaHref}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13.5px] font-semibold"
                      style={{ backgroundColor: accent, color: '#ffffff' }}
                    >
                      {d.referralCtaLabel}
                      <span aria-hidden>→</span>
                    </SurfaceLink>
                  ) : null}
                </div>
              </SelectableElement>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

export const thanksConfirmationSection = defineSection<ThanksConfirmationData>({
  ...thanksConfirmationMeta,
  defaultData,
  Fields: ThanksConfirmationFields,
  Preview: ThanksConfirmationPreview,
});
