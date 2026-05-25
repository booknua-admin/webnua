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

import { GenerationSplash } from '@/components/admin/GenerationSplash';
import { EnhanceableTextarea } from '@/components/shared/EnhanceableTextarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppError } from '@/lib/errors';
import { resolveIndustryKnowledge } from '@/lib/onboarding/industry-knowledge';
import { cn } from '@/lib/utils';
import { enhanceField } from '@/lib/website/field-enhance';
import {
  AUDIENCE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  type Audience,
  type BusinessDetails,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import { CURATED_FONTS } from '@/lib/website/google-fonts';
import { enhanceFunnelOfferText, generateFunnelOffer, type FunnelOffer } from '@/lib/website/offer-generate';
import type {
  ClientBrief,
  FunnelTestimonial,
  IndustryKnowledge,
} from '@/lib/website/site-generation-stub';
import { uploadSectionImage } from '@/lib/website/upload-image';
import { VOICE_TONE_PRESETS, type BrandObject } from '@/lib/website/types';

type Step = 'business' | 'offer' | 'brief' | 'funnel-offer' | 'design' | 'build' | 'review';
const STEPS: Step[] = ['business', 'offer', 'brief', 'funnel-offer', 'design', 'build', 'review'];

// Short label per step — used in the header chip and as the "Edit" target
// label on the review summary.
const STEP_SHORT_LABEL: Record<Step, string> = {
  business: 'Business',
  offer: 'Offer',
  brief: 'Brief',
  'funnel-offer': 'Funnel offer',
  design: 'Design',
  build: 'Build',
  review: 'Review',
};

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
  // Conditional disclosure — the testimonial inputs only mount when the user
  // confirms they have real reviews to provide. Default closed so the brief
  // step stays short for the common case (no testimonials yet → funnel
  // renders the "your reviews will appear here" placeholder).
  const [hasTestimonials, setHasTestimonials] = useState(false);

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

  // Industry knowledge — closes the conversational/concierge parity gap.
  // The conversational path fires resolveIndustryKnowledge after the
  // business-name turn and threads the result into every downstream prompt
  // (site/funnel/offer). The concierge path didn't, so unmapped industries
  // generated against template defaults only. We kick off the same fetch
  // when the user clicks Continue out of the business step (industry +
  // area are settled by then) and hold the in-flight promise on a ref;
  // runGeneration awaits it with a short timeout fallback so a slow / down
  // route never blocks the generate path. The resolver itself always
  // returns a usable shape, so the only way industryKnowledge ends up
  // null on the brief is the timeout — same field is optional on the
  // ClientBrief, so both paths handle absence cleanly.
  const industryKnowledgePromise = useRef<Promise<IndustryKnowledge | null> | null>(null);

  const kickoffIndustryKnowledge = () => {
    if (industryKnowledgePromise.current) return;
    if (!industry.trim() || !name.trim()) return;
    industryKnowledgePromise.current = resolveIndustryKnowledge({
      industry: industry.trim(),
      location: area.trim() || undefined,
      businessName: name.trim(),
    }).catch((e) => {
      console.warn('[create-client] industry-knowledge fetch failed', e);
      return null;
    });
  };

  const reset = () => {
    setPhase('business');
    setName(''); setIndustry(''); setOwnerName(''); setPhone(''); setEmail(''); setArea('');
    setOffer(''); setServices(['', '', '']);
    setIntent('book'); setAudience('cold-ad');
    setFunnelService(''); setFunnelCustomerPain(''); setFunnelGuarantee('');
    setFunnelTestimonials([{ quote: '', author: '', context: '' }]);
    setHasTestimonials(false);
    setFunnelOffer(null); setOfferGenerating(false); setOfferError(null);
    setBrandColors([DEFAULT_BRAND_COLOR]); setHeadingFont('inter-tight'); setBodyFont('inter-tight');
    setLogoUrl(''); setLogoUploading(false);
    setWantWebsite(true); setWantFunnel(true); setError(null);
    industryKnowledgePromise.current = null;
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
    // Defensive — if the user advanced through the steps fast enough that
    // the kickoff didn't fire (or never settled), try once more here. By
    // the time we hit runGeneration the user has clicked Continue multiple
    // times so the kickoff should already have fired; this is the safety net.
    kickoffIndustryKnowledge();
    // Await the in-flight knowledge promise with a 8s ceiling — the user's
    // already on the generation splash, and industry-knowledge typically
    // resolves in 2-4s. If it overruns, we ship without it; the brief
    // field is optional and the generator handles absence cleanly.
    const industryKnowledge = industryKnowledgePromise.current
      ? await Promise.race<IndustryKnowledge | null>([
          industryKnowledgePromise.current,
          new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
        ])
      : null;
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
      ...(industryKnowledge ? { industryKnowledge } : {}),
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
      // Land back on review (where Generate was pressed) so the user sees the
      // error inline alongside their answers and can adjust before retrying.
      setPhase('review');
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
        <div className="border-b border-paper-2 px-4 pb-5 pt-5 md:px-8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
              {'// NEW CLIENT'}
            </p>
            {phase !== 'generating' ? (
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Step {stepIndex + 1} of {STEPS.length} · {STEP_SHORT_LABEL[phase as Step]}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-[20px] font-bold tracking-[-0.01em] text-ink">
            {phaseTitle(phase)}
          </p>
          {phase !== 'generating' ? (
            <div
              className="mt-3.5 flex gap-1"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors duration-300',
                    i <= stepIndex ? 'bg-rust' : 'bg-paper-2',
                  )}
                  aria-hidden
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* body */}
        <div className="max-h-[58vh] overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        {/* key={phase} remounts the inner block on each step so the
            tailwindcss-animate fade-in plays. Calm 180ms duration — no
            distance/slide, just opacity. */}
        <div key={phase} className="animate-in fade-in-0 duration-200">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Owner name">
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Jane Smith" />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Field label="Your offer">
                <EnhanceableTextarea
                  value={offer}
                  onChange={setOffer}
                  rows={4}
                  placeholder="Describe what you do and what makes you different — rough notes are fine, AI will polish them."
                  enhance={(current) =>
                    enhanceFunnelOfferText({
                      rawText: current,
                      industry,
                      businessName: name,
                      serviceArea: area,
                    })
                  }
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
                    <EnhanceableTextarea
                      value={funnelCustomerPain}
                      onChange={setFunnelCustomerPain}
                      rows={3}
                      placeholder="A burst pipe at 9pm with water across the floor — they need someone on site tonight."
                      enhance={(current) =>
                        enhanceField({
                          fieldName: 'funnel_customer_pain',
                          currentValue: current,
                          briefContext: {
                            businessName: name,
                            industry,
                            serviceArea: area,
                            funnelService,
                          },
                        })
                      }
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
                      <div className="flex flex-wrap gap-2">
                        <TestimonialChoiceChip
                          active={!hasTestimonials}
                          onClick={() => setHasTestimonials(false)}
                          label="Not yet"
                        />
                        <TestimonialChoiceChip
                          active={hasTestimonials}
                          onClick={() => setHasTestimonials(true)}
                          label="Yes, I have some"
                        />
                      </div>
                      <p className="text-[11.5px] text-ink-quiet">
                        {hasTestimonials
                          ? 'Drop 1–3 real customer quotes in below. We never invent testimonials — paste only what they actually said.'
                          : 'Your funnel renders a clean "your reviews will appear here" placeholder — real reviews auto-pull once Google Business is connected.'}
                      </p>
                      {hasTestimonials ? (
                        <div className="flex flex-col gap-3 animate-in fade-in-0 duration-200">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          ) : null}

          {phase === 'review' ? (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-ink-mid">
                Quick check before we build. Click <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-rust">Edit</span> on any section to adjust — everything is editable later too.
              </p>
              <ReviewSection title="Business" onEdit={() => setPhase('business')}>
                <ReviewRow label="Business" value={name} />
                <ReviewRow label="Trade" value={industry} />
                <ReviewRow label="Service area" value={area} />
                {ownerName ? <ReviewRow label="Owner" value={ownerName} /> : null}
                {phone || email ? (
                  <ReviewRow
                    label="Contact"
                    value={[phone, email].filter(Boolean).join(' · ')}
                  />
                ) : null}
              </ReviewSection>
              <ReviewSection title="Offer" onEdit={() => setPhase('offer')}>
                <ReviewRow label="Pitch" value={offer || '—'} />
                {services.some((s) => s.trim()) ? (
                  <ReviewRow
                    label="Services"
                    value={services.filter((s) => s.trim()).join(', ')}
                  />
                ) : null}
              </ReviewSection>
              <ReviewSection title="Brief" onEdit={() => setPhase('brief')}>
                <ReviewRow
                  label="Visitor intent"
                  value={INTENT_OPTIONS.find((o) => o.id === intent)?.label ?? intent}
                />
                <ReviewRow
                  label="Audience"
                  value={AUDIENCE_CHIPS.find((o) => o.id === audience)?.label ?? audience}
                />
                {funnelService ? <ReviewRow label="Funnel service" value={funnelService} /> : null}
                {funnelCustomerPain ? (
                  <ReviewRow label="Pain moment" value={funnelCustomerPain} />
                ) : null}
                {funnelGuarantee ? <ReviewRow label="Guarantee" value={funnelGuarantee} /> : null}
                <ReviewRow
                  label="Testimonials"
                  value={
                    hasTestimonials && funnelTestimonials.some((t) => t.quote.trim())
                      ? `${funnelTestimonials.filter((t) => t.quote.trim()).length} provided`
                      : 'None yet — placeholder on the live funnel'
                  }
                />
              </ReviewSection>
              {funnelOffer ? (
                <ReviewSection title="Funnel offer" onEdit={() => setPhase('funnel-offer')}>
                  <ReviewRow label="Headline" value={funnelOffer.headline} />
                  <ReviewRow label="Promise" value={funnelOffer.promise} />
                  <ReviewRow label="Risk reversal" value={funnelOffer.riskReversal} />
                  <ReviewRow label="CTA" value={funnelOffer.ctaText} />
                </ReviewSection>
              ) : (
                <ReviewSection title="Funnel offer" onEdit={() => setPhase('funnel-offer')}>
                  <ReviewRow label="Status" value="Not generated — funnel will use a default" />
                </ReviewSection>
              )}
              <ReviewSection title="Design" onEdit={() => setPhase('design')}>
                <ReviewRow
                  label="Brand colours"
                  value={
                    <span className="flex flex-wrap items-center gap-1.5">
                      {brandColors.map((c, i) => (
                        <span
                          key={i}
                          className="inline-block h-4 w-4 rounded-full border border-rule"
                          style={{ backgroundColor: c }}
                          aria-label={`Brand colour ${i + 1}: ${c}`}
                        />
                      ))}
                      <span className="ml-1 font-mono text-[11px] text-ink-quiet">
                        {brandColors.join(' · ')}
                      </span>
                    </span>
                  }
                />
                <ReviewRow label="Heading font" value={headingFont} />
                <ReviewRow label="Body font" value={bodyFont} />
                {logoUrl ? <ReviewRow label="Logo" value="Uploaded ✓" /> : null}
              </ReviewSection>
              <ReviewSection title="Build" onEdit={() => setPhase('build')}>
                <ReviewRow
                  label="Generating"
                  value={
                    [wantWebsite && 'Website', wantFunnel && 'Funnel']
                      .filter(Boolean)
                      .join(' + ') || 'Nothing selected'
                  }
                />
              </ReviewSection>
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
            <GenerationSplash
              what={
                [wantWebsite && 'a website', wantFunnel && 'a funnel']
                  .filter(Boolean)
                  .join(' + ') || 'your draft'
              }
            />
          ) : null}
        </div>
        </div>

        {/* footer */}
        {phase !== 'generating' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-2 bg-paper px-4 py-4 md:px-8">
            <Button variant="ghost" onClick={() => goBack(phase, setPhase, () => close(false))}>
              {phase === 'business' ? 'Cancel' : '← Back'}
            </Button>
            {phase === 'review' ? (
              <Button
                size="lg"
                onClick={runGeneration}
                disabled={!wantWebsite && !wantFunnel}
              >
                ✦ Generate my site →
              </Button>
            ) : (
              <Button
                onClick={() => {
                  // Kick off industry-knowledge in the background the
                  // moment the operator leaves the business step. By the
                  // time runGeneration awaits the promise (3+ steps
                  // later) it's almost always resolved.
                  if (phase === 'business') kickoffIndustryKnowledge();
                  setPhase(STEPS[STEPS.indexOf(phase as Step) + 1]);
                }}
                disabled={
                  (phase === 'business' && !businessValid) ||
                  (phase === 'build' && !wantWebsite && !wantFunnel)
                }
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
    case 'review':
      return 'Final check';
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

// Review-step helpers — small enough to live alongside the modal rather than
// extracted; only consumer is the review phase above.
function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-rule bg-paper px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
          {`// ${title}`}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-rust"
        >
          Edit ✎
        </button>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
      <span className="text-[13px] text-ink">{value || <span className="text-ink-quiet">—</span>}</span>
    </div>
  );
}

function TestimonialChoiceChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
        active
          ? 'border-rust bg-rust text-paper'
          : 'border-rule bg-card text-ink-mid hover:border-rust/60',
      )}
    >
      {label}
    </button>
  );
}
