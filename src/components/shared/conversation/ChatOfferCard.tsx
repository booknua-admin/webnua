'use client';

// =============================================================================
// ChatOfferCard — turn-4 offer iteration UI for the conversational signup.
//
// Visual language matches the GenerationBlueprint: the offer card mounts
// inside a `SpecSheet` ("// YOUR OFFER") so it reads as the architect's
// draft of the funnel offer page. Each row uses the same mono `// LABEL`
// + body vocabulary the blueprint progress sheet uses — every field is
// a labelled spec line, not a chat-bubble factoid.
//
// Two modes:
//   - display — AI-generated offer rendered as a read-only set of spec
//     lines. Actions: Use this (accept), Refine (regenerate; capped at 2
//     per locked decision), Use my own (open editor), Skip (no offer
//     captured).
//   - editor — four editable inputs the customer types their own offer
//     into. Actions: Save (accept the custom offer), Cancel (back to
//     display mode without committing).
//
// State the shell owns (passed in):
//   - offer — the currently-displayed offer (model output or customer
//     edits in flight). null while the first generation is loading.
//   - refinementsUsed — 0/1/2. The shell increments after each Refine
//     call. When it hits OFFER_REFINEMENT_LIMIT (2) the Refine action
//     disappears entirely (per CLAUDE.md locked decision "Show Accept /
//     Use my own / Skip" after cap).
//   - loading — true while either initial generation or a refine call is
//     in flight. Display the loading state inline (action buttons
//     disabled, "Refining…" indicator).
//   - error — optional inline error from the generator (the shell catches
//     AppError from generateFunnelOffer and surfaces it here).
//
// The component does NOT call /api/generate-offer itself — the shell owns
// the call so it can persist conversation_state.offerRefinementsUsed
// alongside each result. ChatOfferCard is pure UI.
//
// Mobile-first: editor fields stack full-width; action row wraps on small
// viewports. 44px tap targets throughout.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OFFER_REFINEMENT_LIMIT } from '@/lib/onboarding/conversation-types';
import type { FunnelOffer } from '@/lib/website/offer-generate';
import { cn } from '@/lib/utils';

import { SpecSheet } from './SpecSheet';

export type ChatOfferCardProps = {
  /** The offer to display. null = the first generation is still in flight
   *  (shell sets `loading: true` in this case). */
  offer: FunnelOffer | null;
  /** Refinements used so far (0 / 1 / 2). At 2, the Refine action hides. */
  refinementsUsed: number;
  /** Either initial generation or a refine call is in flight. */
  loading: boolean;
  /** Optional error from the generator (shell surfaces AppError messages). */
  error?: string | null;
  onAccept: (offer: FunnelOffer) => void;
  /** Shell-side: trigger a new /api/generate-offer call and increment
   *  refinementsUsed. Caller no-ops when refinementsUsed >= 2. */
  onRefine: () => void;
  /** Shell-side: persist the customer's custom-typed offer + advance. */
  onUseMyOwn: (offer: FunnelOffer) => void;
  /** Shell-side: record skipped + advance with offer = null. */
  onSkip: () => void;
};

