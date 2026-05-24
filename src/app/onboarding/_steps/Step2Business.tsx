'use client';

// =============================================================================
// Step 2: Business basics. Skippable — the brief derivation falls back to
// the signup values + the industry template's defaults if step 2 stays null.
//
// The email field is read-only — Pattern B's signup-time email is the
// authoritative contact; changing it would invalidate the magic-link auth
// session. The customer changes their email post-publish via /settings.
// =============================================================================

import { useState } from 'react';

import type { Step2Data } from '@/lib/onboarding/types';

import { StepFrame } from './_step-frame';

type Step2Props = {
  initial: Step2Data | null;
  fallbackBusinessName: string;
  fallbackEmail: string;
  onContinue: (data: Step2Data) => void;
  onSkip: () => void;
  onBack: () => void;
};

export function Step2Business({
  initial,
  fallbackBusinessName,
  fallbackEmail,
  onContinue,
  onSkip,
  onBack,
}: Step2Props) {
  const [businessName, setBusinessName] = useState(initial?.businessName ?? fallbackBusinessName);
  const [serviceArea, setServiceArea] = useState(initial?.serviceArea ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [hours, setHours] = useState(initial?.hours ?? 'Mon–Fri 9–5');
  const [address, setAddress] = useState(initial?.address ?? '');

  function handleContinue() {
    onContinue({
      businessName: businessName.trim() || fallbackBusinessName,
      serviceArea: serviceArea.trim(),
      phone: phone.trim(),
      hours: hours.trim(),
      address: address.trim(),
    });
  }

  return (
    <StepFrame
      title={
        <>
          The <em>basics</em> about your business.
        </>
      }
      description={
        <>
          We&rsquo;ll weave these into your site so visitors know exactly{' '}
          <strong>who you are and where you work</strong>.{' '}
          Anything you skip we&rsquo;ll fill in with sensible defaults.
        </>
      }
      onContinue={handleContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Business name"
          value={businessName}
          onChange={setBusinessName}
          placeholder={fallbackBusinessName}
        />
        <Field
          label="Service area"
          sub="City, region, or postcodes you cover."
          value={serviceArea}
          onChange={setServiceArea}
          placeholder="e.g. Western Sydney, Bondi to Bronte, Dublin 4 & 6"
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="0400 000 000"
            type="tel"
            inputMode="tel"
          />
          <Field label="Business hours" value={hours} onChange={setHours} placeholder="Mon–Fri 9–5" />
        </div>
        <Field
          label="Email"
          value={fallbackEmail}
          onChange={() => {}}
          readOnly
          sub="We use your sign-up email — change it later from Settings."
        />
        <Field
          label="Address (optional)"
          sub="Most trades skip this; useful if you have a public shopfront."
          value={address}
          onChange={setAddress}
          placeholder="123 Trade St, Suburb"
        />
      </div>
    </StepFrame>
  );
}

function Field({
  label,
  sub,
  value,
  onChange,
  placeholder,
  readOnly,
  type,
  inputMode,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
        {label}
      </label>
      <input
        type={type ?? 'text'}
        inputMode={inputMode}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          'block w-full rounded-lg border bg-card px-4 py-3 text-[15px] text-ink focus:outline-none md:text-[14px] ' +
          (readOnly
            ? 'border-rule cursor-not-allowed bg-paper-2 text-ink-quiet'
            : 'border-rule focus:border-rust focus:ring-2 focus:ring-rust/[0.2]')
        }
      />
      {sub ? <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-quiet">{sub}</p> : null}
    </div>
  );
}
