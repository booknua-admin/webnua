'use client';

// =============================================================================
// CreateClientModal — the create-a-client flow. A multi-step modal:
//   business → offer → brief → design → build → generate.
// The brief is captured once; the website / funnel checkboxes decide which
// generators run, so the same answers are never asked twice.
//
// The client + website + funnel are persisted to Supabase (see
// lib/clients/create-client.ts); the flow routes to the result viewer.
// =============================================================================

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  AUDIENCE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  type Audience,
  type BusinessDetails,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import { CURATED_FONTS } from '@/lib/website/google-fonts';
import { enhanceFunnelOfferText, generateFunnelOffer, type FunnelOffer } from '@/lib/website/offer-generate';
import type { ClientBrief, FunnelTestimonial } from '@/lib/website/site-generation-stub';
import { uploadSectionImage } from '@/lib/website/upload-image';
import { VOICE_TONE_PRESETS, type BrandObject } from '@/lib/website/types';

type Step = 'business' | 'offer' | 'brief' | 'funnel-offer' | 'design' | 'build';
const STEPS: Step[] = ['business', 'offer', 'brief', 'funnel-offer', 'design', 'build'];

type Phase = Step | 'generating';
type IntentKind = Exclude<PrimaryIntent['kind'], 'other'>;

const DEFAULT_BRAND_COLOR = '#d24317';
const MAX_BRAND_COLORS = 3;

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
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>(['', '', '']);

  // brief
  const [intent, setIntent] = useState<IntentKind>('book');
  const [audience, setAudience] = useState<Audience>('cold-ad');
  // brief — funnel-specific inputs (feed the AI funnel offer in a later session)
  const [funnelService, setFunnelService] = useState('');
  const [funnelCustomerPain, setFunnelCustomerPain] = useState('');
  const [funnelGuarantee, setFunnelGuarantee] = useState('');
  const [funnelTestimonials, setFunnelTestimonials] = useState<FunnelTestimonial[]>([
    { quote: '', author: '', context: '' },
  ]);

  // funnel-offer
  const [funnelOffer, setFunnelOffer] = useState<FunnelOffer | null>(null);
  const [offerGenerating, setOfferGenerating] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  // design
  const [brandColors, setBrandColors] = useState<string[]>([DEFAULT_BRAND_COLOR]);
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
    setOffer(''); setServices(['', '', '']); setEnhancing(false); setEnhanceError(null);
    setIntent('book'); setAudience('cold-ad');
    setFunnelService(''); setFunnelCustomerPain(''); setFunnelGuarantee('');
    setFunnelTestimonials([{ quote: '', author: '', context: '' }]);
    setFunnelOffer(null); setOfferGenerating(false); setOfferError(null);
    setBrandColors([DEFAULT_BRAND_COLOR]); setHeadingFont('inter-tight'); setBodyFont('inter-tight');
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

  const runOfferGeneration = async () => {
    setOfferGenerating(true);
    setOfferError(null);
    try {
      const offer = await generateFunnelOffer({
        industry: industry.trim(),
        serviceArea: area.trim(),
        funnelService: funnelService.trim(),
        funnelCustomerPain: funnelCustomerPain.trim(),
        funnelGuarantee: funnelGuarantee.trim(),
      });
      setFunnelOffer(offer);
    } catch (e) {
      setOfferError(
        e instanceof AppError
          ? e.message
          : 'Offer generation failed — try again, or continue and write the offer yourself.',
      );
    } finally {
      setOfferGenerating(false);
    }
  };

  const updateOfferField = (key: keyof FunnelOffer, value: string) =>
    setFunnelOffer((o) => (o ? { ...o, [key]: value } : o));

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
      accentColor: brandColors[0],
      brandColors,
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
    const cleanTestimonials = funnelTestimonials
      .map((t) => ({ quote: t.quote.trim(), author: t.author.trim(), context: t.context.trim() }))
      .filter((t) => t.quote || t.author || t.context);
    const brief: ClientBrief = {
      business,
      industry: industry.trim(),
      brand,
      primaryIntent: { kind: intent },
      audience,
      funnel: {
        service: funnelService.trim(),
        customerPain: funnelCustomerPain.trim(),
        guarantee: funnelGuarantee.trim(),
        testimonials: cleanTestimonials,
        offer: funnelOffer,
      },
    };
    try {
      // Lazy-loaded — keeps the heavy generation + Supabase write graph out
      // of the /clients/new page's static import chain.
      const { createClientWithGeneration } = await import('@/lib/clients/create-client');
      const result = await createClientWithGeneration({ brief, wantWebsite, wantFunnel });
      onOpenChange(false);
      setTimeout(reset, 200);
      router.push(`/clients/new/result?c=${result.clientSlug}`);
    } catch (e) {
      const message =
        e instanceof AppError
          ? e.message
          : 'Generation failed — check you are signed in as an operator, then try again.';
      setError(message);
      setPhase('build');
    }
  };

  const stepIndex = phase === 'generating' ? STEPS.length : STEPS.indexOf(phase as Step);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg" className="max-h-[calc(100vh-4rem)] p-0">
        <DialogTitle className="sr-only">Create a client</DialogTitle>
        <DialogDescription className="sr-only">
          Capture a brief and generate a website and / or funnel for a new client.
        </DialogDescription>

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
              <Field label="Business name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Plumbing"
                  required
                  aria-invalid={!name.trim()}
                />
              </Field>
              <Field label="Trade / industry" required>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Plumbing services"
                  required
                  aria-invalid={!industry.trim()}
                />
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
                <Field label="Service area" required>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Perth metro"
                    required
                    aria-invalid={!area.trim()}
                  />
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
                    disabled={enhancing || !offer.trim()}
                    onClick={async () => {
                      setEnhanceError(null);
                      setEnhancing(true);
                      try {
                        const polished = await enhanceFunnelOfferText({
                          rawText: offer,
                          industry,
                          businessName: name,
                          serviceArea: area,
                        });
                        setOffer(polished);
                      } catch (err) {
                        const msg =
                          err instanceof AppError
                            ? err.message
                            : err instanceof Error
                              ? err.message
                              : 'Offer enhancement failed.';
                        setEnhanceError(msg);
                      } finally {
                        setEnhancing(false);
                      }
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
              {enhanceError ? (
                <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                    Offer enhancement error
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{enhanceError}</p>
                </div>
              ) : null}
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
              <div className="border-t border-paper-2 pt-5">
                <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                  {'// FUNNEL INPUTS'}
                </p>
                <div className="flex flex-col gap-4">
                  <Field label="Which one service is the funnel built around?" required>
                    <Input
                      value={funnelService}
                      onChange={(e) => setFunnelService(e.target.value)}
                      placeholder="Emergency call-out"
                    />
                  </Field>
                  <Field
                    label="What's the moment that makes a customer urgently search for this?"
                    required
                  >
                    <textarea
                      value={funnelCustomerPain}
                      onChange={(e) => setFunnelCustomerPain(e.target.value)}
                      rows={3}
                      placeholder="A burst pipe at 9pm with water across the floor — they need someone on site tonight."
                      className="w-full rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-rust"
                    />
                  </Field>
                  <Field label="What can you confidently promise or guarantee?" required>
                    <Input
                      value={funnelGuarantee}
                      onChange={(e) => setFunnelGuarantee(e.target.value)}
                      placeholder="On site within 2 hours or the callout's free."
                    />
                  </Field>
                  <Field label="Customer testimonials (optional, 2–3)">
                    <div className="flex flex-col gap-3">
                      <p className="text-[11.5px] text-ink-quiet">
                        Leave empty and your funnel renders a clean &ldquo;your reviews will appear
                        here&rdquo; placeholder — we never invent fake testimonials. Real reviews
                        auto-pull once Google Business is connected.
                      </p>
                      {funnelTestimonials.map((t, i) => (
                        <div
                          key={i}
                          className="flex flex-col gap-2 rounded-md border border-rule bg-paper px-3 py-2.5"
                        >
                          <textarea
                            value={t.quote}
                            onChange={(e) =>
                              setFunnelTestimonials((arr) =>
                                arr.map((x, idx) => (idx === i ? { ...x, quote: e.target.value } : x)),
                              )
                            }
                            rows={2}
                            placeholder="Quote — what the customer said"
                            className="w-full rounded-md border border-rule bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-rust"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={t.author}
                              onChange={(e) =>
                                setFunnelTestimonials((arr) =>
                                  arr.map((x, idx) =>
                                    idx === i ? { ...x, author: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Name"
                            />
                            <Input
                              value={t.context}
                              onChange={(e) =>
                                setFunnelTestimonials((arr) =>
                                  arr.map((x, idx) =>
                                    idx === i ? { ...x, context: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Context (suburb, job type)"
                            />
                          </div>
                          {funnelTestimonials.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setFunnelTestimonials((arr) => arr.filter((_, idx) => idx !== i))
                              }
                              className="self-start font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                            >
                              × Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {funnelTestimonials.length < 3 ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setFunnelTestimonials((arr) => [
                              ...arr,
                              { quote: '', author: '', context: '' },
                            ])
                          }
                          className="w-fit"
                        >
                          + Add testimonial
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          ) : null}

          {phase === 'funnel-offer' ? (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-ink-mid">
                We&apos;ll draft a four-field offer from your brief — the headline, promise,
                risk reversal, and CTA that sits at the top of your funnel. Edit anything
                that doesn&apos;t sound like you.
              </p>
              {!funnelOffer && !offerGenerating ? (
                <Button onClick={runOfferGeneration} className="w-fit">
                  ✦ Generate my offer →
                </Button>
              ) : null}
              {offerGenerating ? (
                <div className="flex items-center gap-3 rounded-md border border-rule bg-paper px-4 py-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-rule border-t-rust" />
                  <p className="text-[13px] text-ink">Drafting your offer with Sonnet…</p>
                </div>
              ) : null}
              {offerError ? (
                <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                    Offer generation error
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{offerError}</p>
                </div>
              ) : null}
              {funnelOffer ? (
                <div className="flex flex-col gap-4">
                  <Field label="Headline">
                    <Input
                      value={funnelOffer.headline}
                      onChange={(e) => updateOfferField('headline', e.target.value)}
                    />
                  </Field>
                  <Field label="Promise">
                    <textarea
                      value={funnelOffer.promise}
                      onChange={(e) => updateOfferField('promise', e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-rust"
                    />
                  </Field>
                  <Field label="Risk reversal">
                    <Input
                      value={funnelOffer.riskReversal}
                      onChange={(e) => updateOfferField('riskReversal', e.target.value)}
                    />
                  </Field>
                  <Field label="CTA text">
                    <Input
                      value={funnelOffer.ctaText}
                      onChange={(e) => updateOfferField('ctaText', e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runOfferGeneration}
                    disabled={offerGenerating}
                    className="w-fit"
                  >
                    ✦ Regenerate
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'design' ? (
            <div className="flex flex-col gap-5">
              <Field label="Brand colours">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {brandColors.map((c, i) => (
                      <div key={i} className="relative">
                        <input
                          type="color"
                          value={c}
                          aria-label={
                            i === 0 ? 'Primary brand colour' : `Brand colour ${i + 1}`
                          }
                          onChange={(e) =>
                            setBrandColors((arr) =>
                              arr.map((x, idx) => (idx === i ? e.target.value : x)),
                            )
                          }
                          className="h-11 w-11 cursor-pointer rounded-full border-2 border-rule bg-transparent p-0"
                        />
                        {i > 0 ? (
                          <button
                            type="button"
                            aria-label={`Remove brand colour ${i + 1}`}
                            onClick={() =>
                              setBrandColors((arr) => arr.filter((_, idx) => idx !== i))
                            }
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-bold text-paper"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {brandColors.length < MAX_BRAND_COLORS ? (
                      <button
                        type="button"
                        aria-label="Add brand colour"
                        onClick={() => setBrandColors((arr) => [...arr, DEFAULT_BRAND_COLOR])}
                        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-rule text-[18px] leading-none text-ink-quiet transition-colors hover:border-rust hover:text-rust"
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                    {brandColors.length === 1
                      ? 'Primary brand colour — add up to two more'
                      : 'The first colour is the primary — click any swatch to change it'}
                  </p>
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
              {error ? (
                <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                    Generation error
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
                </div>
              ) : null}
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
    case 'funnel-offer':
      return 'Your funnel offer';
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
  required,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {label}
          {required ? <span className="ml-1 text-rust">*</span> : null}
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
