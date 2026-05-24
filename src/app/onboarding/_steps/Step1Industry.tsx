'use client';

// =============================================================================
// Step 1: Industry — REQUIRED. The wizard's only mandatory step.
//
// UX shape:
//   1. Dropdown of the 11 known industries + "Other".
//   2. Industry-mirror block: the moment the customer picks an industry,
//      services + trust signals from the template appear as chips. Each
//      chip toggles (kept / removed); the customer can add custom entries.
//   3. "Other" routes to a free-text input + manual services entry.
//
// The mirror is the conversion lever — the customer immediately sees that
// Webnua "gets" their trade. We pre-fill from the industry template so a
// customer who hits Continue without touching the chips still produces a
// fully-populated step 1.
// =============================================================================

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  INDUSTRY_TEMPLATES,
  type IndustryKey,
  mapIndustry,
  resolveIndustryTemplate,
} from '@/lib/website/industry-templates';
import type { Step1Data } from '@/lib/onboarding/types';

import { StepFrame } from './_step-frame';

type Step1Props = {
  initial: Step1Data | null;
  fallbackIndustry: string;
  onContinue: (data: Step1Data) => void;
};

const INDUSTRY_OPTIONS = Object.values(INDUSTRY_TEMPLATES)
  .filter((t) => t.key !== 'generic')
  .map((t) => ({ value: t.key, label: t.displayName }));

