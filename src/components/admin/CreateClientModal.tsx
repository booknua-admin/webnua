'use client';

// =============================================================================
// CreateClientModal — the create-a-client flow. A multi-step modal:
//   business → offer → brief → design → build → generate.
// The brief is captured once; the website / funnel checkboxes decide which
// generators run, so the same answers are never asked twice.
//
// Output is persisted to the created-clients overlay (STUB) and the flow
// routes to the result viewer.
// =============================================================================

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AUDIENCE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  type Audience,
  type BusinessDetails,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import { CURATED_FONTS } from '@/lib/website/google-fonts';
import type { ClientBrief } from '@/lib/website/site-generation-stub';
import { uploadSectionImage } from '@/lib/website/upload-image';
import { VOICE_TONE_PRESETS, type BrandObject } from '@/lib/website/types';

type Step = 'business' | 'offer' | 'brief' | 'design' | 'build';
const STEPS: Step[] = ['business', 'offer', 'brief', 'design', 'build'];

type Phase = Step | 'generating';
type IntentKind = Exclude<PrimaryIntent['kind'], 'other'>;

const ACCENT_SWATCHES = [
  '#d24317',
  '#2563eb',
  '#16a34a',
  '#0d1f3a',
  '#6b4ea6',
  '#c8941e',
  '#0e7490',
  '#be123c',
] as const;

const INTENT_OPTIONS = PRIMARY_INTENT_CHIPS.filter((c) => c.id !== 'other') as {
  id: IntentKind;
  label: string;
}[];

/** Stub "AI enhance" — a light polish of the rough offer text. The real
 *  Claude API replaces this. */
function enhanceOffer(raw: string, industry: string): string {
  const text = raw.trim();
  if (!text) {
    return `We deliver dependable ${
      industry.trim().toLowerCase() || 'local service'
    } with honest, upfront pricing — and every job is backed by our workmanship guarantee.`;
  }
  let out = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(out)) out += '.';
  if (!/guarantee|warrant/i.test(out)) {
    out += ' Every job comes with an upfront quote and our workmanship guarantee.';
  }
  return out;
}