export function ChatOfferCard({
  offer,
  refinementsUsed,
  loading,
  error,
  onAccept,
  onRefine,
  onUseMyOwn,
  onSkip,
}: ChatOfferCardProps) {
  const [mode, setMode] = useState<'display' | 'editor'>('display');
  const canRefine = refinementsUsed < OFFER_REFINEMENT_LIMIT && !loading;
  const refinementsLabel = (() => {
    if (refinementsUsed === 0) return null;
    if (refinementsUsed === 1) return '1 refinement used · 1 left';
    return 'Max refinements reached';
  })();

  if (mode === 'editor') {
    return (
      <SpecSheet label="// YOUR OFFER" hint="offer / editing">
        <OfferEditor
          seed={offer}
          onSave={(o) => {
            onUseMyOwn(o);
          }}
          onCancel={() => setMode('display')}
          disabled={loading}
        />
      </SpecSheet>
    );
  }

  // display mode
  return (
    <SpecSheet label="// YOUR OFFER" hint="offer.json">
      <div className="flex flex-col gap-3">
        <p className="text-[12px] leading-[1.4] text-ink-mid">
          Here&apos;s a draft offer for your funnel. Keep it, refine it, or write
          your own.
        </p>

        <div
          className={cn(
            'rounded-md border-2 border-ink/15 bg-paper/60 px-4 py-3.5',
            loading && 'opacity-60',
          )}
          aria-busy={loading}
        >
          {offer ? (
            <>
              <OfferRow label="// HEADLINE" value={offer.headline} />
              <OfferRow label="// PROMISE" value={offer.promise} />
              <OfferRow label="// RISK REVERSAL" value={offer.riskReversal} />
              <OfferRow label="// CTA" value={offer.ctaText} mono />
            </>
          ) : (
            <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-ink-quiet">
              {loading ? 'Drafting your offer…' : 'No offer yet.'}
            </p>
          )}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] text-warn">
            {error}
          </p>
        ) : null}

        {refinementsLabel ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {refinementsLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          <Button
            type="button"
            onClick={() => offer && onAccept(offer)}
            disabled={!offer || loading}
            className="min-h-[44px]"
          >
            {loading && offer ? 'Refining…' : 'Use this offer →'}
          </Button>
          {canRefine ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onRefine}
              disabled={loading}
              className="min-h-[44px]"
            >
              ✦ Refine
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode('editor')}
            disabled={loading}
            className="min-h-[44px]"
          >
            Use my own
          </Button>
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="ml-auto min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet hover:text-ink disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    </SpecSheet>
  );
}

// ---------------------------------------------------------------------------

function OfferRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-ink/10 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      <div className={cn('mt-1 text-[14px] leading-[1.45] text-ink', mono && 'font-mono')}>
        {value}
      </div>
    </div>
  );
}

function OfferEditor({
  seed,
  onSave,
  onCancel,
  disabled,
}: {
  seed: FunnelOffer | null;
  onSave: (offer: FunnelOffer) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [headline, setHeadline] = useState(seed?.headline ?? '');
  const [promise, setPromise] = useState(seed?.promise ?? '');
  const [riskReversal, setRiskReversal] = useState(seed?.riskReversal ?? '');
  const [ctaText, setCtaText] = useState(seed?.ctaText ?? '');

  const canSave =
    !disabled &&
    headline.trim().length > 0 &&
    promise.trim().length > 0 &&
    riskReversal.trim().length > 0 &&
    ctaText.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      headline: headline.trim(),
      promise: promise.trim(),
      riskReversal: riskReversal.trim(),
      ctaText: ctaText.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-[1.4] text-ink-mid">
        Write your own offer. Each field is shown back to your customer.
      </p>

      <div className="flex flex-col gap-3">
        <EditorField label="// HEADLINE" hint="≤ 12 words. Name the pain, promise the outcome.">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Switchboard sparking? We have it sorted in 24 hours."
            disabled={disabled}
            className="min-h-[44px] text-base sm:text-[14px]"
          />
        </EditorField>
        <EditorField label="// PROMISE" hint="≤ 25 words. Specific timeframe or outcome.">
          <Textarea
            value={promise}
            onChange={(e) => setPromise(e.target.value)}
            placeholder="e.g. We diagnose, repair and certify your switchboard within 24 hours of your call — fully tested, fully compliant."
            disabled={disabled}
            rows={2}
            className="text-base sm:text-[14px]"
          />
        </EditorField>
        <EditorField label="// RISK REVERSAL" hint="≤ 15 words. A concrete guarantee.">
          <Input
            value={riskReversal}
            onChange={(e) => setRiskReversal(e.target.value)}
            placeholder="e.g. Or your callout fee is on us."
            disabled={disabled}
            className="min-h-[44px] text-base sm:text-[14px]"
          />
        </EditorField>
        <EditorField label="// CTA" hint="≤ 6 words. First-person, action-led.">
          <Input
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="e.g. Get my switchboard sorted →"
            disabled={disabled}
            className="min-h-[44px] text-base sm:text-[14px]"
          />
        </EditorField>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="min-h-[44px]"
        >
          Save offer →
        </Button>
      </div>
    </div>
  );
}

function EditorField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {label}
        </label>
        <span className="font-mono text-[10px] text-ink-quiet">{hint}</span>
      </div>
      {children}
    </div>
  );
}
