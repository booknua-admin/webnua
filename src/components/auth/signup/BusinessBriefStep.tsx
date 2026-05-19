'use client';

// =============================================================================
// BusinessBriefStep — the quick brief. Framed as "let's see if we can
// guarantee you even more" so filling it in feels like a reward hunt, not a
// form. Feeds the second (bigger) guarantee and the preview reveal.
// =============================================================================

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import type { SignupBrief } from '@/lib/signup/types';

type BusinessBriefStepProps = {
  brief: SignupBrief;
  onChange: (patch: Partial<SignupBrief>) => void;
  onNext: () => void;
  onBack: () => void;
};

const MAX_COLORS = 3;

function BusinessBriefStep({
  brief,
  onChange,
  onNext,
  onBack,
}: BusinessBriefStepProps) {
  const ready =
    brief.businessName.trim().length > 1 &&
    brief.mainService.trim().length > 1;

  const setColor = (index: number, value: string) => {
    const next = [...brief.brandColors];
    next[index] = value;
    onChange({ brandColors: next });
  };

  const addColor = () => {
    if (brief.brandColors.length >= MAX_COLORS) return;
    onChange({ brandColors: [...brief.brandColors, '#0a0a0a'] });
  };

  const removeColor = (index: number) => {
    if (brief.brandColors.length <= 1) return;
    onChange({
      brandColors: brief.brandColors.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="mb-7 text-center">
        <Eyebrow tone="rust">{'// Almost there'}</Eyebrow>
        <h2 className="mt-3 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
          Tell us about your business — and we&apos;ll see if we can guarantee
          you <span className="text-rust">even more</span>.
        </h2>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-quiet">
          The more we know, the sharper we can target. This shapes both your
          guarantee and the system we&apos;re about to show you.
        </p>
      </div>

      <div className="rounded-2xl border border-rule bg-card px-7 py-7">
        <Field id="biz-name" label="Business name">
          <Input
            id="biz-name"
            placeholder="e.g. Brightspark Electrical"
            value={brief.businessName}
            onChange={(e) => onChange({ businessName: e.target.value })}
          />
        </Field>

        <div className="mt-5">
          <Field id="biz-service" label="Your main service">
            <Input
              id="biz-service"
              placeholder="e.g. Emergency callouts & switchboard upgrades"
              value={brief.mainService}
              onChange={(e) => onChange({ mainService: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5">
          <label className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
            Brand colours
          </label>
          <p className="mt-1 text-[12px] text-ink-quiet">
            We&apos;ll theme your preview with these. Optional — pick 1–3.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {brief.brandColors.map((color, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-rule bg-paper px-2 py-1.5"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(i, e.target.value)}
                  aria-label={`Brand colour ${i + 1}`}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[11px] uppercase text-ink-mid">
                  {color}
                </span>
                {brief.brandColors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    aria-label={`Remove colour ${i + 1}`}
                    className="px-1 text-[13px] text-ink-quiet hover:text-warn"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {brief.brandColors.length < MAX_COLORS && (
              <button
                type="button"
                onClick={addColor}
                className="rounded-lg border border-dashed border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet hover:border-rust hover:text-rust"
              >
                + Add colour
              </button>
            )}
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button size="lg" disabled={!ready} onClick={onNext}>
            See if I qualify for more →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export { BusinessBriefStep };
