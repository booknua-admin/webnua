'use client';

// =============================================================================
// Form section — a section whose content IS a lead-capture form.
//
// Deliberately thin: the section's `data` carries only chrome (a colour
// theme + an optional eyebrow / heading band). The form itself lives on the
// Section ENVELOPE (`section.form`) like it does for every other section —
// PagePreviewPane renders <FormBlock> beneath this Preview. So this module
// never renders the form; it renders the band above it.
//
// A `form` section is born with a default `section.form` — SectionEditor's
// add-section handler seeds it (see handleAddSection).
// =============================================================================

import {
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import {
  brandThemeDefaults,
  resolveTheme,
  type SectionTheme,
} from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';

export type FormSectionData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  eyebrow: string;
  heading: string;
};

type FormSectionElement = 'eyebrow' | 'heading';

/** The form section's own colours — last link in the resolve chain. */
const FORM_HARDCODED_THEME: SectionTheme = {
  background: '#f6f4ef',
  heading: '#0f1115',
  body: '#5b6270',
};

const DEFAULTS: FormSectionData = {
  theme: {},
  eyebrow: 'GET IN TOUCH',
  heading: 'Send us a message',
};

function defaultData(): FormSectionData {
  return { theme: {}, eyebrow: DEFAULTS.eyebrow, heading: DEFAULTS.heading };
}

function withDefaults(data: FormSectionData): FormSectionData {
  return { ...DEFAULTS, ...data, theme: data.theme ?? {} };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

// -- Fields -----------------------------------------------------------------

function FormSectionFields({
  data,
  onChange,
  selectedElement,
  brand,
}: SectionFieldsProps<FormSectionData>) {
  const d = withDefaults(data);
  const set = <K extends keyof FormSectionData>(key: K, value: FormSectionData[K]) =>
    onChange({ ...d, [key]: value });

  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), FORM_HARDCODED_THEME);
  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) =>
    set('theme', omitThemeKey(d.theme, key));

  if (selectedElement === 'eyebrow') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={d.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          helper={<>Small label above the heading. Blank hides it.</>}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'heading') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Heading"
          value={d.heading}
          originalValue={DEFAULTS.heading}
          onChange={(v) => set('heading', v)}
          helper={<>Blank hides the heading band — just the form shows.</>}
        />
      </BuilderFormSection>
    );
  }

  // -- section-level settings --
  return (
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
  );
}

// -- Preview ----------------------------------------------------------------

function FormSectionPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<FormSectionData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(d.theme, brandThemeDefaults(brand), FORM_HARDCODED_THEME);

  // Always render the shell — even with an empty heading, the form itself
  // (the attached section.form) renders in the shell's form slot.
  return (
    <SectionShell theme={resolved} brand={brand} pad="tight">
      {({ theme, headingFont, accent }) => {
        const sel = (id: FormSectionElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });
        if (!d.eyebrow && !d.heading) return null;
        return (
          <div className="flex flex-col items-center text-center">
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
            {d.heading ? (
              <SelectableElement {...sel('heading')} className="mt-2">
                <h2
                  className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] @2xl:text-[38px]"
                  style={{ fontFamily: headingFont, color: theme.heading }}
                >
                  {d.heading}
                </h2>
              </SelectableElement>
            ) : null}
          </div>
        );
      }}
    </SectionShell>
  );
}

export const formSection = defineSection<FormSectionData>({
  type: 'form',
  label: '// FORM',
  description:
    'A lead-capture form — collects enquiries straight into the leads inbox.',
  defaultData,
  Fields: FormSectionFields,
  Preview: FormSectionPreview,
  capabilityHints: {
    copyFields: ['eyebrow', 'heading'],
  },
  elementLabels: {
    eyebrow: 'Eyebrow',
    heading: 'Heading',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
