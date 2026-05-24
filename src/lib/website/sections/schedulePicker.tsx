'use client';

import { BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { setBrandStyleValue } from '../brand-style';
import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { schedulePickerMeta } from './registry-meta';
import {
  brandThemeDefaults,
  mixHex,
  resolveTheme,
  type SectionTheme,
} from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';

// =============================================================================
// Schedule picker section — funnel-only. A calendar-integrated booking
// picker. Uplifted to the hero pattern (SectionShell + theme + element-
// inspector) for visual consistency; the slot grid is a MOCKUP — the real
// front-end booking system is a later stage. Element-inspector model +
// brand-default colour inheritance.
// =============================================================================

type ScheduleElement = 'eyebrow' | 'headline' | 'subheadline';

export type SchedulePickerData = {
  /** Per-section colour overrides — absent fields inherit the brand default. */
  theme: SectionTheme;
  eyebrow: string;
  title: string;
  intro: string;
  durationLabel: string;
  earliestSlotLabel: string;
};

const SCHEDULE_HARDCODED_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0f1115',
  body: '#5b6270',
};

const DEFAULTS: SchedulePickerData = {
  theme: {},
  eyebrow: 'SCHEDULE',
  title: 'Pick a time',
  intro: "We'll SMS to confirm within 10 minutes of booking.",
  durationLabel: '1-hour window',
  earliestSlotLabel: 'Earliest: today, 4:00 PM',
};

function defaultData(): SchedulePickerData {
  return { ...DEFAULTS, theme: {} };
}

function withDefaults(data: SchedulePickerData): SchedulePickerData {
  return { ...DEFAULTS, ...data };
}

function omitThemeKey(theme: SectionTheme, key: keyof SectionTheme): SectionTheme {
  const next = { ...theme };
  delete next[key];
  return next;
}

const TITLE_ALTS = [DEFAULTS.title, 'Book your callout', 'Schedule a visit'] as const;

// -- Fields -----------------------------------------------------------------

function SchedulePickerFields({
  data,
  onChange,
  selectedElement,
  clientId,
  brand,
}: SectionFieldsProps<SchedulePickerData>) {
  const d = withDefaults(data);
  const set = <K extends keyof SchedulePickerData>(
    key: K,
    value: SchedulePickerData[K],
  ) => onChange({ ...d, [key]: value });

  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    SCHEDULE_HARDCODED_THEME,
  );

  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });
  const clearColor = (key: keyof SectionTheme) =>
    set('theme', omitThemeKey(d.theme, key));
  const applyHeading = (color: string) => {
    if (clientId) setBrandStyleValue(clientId, 'headingColor', color);
    set('theme', omitThemeKey(d.theme, 'heading'));
  };

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

  if (selectedElement === 'subheadline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Intro"
          value={d.intro}
          originalValue={DEFAULTS.intro}
          onChange={(v) => set('intro', v)}
          multiline
          rows={2}
        />
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
        <CopyField
          label="Duration label"
          value={d.durationLabel}
          originalValue={DEFAULTS.durationLabel}
          onChange={(v) => set('durationLabel', v)}
          helper={<>Shown as the visit-window label.</>}
        />
        <CopyField
          label="Earliest-slot caption"
          value={d.earliestSlotLabel}
          originalValue={DEFAULTS.earliestSlotLabel}
          onChange={(v) => set('earliestSlotLabel', v)}
          helper={<>The real picker reads availability from the booking system.</>}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

// Mock slots — not real availability. The booking system replaces these.
const MOCK_SLOTS = [
  { day: 'Wed', date: 'May 14', times: ['10am', '2pm', '4pm'] },
  { day: 'Thu', date: 'May 15', times: ['8am', '11am', '3pm'] },
  { day: 'Fri', date: 'May 16', times: ['9am', '1pm'] },
  { day: 'Sat', date: 'May 17', times: ['10am', '12pm'] },
];

function SchedulePickerPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<SchedulePickerData>) {
  const d = withDefaults(data);
  const resolved = resolveTheme(
    d.theme,
    brandThemeDefaults(brand),
    SCHEDULE_HARDCODED_THEME,
  );

  return (
    <SectionShell theme={resolved} brand={brand} pad="roomy">
      {({ theme, headingFont, accent }) => {
        const sel = (id: ScheduleElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        return (
          <div className="flex flex-col">
            <div className="mb-7 flex flex-col items-center text-center">
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
                  className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] @2xl:text-[40px]"
                  style={{ fontFamily: headingFont, color: theme.heading }}
                >
                  {d.title}
                </h2>
              </SelectableElement>
              {d.intro ? (
                <SelectableElement {...sel('subheadline')} className="mt-4">
                  <p
                    className="max-w-[520px] whitespace-pre-line text-[15px] leading-[1.6]"
                    style={{ color: theme.body }}
                  >
                    {d.intro}
                  </p>
                </SelectableElement>
              ) : null}
            </div>

            <p
              className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: theme.muted }}
            >
              {d.earliestSlotLabel} · {d.durationLabel}
            </p>

            <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
              {MOCK_SLOTS.map((slot) => (
                <div
                  key={slot.day}
                  className="rounded-xl px-3.5 py-3.5"
                  style={{
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.cardBorder}`,
                  }}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: theme.muted }}
                  >
                    {slot.day} · {slot.date}
                  </p>
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {slot.times.map((time) => (
                      <span
                        key={time}
                        className="rounded-md py-1.5 text-center text-[12.5px] font-medium"
                        style={{
                          backgroundColor: mixHex(accent, theme.background, 0.9),
                          color: theme.heading,
                        }}
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p
              className="mt-4 text-center text-[11px] uppercase tracking-[0.14em]"
              style={{ color: theme.muted }}
            >
              Mockup · live availability connects when the booking system is wired up.
            </p>
          </div>
        );
      }}
    </SectionShell>
  );
}

export const schedulePickerSection = defineSection<SchedulePickerData>({
  ...schedulePickerMeta,
  defaultData,
  Fields: SchedulePickerFields,
  Preview: SchedulePickerPreview,
});
