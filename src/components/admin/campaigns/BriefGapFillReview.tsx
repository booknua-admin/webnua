'use client';

// =============================================================================
// BriefGapFillReview — AI-proposed gap-fills, edited + confirmed in one pass.
//
// Phase 7.5 · Session 2.2 polish. Replaces the multi-turn chat. When the
// brief has soft-block gaps, one Webnua AI call proposes a value + a
// rationale for every missing field; the operator reviews them all on
// this screen, edits anything they want to override, then clicks "Use
// these →" to save in parallel and auto-fire generation.
//
// Why one screen, not a chat:
//   • Onboarding already captured most context — chat asking N
//     questions repeats what the operator just typed.
//   • One AI call beats N AI calls in cost + latency.
//   • Operator sees everything at once and accepts/edits in 5 seconds.
//
// Mount: REPLACES the Generate surface's idle state in-place (same
// shape as the prior chat). Cancel returns to idle with no changes
// saved; "Use these →" persists every card's CURRENT value (edited or
// proposed-as-is) then fires generation.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  saveBriefAnswer,
  type BriefAnswerInput,
} from '@/lib/campaigns/brief-update';
import type { BriefField } from '@/lib/campaigns/brief-completeness';
import {
  proposeBriefFills,
  type BriefFillProposal,
} from '@/lib/integrations/meta-ads/propose-brief-fills';
import { cn } from '@/lib/utils';

// --- props ------------------------------------------------------------------

export type BriefGapFillReviewProps = {
  clientId: string;
  clientName: string;
  missing: readonly BriefField[];
  /** Fires after every card has saved. Parent auto-fires generation. */
  onComplete: () => void;
  /** Fires when the operator backs out — no fields are saved. */
  onCancel: () => void;
};

// --- field metadata --------------------------------------------------------

const FIELD_LABEL: Record<BriefField, string> = {
  offer: 'Your offer',
  audience_line: 'Who you want more of',
  services: 'Top services',
  accent_color: 'Brand colour',
};

const FIELD_SUB: Record<BriefField, string> = {
  offer: 'One line — the promise the ad makes.',
  audience_line: 'One sentence — the customer you want more of.',
  services: 'Comma-separated. The AI uses these as the ad’s service hook.',
  accent_color: 'Hex colour. Appears on buttons + highlights.',
};

// --- main component --------------------------------------------------------

type Phase =
  | { kind: 'loading' }
  | { kind: 'review'; proposals: BriefFillProposal[] }
  | { kind: 'saving'; proposals: BriefFillProposal[] }
  | { kind: 'failed'; error: string };

