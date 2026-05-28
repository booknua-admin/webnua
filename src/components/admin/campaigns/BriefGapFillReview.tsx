'use client';

// =============================================================================
// BriefGapFillReview — chat-shaped, AI-proposed gap-fill review.
//
// Phase 7.5 · Session 2.2 polish (v2). Visual language is the chat
// (ChatBubble + composer) — same as conversational onboarding — but
// the substance is ONE Webnua AI call upfront that proposes a value
// for every missing field, then the chat walks through each in turn:
//
//   • Bot: "For your offer, I'd suggest: 'Same-day fixed-price quotes,
//          fully licensed local electrician.' Hit Send to use this, or
//          type your own."
//   • Composer is PRE-FILLED with the proposal — operator can hit Enter
//          to accept, or edit + send.
//   • Persist on send → next bubble for the next field → … → auto-fire
//          generation.
//
// One model call. N persistence writes (one per accepted field). The
// operator sees a chat AND avoids re-typing answers the model can draft
// from existing brand context.
//
// Mount: REPLACES the Generate surface's idle state in-place. Cancel
// returns to idle with whatever fields the operator already accepted
// in-flight persisted (mirrors the prior chat's behaviour).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';

import { ChatBubble } from '@/components/shared/conversation/ChatBubble';
import { TypingIndicator } from '@/components/shared/conversation/TypingIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  saveBriefAnswer,
  sortChatFields,
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
  /** Fires after every accepted answer has saved. Parent auto-fires
   *  generation. */
  onComplete: () => void;
  /** Fires when the operator backs out — answers already accepted stay
   *  persisted; in-flight answer is discarded. */
  onCancel: () => void;
};

// --- field metadata --------------------------------------------------------

const FIELD_LABEL: Record<BriefField, string> = {
  offer: 'your offer',
  audience_line: 'your ideal customer',
  services: 'your top services',
  accent_color: 'your brand colour',
};

const FIELD_QUESTION: Record<BriefField, string> = {
  offer:
    'For **your offer** — the promise the ad makes — I would draft:',
  audience_line:
    'For **the customer you want more of** I would draft:',
  services:
    'For **your top services** I would list:',
  accent_color:
    'For **your brand colour** I would pick:',
};

const ACCEPT_HINT: Record<BriefField, string> = {
  offer: "Hit Send to use this, or edit it and Send your version.",
  audience_line: "Hit Send to use this, or edit it and Send your version.",
  services: "Hit Send to use this, or edit and Send.",
  accent_color: 'Hit Send to use this colour, or paste your own hex.',
};

// --- log entry shape -------------------------------------------------------

type LogEntry =
  | { kind: 'bot-greeting'; id: string; clientName: string; gapCount: number }
  | {
      kind: 'bot-proposal';
      id: string;
      field: BriefField;
      proposed: string;
      rationale: string;
    }
  | { kind: 'bot-typing'; id: string }
  | { kind: 'user'; id: string; text: string }
  | { kind: 'bot-done'; id: string };

// --- main component --------------------------------------------------------

type Phase =
  | { kind: 'loading' }
  | { kind: 'chat'; proposals: BriefFillProposal[]; stepIndex: number }
  | { kind: 'failed'; error: string };

