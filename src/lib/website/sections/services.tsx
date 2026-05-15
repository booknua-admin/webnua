'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Services section — services menu / jobs list. Rows of name + price-from +
// duration + optional description. Rows can be added and removed
// (editLayout). Individual row text is editCopy-gated.
// =============================================================================

export type ServiceItem = {
  id: string;
  name: string;
  priceFrom: string;
  durationLabel: string;
  description: string;
};

export type ServicesData = {
  title: string;
  intro: string;
  services: ServiceItem[];
};

function makeId(): string {
  return `svc-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULTS: ServicesData = {
  title: 'What we fix',
  intro: 'Fixed prices on the common stuff. Free quote for the rest.',
  services: [
    {
      id: makeId(),
      name: 'Switchboard upgrades',
      priceFrom: 'from $1,250',
      durationLabel: '2–3 hours',
      description: 'Old fuses to modern RCDs. Inspection report included.',
    },
    {
      id: makeId(),
      name: 'Power point installs',
      priceFrom: 'from $180',
      durationLabel: '~45 min',
      description: 'Single or double, indoor or weatherproof outdoor.',
    },
    {
      id: makeId(),
      name: 'Hot water diagnostics',
      priceFrom: 'Quoted',
      durationLabel: '1 hour',
      description: 'Find why it tripped and quote a fix on the spot.',
    },
  ],
};

function defaultData(): ServicesData {
  return {
    ...DEFAULTS,
    services: DEFAULTS.services.map((s) => ({ ...s, id: makeId() })),
  };
}

const TITLE_ALTS = [
  'What we fix',
  'Service menu',
  'Common jobs · fixed prices',
] as const;

const INTRO_ALTS = [
  'Fixed prices on the common stuff. Free quote for the rest.',
  'Most jobs are a fixed price. Anything custom, we quote on arrival.',
  'Standard work is priced upfront. Bespoke work gets a written quote.',
] as const;

function ServicesFields({ data, onChange }: SectionFieldsProps<ServicesData>) {
  const setField = useCallback(
    <K extends keyof ServicesData>(key: K, value: ServicesData[K]) =>
      onChange({ ...data, [key]: value }),
    [data, onChange],
  );

  const setService = useCallback(
    (index: number, next: ServiceItem) => {
      const services = data.services.slice();
      services[index] = next;
      onChange({ ...data, services });
    },
    [data, onChange],
  );

  const addService = useCallback(() => {
    onChange({
      ...data,
      services: [
        ...data.services,
        {
          id: makeId(),
          name: '',
          priceFrom: '',
          durationLabel: '',
          description: '',
        },
      ],
    });
  }, [data, onChange]);

  const removeService = useCallback(
    (id: string) => {
      onChange({
        ...data,
        services: data.services.filter((s) => s.id !== id),
      });
    },
    [data, onChange],
  );

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Section title"
          value={data.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => setField('title', v)}
        />
        <CopyField
          label="Intro"
          value={data.intro}
          originalValue={DEFAULTS.intro}
          alternatives={INTRO_ALTS}
          onChange={(v) => setField('intro', v)}
          multiline
          rows={2}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        {data.services.map((service, i) => (
          <div
            key={service.id}
            className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Service {i + 1}
              </p>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeService(service.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  Remove ×
                </button>
              </CapabilityGate>
            </div>
            <BuilderFormRow>
              <CopyField
                label="Name"
                value={service.name}
                onChange={(v) => setService(i, { ...service, name: v })}
              />
              <CopyField
                label="Price from"
                value={service.priceFrom}
                onChange={(v) => setService(i, { ...service, priceFrom: v })}
                placeholder="from $180"
              />
            </BuilderFormRow>
            <CopyField
              label="Duration"
              value={service.durationLabel}
              onChange={(v) => setService(i, { ...service, durationLabel: v })}
              placeholder="~45 min"
            />
            <CopyField
              label="Description"
              value={service.description}
              onChange={(v) => setService(i, { ...service, description: v })}
              multiline
              rows={2}
            />
          </div>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button
              variant="secondary"
              size="sm"
              onClick={addService}
              className="w-full"
            >
              + Add service
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    </>
  );
}

function ServicesPreview({ data, brand }: SectionPreviewProps<ServicesData>) {
  return (
    <section
      data-section-type="services"
      className="rounded-xl border border-rule bg-paper px-7 py-8 md:px-9"
    >
      <p
        className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: brand.accentColor }}
      >
        // SERVICES
      </p>
      <h3 className="mb-2 text-[26px] font-extrabold leading-[1.12] tracking-[-0.015em] text-ink">
        {data.title}
      </h3>
      {data.intro ? (
        <p className="mb-5 max-w-[520px] text-[14px] leading-[1.55] text-ink-mid">
          {data.intro}
        </p>
      ) : null}
      {data.services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule bg-card px-4 py-6 text-center text-[12px] text-ink-quiet">
          No services yet. Add one in the editor.
        </p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {data.services.map((service) => (
            <li
              key={service.id}
              className="rounded-lg border border-rule bg-card px-4 py-3.5"
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-bold text-ink">{service.name || 'Untitled service'}</p>
                {service.priceFrom ? (
                  <p
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: brand.accentColor }}
                  >
                    {service.priceFrom}
                  </p>
                ) : null}
              </div>
              {service.durationLabel ? (
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                  {service.durationLabel}
                </p>
              ) : null}
              {service.description ? (
                <p className="text-[12.5px] leading-[1.5] text-ink-mid">
                  {service.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const servicesSection = defineSection<ServicesData>({
  type: 'services',
  label: '// SERVICES',
  description: 'Services menu — rows of name, price-from, duration, description.',
  defaultData,
  Fields: ServicesFields,
  Preview: ServicesPreview,
  capabilityHints: {
    copyFields: ['title', 'intro', 'services'],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
