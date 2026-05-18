'use client';

// =============================================================================
// CreateClientModal — the create-a-client flow. A multi-step modal: business
// basics → brief → what to build → generate. Captures the brief once; the
// website / funnel checkboxes decide which generators run, so the same
// answers are never asked twice.
//
// Output is persisted to the created-clients overlay (STUB) and the flow
// routes to the result viewer.
// =============================================================================

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addCreatedClient } from '@/lib/clients/created-clients-stub';
import {
  AUDIENCE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  type Audience,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import type { ClientBrief } from '@/lib/website/site-generation-stub';
import { VOICE_TONE_PRESETS, type BrandObject } from '@/lib/website/types';

type Step = 'basics' | 'brief' | 'build' | 'generating' | 'done';

type IntentKind = Exclude<PrimaryIntent['kind'], 'other'>;

const ACCENT_SWATCHES = [
  '#d24317',
  '#2563eb',
  '#16a34a',
  '#0d1f3a',
  '#6b4ea6',
  '#c8941e',
] as const;

const INTENT_OPTIONS = PRIMARY_INTENT_CHIPS.filter((c) => c.id !== 'other') as {
  id: IntentKind;
  label: string;
}[];

export function CreateClientModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('basics');

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [area, setArea] = useState('');
  const [accent, setAccent] = useState<string>(ACCENT_SWATCHES[0]);

  const [intent, setIntent] = useState<IntentKind>('book');
  const [audience, setAudience] = useState<Audience>('cold-ad');

  const [wantWebsite, setWantWebsite] = useState(true);
  const [wantFunnel, setWantFunnel] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('basics');
    setName('');
    setIndustry('');
    setArea('');
    setAccent(ACCENT_SWATCHES[0]);
    setIntent('book');
    setAudience('cold-ad');
    setWantWebsite(true);
    setWantFunnel(true);
    setError(null);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const basicsValid = name.trim() && industry.trim() && area.trim();

  const runGeneration = async () => {
    setStep('generating');
    setError(null);
    const brand: BrandObject = {
      accentColor: accent,
      logoUrl: null,
      faviconUrl: null,
      voice: VOICE_TONE_PRESETS.friendlyLocal,
      audienceLine: `Trusted ${industry.trim().toLowerCase()} serving ${area.trim()}.`,
      industryCategory: industry.trim(),
      topJobsToBeBooked: [],
    };
    const brief: ClientBrief = {
      businessName: name.trim(),
      industry: industry.trim(),
      serviceArea: area.trim(),
      brand,
      primaryIntent: { kind: intent },
      audience,
    };
    try {
      // Lazy-loaded — keeps the heavy generation module graph out of the
      // /clients/new page's static import chain.
      const [{ generateSiteStub }, { generateFunnelStub }] = await Promise.all([
        import('@/lib/website/site-generation-stub'),
        import('@/lib/funnel/generation-stub'),
      ]);
      const [site, funnel] = await Promise.all([
        wantWebsite ? generateSiteStub(brief) : Promise.resolve(null),
        wantFunnel ? generateFunnelStub() : Promise.resolve(null),
      ]);
      const created = addCreatedClient({
        name: brief.businessName,
        industry: brief.industry,
        serviceArea: brief.serviceArea,
        brand,
        pages: site?.pages ?? null,
        funnelName: funnel?.funnel.name ?? null,
        funnelSteps: funnel?.steps ?? null,
      });
      onOpenChange(false);
      setTimeout(reset, 200);
      router.push(`/clients/new/result?c=${created.id}`);
    } catch {
      setError('Generation failed — try again.');
      setStep('build');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg" className="p-0">
        <DialogTitle className="sr-only">Create a client</DialogTitle>
        <div className="border-b border-paper-2 px-8 py-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
            {'// NEW CLIENT'}
          </p>
          <p className="mt-1 text-[20px] font-bold tracking-[-0.01em] text-ink">
            {stepTitle(step)}
          </p>
        </div>

        <div className="px-8 py-6">
          {step === 'basics' ? (
            <div className="flex flex-col gap-4">
              <Field label="Business name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Plumbing" />
              </Field>
              <Field label="Trade / industry">
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Plumbing services"
                />
              </Field>
              <Field label="Service area">
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Perth metro" />
              </Field>
              <Field label="Brand accent">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => setAccent(c)}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition-transform hover:scale-105',
                        accent === c ? 'border-ink' : 'border-rule',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          ) : null}

          {step === 'brief' ? (
            <div className="flex flex-col gap-6">
              <Field label="What should visitors do?">
                <ChipRow
                  options={INTENT_OPTIONS}
                  value={intent}
                  onChange={(v) => setIntent(v as IntentKind)}
                />
              </Field>
              <Field label="Who is the traffic?">
                <ChipRow
                  options={AUDIENCE_CHIPS}
                  value={audience}
                  onChange={(v) => setAudience(v as Audience)}
                />
              </Field>
            </div>
          ) : null}

          {step === 'build' ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-ink-mid">
                Pick what to generate from this brief — answered once, built for both.
              </p>
              <BuildOption
                title="Website"
                desc="A multi-page site — home, services, about, contact."
                checked={wantWebsite}
                onToggle={() => setWantWebsite((v) => !v)}
              />
              <BuildOption
                title="Funnel"
                desc="A focused conversion funnel — landing, schedule, thanks."
                checked={wantFunnel}
                onToggle={() => setWantFunnel((v) => !v)}
              />
              {error ? <p className="text-[12px] text-warn">{error}</p> : null}
            </div>
          ) : null}

          {step === 'generating' ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-rule border-t-rust" />
              <p className="text-[14px] font-semibold text-ink">Generating…</p>
              <p className="text-[12px] text-ink-quiet">
                Building {[wantWebsite && 'a website', wantFunnel && 'a funnel'].filter(Boolean).join(' + ')} from your brief.
              </p>
            </div>
          ) : null}

          {step === 'done' ? (
            <div className="py-8 text-center text-[14px] text-ink">Done.</div>
          ) : null}
        </div>

        {step !== 'generating' && step !== 'done' ? (
          <div className="flex items-center justify-between border-t border-paper-2 bg-paper px-8 py-4">
            <Button variant="ghost" onClick={() => stepBack(step, setStep, () => close(false))}>
              {step === 'basics' ? 'Cancel' : '← Back'}
            </Button>
            {step === 'build' ? (
              <Button onClick={runGeneration} disabled={!wantWebsite && !wantFunnel}>
                Generate →
              </Button>
            ) : (
              <Button
                onClick={() => setStep(step === 'basics' ? 'brief' : 'build')}
                disabled={step === 'basics' && !basicsValid}
              >
                Continue →
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function stepTitle(step: Step): string {
  switch (step) {
    case 'basics':
      return 'Business basics';
    case 'brief':
      return 'The brief';
    case 'build':
      return 'What should we build?';
    case 'generating':
      return 'Generating';
    case 'done':
      return 'Done';
  }
}

function stepBack(step: Step, setStep: (s: Step) => void, cancel: () => void): void {
  if (step === 'basics') cancel();
  else if (step === 'brief') setStep('basics');
  else if (step === 'build') setStep('brief');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </span>
      {children}
    </label>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
            value === o.id
              ? 'border-rust bg-rust text-paper'
              : 'border-rule bg-card text-ink-mid hover:border-rust/60',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BuildOption({
  title,
  desc,
  checked,
  onToggle,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors',
        checked ? 'border-rust bg-rust-soft' : 'border-rule bg-card hover:border-rust/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[11px] font-bold',
          checked ? 'border-rust bg-rust text-paper' : 'border-rule text-transparent',
        )}
        aria-hidden
      >
        ✓
      </span>
      <span>
        <span className="block text-[14px] font-bold text-ink">{title}</span>
        <span className="block text-[12.5px] text-ink-mid">{desc}</span>
      </span>
    </button>
  );
}