export function BriefGapFillReview({
  clientId,
  clientName,
  missing,
  onComplete,
  onCancel,
}: BriefGapFillReviewProps) {
  const orderedMissing = useMemo(
    () => sortChatFields(missing),
    [missing],
  );

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [composerValue, setComposerValue] = useState<string>('');
  const [pending, setPending] = useState<boolean>(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Auto-scroll the message stream to the bottom on every log change.
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    streamRef.current?.scrollTo({
      top: streamRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [log]);

  // One-shot mount effect — runs propose + seeds the log + opens the
  // first proposal bubble. The model call happens here so the chat
  // does not flicker through a loading splash inside the bubble.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    (async () => {
      try {
        const proposals = await proposeBriefFills(clientId, orderedMissing);
        // The route guarantees one proposal per missing field (it
        // falls back when the model skips one), but defence in depth:
        // if anything is missing, build it from the field defaults.
        const proposalsByField = new Map(proposals.map((p) => [p.field, p]));
        const orderedProposals: BriefFillProposal[] = orderedMissing.map(
          (f) =>
            proposalsByField.get(f) ?? {
              field: f,
              proposed: '',
              rationale: '',
            },
        );

        setLog([
          {
            kind: 'bot-greeting',
            id: 'g',
            clientName,
            gapCount: orderedMissing.length,
          },
          {
            kind: 'bot-proposal',
            id: makeProposalId(0),
            field: orderedProposals[0].field,
            proposed: orderedProposals[0].proposed,
            rationale: orderedProposals[0].rationale,
          },
        ]);
        setComposerValue(orderedProposals[0].proposed);
        setPhase({ kind: 'chat', proposals: orderedProposals, stepIndex: 0 });
      } catch (error) {
        setPhase({
          kind: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Could not propose fills — try again or use the classic builder.',
        });
      }
    })();
  }, [clientId, orderedMissing, clientName]);

  // --- send / advance -----------------------------------------------------

  async function handleSend(rawValue?: string) {
    if (phase.kind !== 'chat') return;
    const value = (rawValue ?? composerValue).trim();
    if (value.length === 0) {
      setInlineError('Type a value or paste the suggestion.');
      return;
    }
    const proposal = phase.proposals[phase.stepIndex];
    const answer = toAnswer(proposal.field, value);
    if (!answer) {
      setInlineError(
        proposal.field === 'accent_color'
          ? 'That doesn’t look like a hex colour — try #rrggbb.'
          : 'That value couldn’t be saved — try again.',
      );
      return;
    }
    setInlineError(null);
    setPending(true);

    setLog((prev) => [
      ...prev,
      { kind: 'user', id: makeUserId(phase.stepIndex), text: value },
      { kind: 'bot-typing', id: `t-${phase.stepIndex}` },
    ]);

    try {
      await saveBriefAnswer(clientId, answer);
    } catch (error) {
      setLog((prev) => prev.filter((e) => e.id !== `t-${phase.stepIndex}`));
      setInlineError(
        error instanceof Error
          ? error.message
          : 'Saving that failed — try again.',
      );
      setPending(false);
      return;
    }

    const nextIndex = phase.stepIndex + 1;
    setLog((prev) => {
      const withoutTyping = prev.filter(
        (e) => e.id !== `t-${phase.stepIndex}`,
      );
      if (nextIndex >= phase.proposals.length) {
        return [
          ...withoutTyping,
          { kind: 'bot-done', id: 'done' },
        ];
      }
      const nextProposal = phase.proposals[nextIndex];
      return [
        ...withoutTyping,
        {
          kind: 'bot-proposal',
          id: makeProposalId(nextIndex),
          field: nextProposal.field,
          proposed: nextProposal.proposed,
          rationale: nextProposal.rationale,
        },
      ];
    });

    setPhase({ ...phase, stepIndex: nextIndex });
    setComposerValue(
      nextIndex < phase.proposals.length
        ? phase.proposals[nextIndex].proposed
        : '',
    );
    setPending(false);

    if (nextIndex >= phase.proposals.length) {
      // Brief beat so the operator sees the "done" line before the
      // generation splash takes over.
      setTimeout(onComplete, 900);
    }
  }

  function handleRevertToProposed() {
    if (phase.kind !== 'chat') return;
    const proposal = phase.proposals[phase.stepIndex];
    setComposerValue(proposal.proposed);
    setInlineError(null);
  }

  // --- render -------------------------------------------------------------

  const currentField =
    phase.kind === 'chat' ? phase.proposals[phase.stepIndex]?.field : null;
  const currentProposal =
    phase.kind === 'chat' ? phase.proposals[phase.stepIndex] : null;
  const totalSteps = phase.kind === 'chat' ? phase.proposals.length : missing.length;
  const stepNumber =
    phase.kind === 'chat'
      ? Math.min(phase.stepIndex + 1, Math.max(1, totalSteps))
      : 1;

  return (
    <div className="flex min-h-[480px] flex-col gap-0 overflow-hidden rounded-2xl border border-rule bg-card">
      <Header
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        onCancel={onCancel}
      />
      <div
        ref={streamRef}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {phase.kind === 'loading' ? (
            <LoadingBubble missing={missing.length} clientName={clientName} />
          ) : null}

          {phase.kind === 'failed' ? (
            <FailedBubble error={phase.error} onCancel={onCancel} />
          ) : null}

          {log.map((entry) => (
            <LogEntryView key={entry.id} entry={entry} />
          ))}

          {inlineError ? <InlineErrorBanner message={inlineError} /> : null}
        </div>
      </div>

      {phase.kind === 'chat' && currentField && currentProposal ? (
        <ProposalComposer
          field={currentField}
          value={composerValue}
          proposed={currentProposal.proposed}
          disabled={pending}
          onChange={setComposerValue}
          onSend={() => handleSend()}
          onRevertToProposed={handleRevertToProposed}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

// --- sub-components --------------------------------------------------------

function Header({
  stepNumber,
  totalSteps,
  onCancel,
}: {
  stepNumber: number;
  totalSteps: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b-2 border-ink/10 bg-paper-2 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// FILL THE GAPS'}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Step {stepNumber} of {totalSteps}
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

function LogEntryView({ entry }: { entry: LogEntry }) {
  switch (entry.kind) {
    case 'bot-greeting':
      return (
        <ChatBubble author="bot">
          Looking at <strong className="font-semibold">{entry.clientName}</strong>.
          I&rsquo;ve drafted {entry.gapCount} suggestion
          {entry.gapCount === 1 ? '' : 's'} from your brand profile — accept or
          tweak each one in five seconds.
        </ChatBubble>
      );
    case 'bot-proposal':
      return (
        <ChatBubble author="bot">
          <span>{renderInlineMarkdown(FIELD_QUESTION[entry.field])}</span>
          <div className="mt-2 rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] leading-snug text-ink">
            {entry.proposed.length > 0 ? (
              <ProposalDisplay field={entry.field} value={entry.proposed} />
            ) : (
              <span className="italic text-ink-quiet">(no suggestion — type your own)</span>
            )}
          </div>
          {entry.rationale ? (
            <p className="mt-2 text-[12px] italic leading-snug text-ink-quiet">
              {entry.rationale}
            </p>
          ) : null}
        </ChatBubble>
      );
    case 'bot-typing':
      return (
        <ChatBubble author="bot">
          <TypingIndicator />
        </ChatBubble>
      );
    case 'user':
      return <ChatBubble author="user">{entry.text}</ChatBubble>;
    case 'bot-done':
      return (
        <ChatBubble author="bot">All set. Drafting your ads now.</ChatBubble>
      );
  }
}

function ProposalDisplay({
  field,
  value,
}: {
  field: BriefField;
  value: string;
}) {
  if (field === 'accent_color') {
    return (
      <span className="inline-flex items-center gap-2 font-mono">
        <span
          className="h-4 w-4 rounded-sm border border-ink/10"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        {value}
      </span>
    );
  }
  return <span>&ldquo;{value}&rdquo;</span>;
}

function LoadingBubble({
  missing,
  clientName,
}: {
  missing: number;
  clientName: string;
}) {
  return (
    <ChatBubble author="bot">
      Reading {clientName}&rsquo;s brand profile…
      <div className="mt-2 flex items-center gap-3 rounded-md bg-paper/40 px-3 py-2">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-rust/20 border-t-rust"
          aria-hidden
        />
        <span className="text-[12px] text-ink-quiet">
          Drafting {missing} suggestion{missing === 1 ? '' : 's'}…
        </span>
      </div>
    </ChatBubble>
  );
}

function FailedBubble({
  error,
  onCancel,
}: {
  error: string;
  onCancel: () => void;
}) {
  return (
    <ChatBubble author="bot">
      <span className="text-warn">{error}</span>
      <div className="mt-3">
        <Button type="button" variant="ghost" onClick={onCancel} className="h-9">
          Back to Generate
        </Button>
      </div>
    </ChatBubble>
  );
}

function InlineErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn-soft/40 px-3 py-2">
      <p className="text-[12px] leading-snug text-warn">{message}</p>
    </div>
  );
}

// --- composer --------------------------------------------------------------

/** Pre-filled per-field composer. Hitting Send sends the current value;
 *  Enter (no shift) sends; "Reset to suggestion" reverts to the model's
 *  proposal. */
function ProposalComposer({
  field,
  value,
  proposed,
  disabled,
  onChange,
  onSend,
  onRevertToProposed,
  onCancel,
}: {
  field: BriefField;
  value: string;
  proposed: string;
  disabled: boolean;
  onChange: (next: string) => void;
  onSend: () => void;
  onRevertToProposed: () => void;
  onCancel: () => void;
}) {
  const edited = value !== proposed;
  const isMultiline = field === 'offer' || field === 'audience_line';
  const isColor = field === 'accent_color';

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
      e.preventDefault();
      onSend();
    }
    if (e.key === 'Enter' && !e.shiftKey && isMultiline) {
      // For textareas, Cmd/Ctrl+Enter sends; plain Enter inserts a newline.
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onSend();
      }
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        onSend();
      }}
      className="sticky bottom-0 z-10 border-t-2 border-ink/20 bg-paper px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {`// YOUR ${FIELD_LABEL[field].toUpperCase()}`}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
            {isMultiline
              ? '⌘ + enter to send'
              : 'enter to send'}
          </span>
        </div>

        {isColor ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ensureHex(value)}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-11 w-14 cursor-pointer rounded-md border-2 border-ink/20 bg-paper/40 p-0 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Pick brand colour"
            />
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) =>
                handleKeyDown(
                  e as React.KeyboardEvent<HTMLInputElement>,
                )
              }
              disabled={disabled}
              maxLength={9}
              className="h-11 max-w-[160px] font-mono text-[13px]"
              aria-label="Hex value"
            />
            <SendButton disabled={disabled || value.trim().length === 0} />
          </div>
        ) : isMultiline ? (
          <div className="flex items-end gap-2">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={2}
              aria-label={FIELD_LABEL[field]}
              className={cn(
                'min-h-[68px] flex-1 resize-none rounded-md border-2 border-ink/20 bg-paper/40 px-3 py-2.5',
                'text-[14px] leading-[1.45] text-ink placeholder:text-ink-quiet',
                'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
                'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-60',
              )}
            />
            <SendButton disabled={disabled || value.trim().length === 0} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) =>
                handleKeyDown(
                  e as React.KeyboardEvent<HTMLInputElement>,
                )
              }
              disabled={disabled}
              aria-label={FIELD_LABEL[field]}
              className="h-11"
            />
            <SendButton disabled={disabled || value.trim().length === 0} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-ink-quiet">{ACCEPT_HINT[field]}</span>
          {edited && proposed.length > 0 ? (
            <button
              type="button"
              onClick={onRevertToProposed}
              disabled={disabled}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              ↺ Reset to suggestion
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back to Generate
          </button>
        </div>
      </div>
    </form>
  );
}

function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        'inline-flex h-11 min-w-[72px] items-center justify-center rounded-md bg-rust px-4',
        'font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-rust-deep',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      Send
    </button>
  );
}

// --- helpers ---------------------------------------------------------------

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

/** Coerce any hex-like string into a 7-char `#rrggbb` colour input
 *  can render. Defaults to Webnua rust when the value is unparseable. */
function ensureHex(raw: string): string {
  return normaliseHex(raw) ?? '#d24317';
}

function makeProposalId(stepIndex: number): string {
  return `p-${stepIndex}`;
}

function makeUserId(stepIndex: number): string {
  return `u-${stepIndex}`;
}

/** Tiny markdown — `**bold**` → JSX <strong>. The bot question template
 *  uses `**field**` markers; rendering them inline keeps the question
 *  scannable without dragging in a markdown lib. */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