export function CreateClientModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('business');

  // business
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');

  // offer
  const [offer, setOffer] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [services, setServices] = useState<string[]>(['', '', '']);

  // brief
  const [intent, setIntent] = useState<IntentKind>('book');
  const [audience, setAudience] = useState<Audience>('cold-ad');

  // design
  const [accent, setAccent] = useState<string>(ACCENT_SWATCHES[0]);
  const [headingFont, setHeadingFont] = useState('inter-tight');
  const [bodyFont, setBodyFont] = useState('inter-tight');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  // build
  const [wantWebsite, setWantWebsite] = useState(true);
  const [wantFunnel, setWantFunnel] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('business');
    setName(''); setIndustry(''); setOwnerName(''); setPhone(''); setEmail(''); setArea('');
    setOffer(''); setServices(['', '', '']); setEnhancing(false);
    setIntent('book'); setAudience('cold-ad');
    setAccent(ACCENT_SWATCHES[0]); setHeadingFont('inter-tight'); setBodyFont('inter-tight');
    setLogoUrl(''); setLogoUploading(false);
    setWantWebsite(true); setWantFunnel(true); setError(null);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const businessValid = name.trim() && industry.trim() && area.trim();

  const handleLogo = async (file: File | null | undefined) => {
    if (!file) return;
    setLogoUploading(true);
    const result = await uploadSectionImage(file);
    setLogoUploading(false);
    if (result.ok) setLogoUrl(result.data.url);
    else setError(result.error.message);
  };

  const setService = (i: number, v: string) =>
    setServices((s) => s.map((x, idx) => (idx === i ? v : x)));

  const runGeneration = async () => {
    setPhase('generating');
    setError(null);
    const cleanServices = services.map((s) => s.trim()).filter(Boolean);
    const business: BusinessDetails = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      serviceArea: area.trim(),
      offer: offer.trim(),
      services: cleanServices,
    };
    const brand: BrandObject = {
      accentColor: accent,
      logoUrl: logoUrl || null,
      faviconUrl: null,
      voice: VOICE_TONE_PRESETS.friendlyLocal,
      audienceLine:
        offer.trim().split(/(?<=[.!?])\s/)[0] ||
        `Trusted ${industry.trim().toLowerCase()} serving ${area.trim()}.`,
      industryCategory: industry.trim(),
      topJobsToBeBooked: cleanServices,
      headingFont,
      bodyFont,
    };
    const brief: ClientBrief = {
      business,
      industry: industry.trim(),
      brand,
      primaryIntent: { kind: intent },
      audience,
    };
    try {
      // Lazy-loaded — keeps the heavy generation + Supabase write graph out
      // of the /clients/new page's static import chain.
      const { createClientWithGeneration } = await import('@/lib/clients/create-client');
      const result = await createClientWithGeneration({ brief, wantWebsite, wantFunnel });
      onOpenChange(false);
      setTimeout(reset, 200);
      router.push(`/clients/new/result?c=${result.clientSlug}`);
    } catch {
      setError('Generation failed — check you are signed in as an operator, then try again.');
      setPhase('build');
    }
  };

  const stepIndex = phase === 'generating' ? STEPS.length : STEPS.indexOf(phase as Step);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg" className="max-h-[calc(100vh-4rem)] p-0">
        <DialogTitle className="sr-only">Create a client</DialogTitle>

        {/* header */}
        <div className="border-b border-paper-2 px-8 py-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
              {'// NEW CLIENT'}
            </p>
            {phase !== 'generating' ? (
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-[20px] font-bold tracking-[-0.01em] text-ink">
            {phaseTitle(phase)}
          </p>
        </div>

        {/* body */}
        <div className="max-h-[58vh] overflow-y-auto px-8 py-6">
          {phase === 'business' ? (
            <div className="flex flex-col gap-4">
              <Field label="Business name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Plumbing" />
              </Field>
              <Field label="Trade / industry">
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Plumbing services" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner name">
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Jane Smith" />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@acme.com" />
                </Field>
                <Field label="Service area">
                  <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Perth metro" />
                </Field>
              </div>
            </div>
          ) : null}

          {phase === 'offer' ? (
            <div className="flex flex-col gap-5">
              <Field
                label="Your offer"
                hint={
                  <button
                    type="button"
                    disabled={enhancing}
                    onClick={() => {
                      setEnhancing(true);
                      setTimeout(() => {
                        setOffer((o) => enhanceOffer(o, industry));
                        setEnhancing(false);
                      }, 700);
                    }}
                    className="rounded-pill border border-rust/40 bg-rust-soft px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust transition-colors hover:bg-rust hover:text-paper disabled:opacity-50"
                  >
                    {enhancing ? 'Enhancing…' : '✦ Enhance with AI'}
                  </button>
                }
              >
                <textarea
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  rows={4}
                  placeholder="Describe what you do and what makes you different — rough notes are fine, AI will polish them."
                  className="w-full rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-rust"
                />
              </Field>
              <Field label="Services you offer">
                <div className="flex flex-col gap-2">
                  {services.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={s}
                        onChange={(e) => setService(i, e.target.value)}
                        placeholder={`Service ${i + 1}`}
                      />
                      {services.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setServices((arr) => arr.filter((_, idx) => idx !== i))}
                          className="font-mono text-[11px] font-bold text-rust hover:text-rust-deep"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setServices((s) => [...s, ''])}
                    className="w-fit"
                  >
                    + Add service
                  </Button>
                </div>
              </Field>
            </div>
          ) : null}

          {phase === 'brief' ? (
            <div className="flex flex-col gap-6">
              <Field label="What should visitors do?">
                <ChipRow options={INTENT_OPTIONS} value={intent} onChange={setIntent} />
              </Field>
              <Field label="Who is the traffic?">
                <ChipRow options={AUDIENCE_CHIPS} value={audience} onChange={setAudience} />
              </Field>
            </div>
          ) : null}

          {phase === 'design' ? (
            <div className="flex flex-col gap-5">
              <Field label="Brand accent colour">
                <div className="flex flex-wrap items-center gap-2">
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
                  <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-card px-2.5 py-1.5">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
                      Custom
                    </span>
                  </label>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Heading font">
                  <FontSelect value={headingFont} onChange={setHeadingFont} />
                </Field>
                <Field label="Body font">
                  <FontSelect value={bodyFont} onChange={setBodyFont} />
                </Field>
              </div>
              <Field label="Logo">
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleLogo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded border border-rule bg-paper-2" />
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => logoInput.current?.click()}
                    disabled={logoUploading}
                    className="w-fit"
                  >
                    {logoUploading ? 'Uploading…' : '⊕ Upload logo'}
                  </Button>
                )}
              </Field>
            </div>
          ) : null}

          {phase === 'build' ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-ink-mid">
                Pick what to generate from this brief — answered once, built for both.
              </p>
              <BuildOption
                title="Website"
                desc="A multi-page site — header, home, services, about, contact, footer."
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

          {phase === 'generating' ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-rule border-t-rust" />
              <p className="text-[14px] font-semibold text-ink">Generating…</p>
              <p className="text-[12px] text-ink-quiet">
                Building {[wantWebsite && 'a website', wantFunnel && 'a funnel'].filter(Boolean).join(' + ')} from your brief.
              </p>
            </div>
          ) : null}
        </div>

        {/* footer */}
        {phase !== 'generating' ? (
          <div className="flex items-center justify-between border-t border-paper-2 bg-paper px-8 py-4">
            <Button variant="ghost" onClick={() => goBack(phase, setPhase, () => close(false))}>
              {phase === 'business' ? 'Cancel' : '← Back'}
            </Button>
            {phase === 'build' ? (
              <Button onClick={runGeneration} disabled={!wantWebsite && !wantFunnel}>
                Generate →
              </Button>
            ) : (
              <Button
                onClick={() => setPhase(STEPS[STEPS.indexOf(phase as Step) + 1])}
                disabled={phase === 'business' && !businessValid}
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

function phaseTitle(phase: Phase): string {
  switch (phase) {
    case 'business':
      return 'Business details';
    case 'offer':
      return 'Your offer';
    case 'brief':
      return 'The brief';
    case 'design':
      return 'Brand & design';
    case 'build':
      return 'What should we build?';
    case 'generating':
      return 'Generating';
  }
}

function goBack(phase: Phase, setPhase: (p: Phase) => void, cancel: () => void): void {
  if (phase === 'business' || phase === 'generating') {
    cancel();
    return;
  }
  setPhase(STEPS[STEPS.indexOf(phase) - 1]);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {label}
        </span>
        {hint}
      </span>
      {children}
    </label>
  );
}

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-md border border-rule bg-card px-2.5 text-[13px] text-ink outline-none focus:border-rust"
    >
      {CURATED_FONTS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.family}
        </option>
      ))}
    </select>
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