export function Step1Industry({ initial, fallbackIndustry, onContinue }: Step1Props) {
  // Seed from prior state OR best-effort map of the signup-time industry
  // string (so a resume lands on the customer's signup category).
  const seedKey: IndustryKey | 'other' =
    initial?.industryFreeText ? 'other' : initial?.industryKey ?? mapIndustry(fallbackIndustry);
  const [selection, setSelection] = useState<IndustryKey | 'other'>(seedKey);
  const [freeText, setFreeText] = useState<string>(
    initial?.industryFreeText ?? (seedKey === 'other' ? fallbackIndustry : ''),
  );

  // Resolve the active template for the chip seed. "Other" derives from
  // mapIndustry on the free-text (falls back to generic for unrecognised).
  const activeTemplate = useMemo(() => {
    if (selection === 'other') {
      return resolveIndustryTemplate(freeText);
    }
    return INDUSTRY_TEMPLATES[selection];
  }, [selection, freeText]);

  const [services, setServices] = useState<string[]>(
    initial?.services ?? [...activeTemplate.defaultServices],
  );
  const [trustSignals, setTrustSignals] = useState<string[]>(
    initial?.trustSignals ?? [...activeTemplate.trustSignals],
  );
  const [customService, setCustomService] = useState('');
  const [customTrust, setCustomTrust] = useState('');

  // When the customer flips the industry dropdown, refresh the chip
  // defaults — but only if they hadn't already personalised the lists
  // (a resume keeps their picks). We treat empty arrays as "first run".
  function pickIndustry(next: IndustryKey | 'other') {
    setSelection(next);
    const template = next === 'other' ? resolveIndustryTemplate(freeText) : INDUSTRY_TEMPLATES[next];
    setServices([...template.defaultServices]);
    setTrustSignals([...template.trustSignals]);
  }

  function toggleService(value: string) {
    setServices((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }
  function addCustomService() {
    const trimmed = customService.trim();
    if (!trimmed || services.includes(trimmed)) return;
    setServices((prev) => [...prev, trimmed]);
    setCustomService('');
  }
  function toggleTrust(value: string) {
    setTrustSignals((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }
  function addCustomTrust() {
    const trimmed = customTrust.trim();
    if (!trimmed || trustSignals.includes(trimmed)) return;
    setTrustSignals((prev) => [...prev, trimmed]);
    setCustomTrust('');
  }

  const continueDisabled =
    selection === 'other' && freeText.trim().length === 0;

  function handleContinue() {
    if (continueDisabled) return;
    const industryKey: IndustryKey =
      selection === 'other' ? resolveIndustryTemplate(freeText).key : selection;
    onContinue({
      industryKey,
      industryFreeText: selection === 'other' ? freeText.trim() : null,
      services: services.filter(Boolean),
      trustSignals: trustSignals.filter(Boolean),
    });
  }

  return (
    <StepFrame
      title={
        <>
          What kind of business do <em>you</em> run?
        </>
      }
      description={
        <>
          Pick your trade and we&rsquo;ll tailor the site, copy, and conversion
          patterns to match. <strong>You can edit any of this later.</strong>
        </>
      }
      continueDisabled={continueDisabled}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-6">
        <div>
          <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Your trade
          </label>
          <select
            value={selection}
            onChange={(e) => pickIndustry(e.target.value as IndustryKey | 'other')}
            className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
          >
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            <option value="other">Other / not listed</option>
          </select>
        </div>

        {selection === 'other' ? (
          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
              Describe your trade
            </label>
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="e.g. fence installer, pool maintenance, sign-writing"
              className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
            />
          </div>
        ) : null}

        {/* Industry mirror — the conversion lever. Shows the moment the
            customer picks an industry. */}
        <div className="rounded-xl border border-rule bg-paper-2 px-5 py-5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// We got it'}
          </div>
          <p className="mt-2 text-[14px] leading-[1.45] text-ink-soft">
            We&rsquo;ll build a site for a <strong className="text-ink">{activeTemplate.displayName.toLowerCase()}</strong>{' '}
            — <em className="not-italic">{describeUrgencyMode(activeTemplate.urgencyMode)}</em>.
          </p>

          <ChipSection
            label="Services we&rsquo;ll feature"
            sub="Tap to remove. Add any missing jobs you do."
            options={[...activeTemplate.defaultServices]}
            selected={services}
            onToggle={toggleService}
            customValue={customService}
            onCustomChange={setCustomService}
            onAddCustom={addCustomService}
          />

          <ChipSection
            label="Trust signals you can claim"
            sub="Remove any that don&rsquo;t apply. Add your own (e.g. specific licences, awards)."
            options={[...activeTemplate.trustSignals]}
            selected={trustSignals}
            onToggle={toggleTrust}
            customValue={customTrust}
            onCustomChange={setCustomTrust}
            onAddCustom={addCustomTrust}
          />
        </div>
      </div>
    </StepFrame>
  );
}

function describeUrgencyMode(mode: 'emergency-callout' | 'scheduled' | 'project' | 'mixed'): string {
  switch (mode) {
    case 'emergency-callout':
      return 'customers usually arrive in a hurry, so the page leans hard on "we can be there today"';
    case 'scheduled':
      return 'customers plan ahead, so the page leans on reliability + recurring-visit ease';
    case 'project':
      return 'customers are scoping a bigger piece of work, so the page leans on quality + clean quoting';
    case 'mixed':
      return 'jobs vary from urgent to planned, so the page covers both with a flexible CTA';
  }
}

function ChipSection({
  label,
  sub,
  options,
  selected,
  onToggle,
  customValue,
  onCustomChange,
  onAddCustom,
}: {
  label: string;
  sub: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  customValue: string;
  onCustomChange: (next: string) => void;
  onAddCustom: () => void;
}) {
  // Combine template defaults + custom additions so customs render as
  // chips too (and get the same toggle UX).
  const all = Array.from(new Set([...options, ...selected]));
  return (
    <div className="mt-4">
      <div
        className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p className="mt-0.5 text-[12px] leading-[1.4] text-ink-quiet">{sub}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {all.map((value) => {
          const isOn = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={
                'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ' +
                (isOn
                  ? 'border-rust bg-rust text-paper'
                  : 'border-rule bg-card text-ink-soft hover:border-ink')
              }
            >
              {value}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddCustom();
            }
          }}
          placeholder="Add your own…"
          className="flex-1 rounded-lg border border-rule bg-card px-3 py-2 text-[14px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]"
        />
        <Button type="button" variant="outline" onClick={onAddCustom} size="sm">
          + Add
        </Button>
      </div>
    </div>
  );
}
