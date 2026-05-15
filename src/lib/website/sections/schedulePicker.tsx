'use client';

import { BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Schedule picker section — funnel-only (allowedContainers: ['funnelStep']).
// Calendar-integrated booking picker. Stub-layer copy + a visual mockup of
// the picker; real integration (calendar source, slot logic, timezone
// handling) lands when bookings backend wires in.
// =============================================================================

export type SchedulePickerData = {
  title: string;
  intro: string;
  durationLabel: string;
  earliestSlotLabel: string;
};

const DEFAULTS: SchedulePickerData = {
  title: 'Pick a time',
  intro: "We'll SMS to confirm within 10 minutes of booking.",
  durationLabel: '1-hour window',
  earliestSlotLabel: 'Earliest: today, 4:00 PM',
};

function defaultData(): SchedulePickerData {
  return { ...DEFAULTS };
}

const TITLE_ALTS = [
  'Pick a time',
  'Book your callout',
  'Schedule a sparkie',
] as const;

function SchedulePickerFields({ data, onChange }: SectionFieldsProps<SchedulePickerData>) {
  const set = <K extends keyof SchedulePickerData>(
    key: K,
    value: SchedulePickerData[K],
  ) => onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Section title"
          value={data.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => set('title', v)}
        />
        <CopyField
          label="Intro"
          value={data.intro}
          originalValue={DEFAULTS.intro}
          onChange={(v) => set('intro', v)}
          multiline
          rows={2}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Duration label"
          value={data.durationLabel}
          originalValue={DEFAULTS.durationLabel}
          onChange={(v) => set('durationLabel', v)}
          helper="Shown as the visit-window label inside each slot."
        />
        <CopyField
          label="Earliest-slot caption"
          value={data.earliestSlotLabel}
          originalValue={DEFAULTS.earliestSlotLabel}
          onChange={(v) => set('earliestSlotLabel', v)}
          helper="Real picker reads from the calendar integration. Stub displays this verbatim."
        />
      </BuilderFormSection>
    </>
  );
}

function SchedulePickerPreview({ data, brand }: SectionPreviewProps<SchedulePickerData>) {
  // Mock 4 slots for the visual preview — not real availability.
  const mockSlots = [
    { day: 'Wed', date: 'May 14', times: ['10am', '2pm', '4pm'] },
    { day: 'Thu', date: 'May 15', times: ['8am', '11am', '3pm'] },
    { day: 'Fri', date: 'May 16', times: ['9am', '1pm'] },
    { day: 'Sat', date: 'May 17', times: ['10am', '12pm'] },
  ];

  return (
    <section
      data-section-type="schedulePicker"
      className="rounded-xl border border-rule bg-paper px-7 py-8 md:px-9"
    >
      <p
        className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: brand.accentColor }}
      >
        // SCHEDULE
      </p>
      <h3 className="mb-2 text-[26px] font-extrabold leading-[1.12] tracking-[-0.015em] text-ink">
        {data.title}
      </h3>
      {data.intro ? (
        <p className="mb-4 max-w-[520px] text-[14px] leading-[1.55] text-ink-mid">
          {data.intro}
        </p>
      ) : null}
      <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {data.earliestSlotLabel} · {data.durationLabel}
      </p>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {mockSlots.map((slot) => (
          <div
            key={slot.day}
            className="rounded-lg border border-rule bg-card px-3 py-3"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {slot.day} · {slot.date}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {slot.times.map((time) => (
                <span
                  key={time}
                  className="rounded border border-rule bg-paper px-2 py-1 text-center text-[12px] text-ink"
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
        Mockup · real availability pulls from the calendar integration.
      </p>
    </section>
  );
}

export const schedulePickerSection = defineSection<SchedulePickerData>({
  type: 'schedulePicker',
  label: '// SCHEDULE PICKER',
  description: 'Calendar-integrated booking picker. Funnel schedule steps only.',
  defaultData,
  Fields: SchedulePickerFields,
  Preview: SchedulePickerPreview,
  capabilityHints: {
    copyFields: ['title', 'intro', 'durationLabel', 'earliestSlotLabel'],
  },
  allowedContainers: ['funnelStep'],
  implemented: true,
});