export function BriefGapFillReview({
  clientId,
  clientName,
  missing,
  onComplete,
  onCancel,
}: BriefGapFillReviewProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [edits, setEdits] = useState<Record<BriefField, string>>(
    {} as Record<BriefField, string>,
  );

  // Propose on mount — one Webnua AI call returns one proposal per
  // missing field. The route guarantees one entry per field in the
  // missing list (it falls back when the model skips one), so the
  // review screen ALWAYS has every gap covered.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const proposals = await proposeBriefFills(clientId, missing);
        if (cancelled) return;
        const seed: Partial<Record<BriefField, string>> = {};
        for (const p of proposals) {
          seed[p.field] = p.proposed;
        }
        setEdits(seed as Record<BriefField, string>);
        setPhase({ kind: 'review', proposals });
      } catch (error) {
        if (cancelled) return;
        setPhase({
          kind: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Could not propose fills — try again or use the classic builder.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, missing]);

  function handleEdit(field: BriefField, value: string) {
    setEdits((prev) => ({ ...prev, [field]: value }));
  }

  /** Persist every card's current value, then fire onComplete. Errors
   *  on any one field abort + surface the message inline so the
   *  operator can fix and retry. */
  async function handleConfirm() {
    if (phase.kind !== 'review') return;
    setPhase({ kind: 'saving', proposals: phase.proposals });
    try {
      for (const proposal of phase.proposals) {
        const value = edits[proposal.field] ?? proposal.proposed;
        const answer = toAnswer(proposal.field, value);
        if (!answer) continue;
        await saveBriefAnswer(clientId, answer);
      }
      onComplete();
    } catch (error) {
      setPhase({
        kind: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Saving one of the answers failed — try again.',
      });
    }
  }

  // --- render -------------------------------------------------------------

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-rule bg-card px-5 py-5 md:px-8 md:py-8">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// FILL THE GAPS · ONE SCREEN'}
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight text-ink md:text-[22px]">
          A few details for {clientName}
        </h2>
        <p className="max-w-2xl text-[13px] leading-snug text-ink-soft">
          We drafted these from what&rsquo;s already on your brand profile. Tweak
          anything that doesn&rsquo;t fit, then click <strong className="font-semibold text-ink">Use these</strong>.
          Each answer saves to your profile so we never ask again.
        </p>
      </header>

      {phase.kind === 'loading' && (
        <LoadingState
          missing={missing.length}
          onCancel={onCancel}
        />
      )}

      {phase.kind === 'failed' && (
        <FailedState
          error={phase.error}
          onRetry={() => setPhase({ kind: 'loading' })}
          onCancel={onCancel}
        />
      )}

      {(phase.kind === 'review' || phase.kind === 'saving') && (
        <>
          <div className="flex flex-col gap-3">
            {phase.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.field}
                proposal={proposal}
                value={edits[proposal.field] ?? proposal.proposed}
                disabled={phase.kind === 'saving'}
                onChange={(value) => handleEdit(proposal.field, value)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-paper-2 pt-4">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={phase.kind === 'saving'}
              className="h-11 px-6 text-[14px] font-semibold"
            >
              {phase.kind === 'saving' ? 'Saving…' : 'Use these →'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={phase.kind === 'saving'}
            >
              Back to Generate
            </Button>
            <Link
              href="/settings/brand"
              className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline"
            >
              Edit your full brand profile →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

// --- sub-components --------------------------------------------------------

function ProposalCard({
  proposal,
  value,
  disabled,
  onChange,
}: {
  proposal: BriefFillProposal;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-rule bg-paper/40 px-4 py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {`// ${FIELD_LABEL[proposal.field]}`}
          </span>
          <span className="text-[11px] leading-snug text-ink-quiet">
            {FIELD_SUB[proposal.field]}
          </span>
        </div>
      </div>

      <ProposalInput
        field={proposal.field}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />

      {proposal.rationale ? (
        <p className="mt-2 text-[11px] italic leading-snug text-ink-quiet">
          {proposal.rationale}
        </p>
      ) : null}
    </div>
  );
}

function ProposalInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: BriefField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (field === 'accent_color') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={normaliseHex(value) ?? '#d24317'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-14 cursor-pointer rounded-md border border-rule bg-paper/40 p-0 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Pick brand colour"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={9}
          className="h-10 max-w-[140px] font-mono text-[13px]"
          aria-label="Hex value"
        />
      </div>
    );
  }
  if (field === 'offer' || field === 'audience_line') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className={cn('min-h-[68px] text-[14px]')}
        aria-label={FIELD_LABEL[field]}
      />
    );
  }
  // services — comma-separated, single line typically
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={FIELD_LABEL[field]}
    />
  );
}

function LoadingState({
  missing,
  onCancel,
}: {
  missing: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md bg-paper/40 px-4 py-5">
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-rust/20 border-t-rust"
          aria-hidden
        />
        <span className="text-[13px] font-medium text-ink">
          Drafting {missing} suggestion{missing === 1 ? '' : 's'}…
        </span>
      </div>
      <p className="text-[12px] leading-snug text-ink-quiet">
        Reading your brand profile, services, and published site — proposing
        fills you can edit in a second.
      </p>
      <Button type="button" variant="ghost" onClick={onCancel} className="mt-1">
        Cancel
      </Button>
    </div>
  );
}

function FailedState({
  error,
  onRetry,
  onCancel,
}: {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn-soft/40 px-4 py-3">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
        {'// COULD NOT DRAFT FILLS'}
      </div>
      <p className="text-[13px] leading-snug text-ink">{error}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" onClick={onRetry} className="h-9">
          Try again
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="h-9">
          Back to Generate
        </Button>
      </div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

/** Convert a card's CURRENT value back into the BriefAnswerInput shape
 *  saveBriefAnswer expects. Empty strings → skip (the chat allows
 *  this; the operator deleted the proposal entirely). */
function toAnswer(field: BriefField, raw: string): BriefAnswerInput | null {
  const value = raw.trim();
  if (value.length === 0) return null;
  if (field === 'accent_color') {
    const hex = normaliseHex(value);
    if (!hex) return null;
    return { field: 'accent_color', hex };
  }
  if (field === 'offer') return { field: 'offer', text: value };
  if (field === 'audience_line') return { field: 'audience_line', text: value };
  if (field === 'services') return { field: 'services', text: value };
  return null;
}

function normaliseHex(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed) && !/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return null;
  }
  if (trimmed.length === 3) {
    return `#${trimmed
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase();
  }
  return `#${trimmed.toLowerCase()}`;
}
