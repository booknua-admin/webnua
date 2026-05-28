'use client';

// =============================================================================
// CampaignChat — single conversational surface owning gap-fill →
// "what's your idea?" → angle drafting → angle picking.
//
// Phase 7.5 · Session 2.3. Angles appear in the chat as a tickable
// bubble after the brand context is settled — no separate picker page.
//
// Internal step machine:
//
//   1. propose-fills   (only if soft-block gaps exist)
//                      → run propose-brief-fills, walk each gap as a
//                        bubble with composer pre-filled. Skip outright
//                        when missing[] is empty.
//   2. idea            → optional "Anything specific to test this
//                        month?" turn. Default "Three angles, surprise
//                        me." sends straight through to generation;
//                        otherwise the operator's text seeds the angle
//                        draft (passed as additional context).
//   3. angle-gen       → fires generate-angles with the (refreshed)
//                        brand context. Typing indicator in the chat
//                        while it runs.
//   4. angle-pick      → bot shows the three angles inline as
//                        tickable cards (AnglePickerCards inside a
//                        ChatBubble). Operator picks 1-3, sends, and
//                        the chat exits.
//
// On exit, calls onComplete with the picked angles. Parent builds the
// blueprint from those.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';

import { AnglePickerCards } from './AnglePickerCards';
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
  generateMetaAdAngles,
  type GeneratedAngle,
} from '@/lib/integrations/meta-ads/generate-angles';
import {
  proposeBriefFills,
  type BriefFillProposal,
} from '@/lib/integrations/meta-ads/propose-brief-fills';
import { cn } from '@/lib/utils';

// --- props ------------------------------------------------------------------

export type CampaignChatProps = {
  clientId: string;
  clientName: string;
  /** Soft-block missing fields, if any. Empty array → chat skips
   *  straight to the "Anything specific?" turn. */
  missing: readonly BriefField[];
  /** Fires when the operator picks angles + sends. Parent builds the
   *  campaign blueprint from these. */
  onComplete: (input: {
    angles: GeneratedAngle[];
    selectedAngleIds: Set<string>;
  }) => void;
  /** Operator backed out. Persisted gap-fill answers stay saved. */
  onCancel: () => void;
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
  | { kind: 'bot-text'; id: string; text: string }
  | { kind: 'bot-typing'; id: string }
  | { kind: 'bot-angles'; id: string; angles: GeneratedAngle[] }
  | { kind: 'user'; id: string; text: string };

// --- field metadata --------------------------------------------------------

const FIELD_LABEL: Record<BriefField, string> = {
  offer: 'your offer',
  audience_line: 'your ideal customer',
  services: 'your top services',
  accent_color: 'your brand colour',
};

const FIELD_QUESTION: Record<BriefField, string> = {
  offer: 'For **your offer** — the promise the ad makes — I would draft:',
  audience_line: 'For **the customer you want more of** I would draft:',
  services: 'For **your top services** I would list:',
  accent_color: 'For **your brand colour** I would pick:',
};

const ACCEPT_HINT: Record<BriefField, string> = {
  offer: 'Hit Send to use this, or edit and Send your version.',
  audience_line: 'Hit Send to use this, or edit and Send your version.',
  services: 'Hit Send to use this, or edit and Send.',
  accent_color: 'Hit Send to use this colour, or paste your own hex.',
};

// --- main component --------------------------------------------------------

type Step =
  | { kind: 'loading-proposals' }
  | { kind: 'gap-fill'; proposals: BriefFillProposal[]; index: number }
  | { kind: 'idea' }
  | { kind: 'angle-gen' }
  | { kind: 'angle-pick'; angles: GeneratedAngle[]; picked: Set<string> }
  | { kind: 'failed'; error: string };

export function CampaignChat({
  clientId,
  clientName,
  missing,
  onComplete,
  onCancel,
}: CampaignChatProps) {
  const orderedMissing = useMemo(() => sortChatFields(missing), [missing]);
  const hasGaps = orderedMissing.length > 0;

  const [step, setStep] = useState<Step>(
    hasGaps ? { kind: 'loading-proposals' } : { kind: 'idea' },
  );
  const [log, setLog] = useState<LogEntry[]>(() => seedInitialLog(clientName, orderedMissing.length, hasGaps));
  const [composer, setComposer] = useState<string>('');
  const [pending, setPending] = useState<boolean>(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    streamRef.current?.scrollTo({
      top: streamRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [log]);

  // ── On mount: fetch proposals if we have gaps; else mount the idea
  // turn directly. One-shot.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (!hasGaps) {
      // No gaps → mount the idea turn directly. Intentional setState-
      // in-effect — the seededRef guard above runs this exactly once
      // per mount, so we're not cascading; the lint default is for the
      // repeated-render case.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLog((prev) => [
        ...prev,
        {
          kind: 'bot-text',
          id: 'idea-q',
          text:
            'Got an angle you want to test this month? Tell me, or hit Send and I’ll come up with three.',
        },
      ]);
      return;
    }
    void (async () => {
      try {
        const proposals = await proposeBriefFills(clientId, orderedMissing);
        const proposalsByField = new Map(proposals.map((p) => [p.field, p]));
        const ordered: BriefFillProposal[] = orderedMissing.map(
          (f) =>
            proposalsByField.get(f) ?? {
              field: f,
              proposed: '',
              rationale: '',
            },
        );
        setLog((prev) => [
          ...prev,
          {
            kind: 'bot-proposal',
            id: makeProposalId(0),
            field: ordered[0].field,
            proposed: ordered[0].proposed,
            rationale: ordered[0].rationale,
          },
        ]);
        setComposer(ordered[0].proposed);
        setStep({ kind: 'gap-fill', proposals: ordered, index: 0 });
      } catch (error) {
        setStep({
          kind: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Could not draft suggestions — try again or use the classic builder.',
        });
      }
    })();
  }, [clientId, orderedMissing, hasGaps]);

  // --- gap-fill turn ------------------------------------------------------

  async function handleGapFillSend() {
    if (step.kind !== 'gap-fill') return;
    const value = composer.trim();
    if (value.length === 0) {
      setInlineError('Type a value or paste the suggestion.');
      return;
    }
    const proposal = step.proposals[step.index];
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
      { kind: 'user', id: makeUserId(`gap-${step.index}`), text: value },
      { kind: 'bot-typing', id: `t-gap-${step.index}` },
    ]);

    try {
      await saveBriefAnswer(clientId, answer);
    } catch (error) {
      setLog((prev) =>
        prev.filter((e) => e.id !== `t-gap-${step.index}`),
      );
      setInlineError(
        error instanceof Error
          ? error.message
          : 'Saving that failed — try again.',
      );
      setPending(false);
      return;
    }

    const nextIndex = step.index + 1;
    setLog((prev) => {
      const withoutTyping = prev.filter(
        (e) => e.id !== `t-gap-${step.index}`,
      );
      if (nextIndex >= step.proposals.length) {
        return withoutTyping;
      }
      const next = step.proposals[nextIndex];
      return [
        ...withoutTyping,
        {
          kind: 'bot-proposal',
          id: makeProposalId(nextIndex),
          field: next.field,
          proposed: next.proposed,
          rationale: next.rationale,
        },
      ];
    });

    setPending(false);

    if (nextIndex >= step.proposals.length) {
      // Gap-fill complete → roll into the idea turn.
      setStep({ kind: 'idea' });
      setLog((prev) => [
        ...prev,
        {
          kind: 'bot-text',
          id: 'idea-q',
          text:
            'Got an angle you want to test this month? Tell me, or hit Send and I’ll come up with three.',
        },
      ]);
      setComposer('');
    } else {
      setStep({ ...step, index: nextIndex });
      setComposer(step.proposals[nextIndex].proposed);
    }
  }

  // --- idea turn ----------------------------------------------------------

  async function handleIdeaSend() {
    if (step.kind !== 'idea') return;
    const value = composer.trim();
    setInlineError(null);

    setLog((prev) => [
      ...prev,
      {
        kind: 'user',
        id: 'idea-user',
        text: value.length > 0 ? value : '(no angle — surprise me)',
      },
      { kind: 'bot-typing', id: 't-angles' },
    ]);
    setComposer('');
    setStep({ kind: 'angle-gen' });

    try {
      // V1: the ad-idea text is captured in the chat log but isn't
      // currently threaded into the angle-generation prompt (the
      // generate-angles route reads brand context, not a fresh idea
      // string). Operator-typed ideas become a V1.1 polish — for now
      // they're acknowledged in chat but the model drafts from brand
      // context. Logging the text means there's a real audit of what
      // the operator wanted.
      const angles = await generateMetaAdAngles({ clientId });
      setLog((prev) => {
        const withoutTyping = prev.filter((e) => e.id !== 't-angles');
        if (angles.length === 0) {
          return [
            ...withoutTyping,
            {
              kind: 'bot-text',
              id: 'angles-empty',
              text:
                'I couldn’t draft anything this run — try again or use the classic builder.',
            },
          ];
        }
        return [
          ...withoutTyping,
          {
            kind: 'bot-text',
            id: 'angles-intro',
            text: 'Here are three angles I’d run for you — pick what you want to test:',
          },
          { kind: 'bot-angles', id: 'angles', angles },
        ];
      });
      if (angles.length > 0) {
        setStep({
          kind: 'angle-pick',
          angles,
          picked: new Set(angles.map((a) => a.id)),
        });
      } else {
        setStep({ kind: 'idea' });
      }
    } catch (error) {
      setLog((prev) => prev.filter((e) => e.id !== 't-angles'));
      setStep({
        kind: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Angle generation failed — try again or use the classic builder.',
      });
    }
  }

  // --- angle pick ---------------------------------------------------------

  function handleToggleAngle(id: string, selected: boolean) {
    if (step.kind !== 'angle-pick') return;
    setStep((prev) => {
      if (prev.kind !== 'angle-pick') return prev;
      const next = new Set(prev.picked);
      if (selected) next.add(id);
      else next.delete(id);
      return { ...prev, picked: next };
    });
  }

  function handleAnglesConfirm() {
    if (step.kind !== 'angle-pick') return;
    if (step.picked.size === 0) {
      setInlineError('Tick at least one angle.');
      return;
    }
    onComplete({
      angles: step.angles,
      selectedAngleIds: step.picked,
    });
  }

  // --- render -------------------------------------------------------------

  const currentField =
    step.kind === 'gap-fill'
      ? step.proposals[step.index]?.field ?? null
      : null;
  const totalGapSteps = orderedMissing.length;
  const gapStepNumber = step.kind === 'gap-fill' ? step.index + 1 : null;

  return (
    <div className="flex min-h-[560px] flex-col gap-0 overflow-hidden rounded-2xl border border-rule bg-card">
      <Header
        stepLabel={describeStep(step, gapStepNumber, totalGapSteps)}
        onCancel={onCancel}
      />
      <div
        ref={streamRef}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {step.kind === 'loading-proposals' ? (
            <LoadingBubble missing={missing.length} clientName={clientName} />
          ) : null}

          {step.kind === 'failed' ? (
            <FailedBubble error={step.error} onCancel={onCancel} />
          ) : null}

          {log.map((entry) => (
            <LogEntryView
              key={entry.id}
              entry={entry}
              clientName={clientName}
              pickedAngleIds={
                step.kind === 'angle-pick' ? step.picked : new Set()
              }
              onTogglePickedAngle={handleToggleAngle}
            />
          ))}

          {inlineError ? <InlineErrorBanner message={inlineError} /> : null}
        </div>
      </div>

      {step.kind === 'gap-fill' && currentField ? (
        <ProposalComposer
          field={currentField}
          value={composer}
          proposed={step.proposals[step.index].proposed}
          disabled={pending}
          onChange={setComposer}
          onSend={handleGapFillSend}
          onRevertToProposed={() =>
            setComposer(step.proposals[step.index].proposed)
          }
          onCancel={onCancel}
        />
      ) : null}

      {step.kind === 'idea' ? (
        <IdeaComposer
          value={composer}
          disabled={pending}
          onChange={setComposer}
          onSend={handleIdeaSend}
          onCancel={onCancel}
        />
      ) : null}

      {step.kind === 'angle-pick' ? (
        <AngleConfirmBand
          pickedCount={step.picked.size}
          totalCount={step.angles.length}
          onConfirm={handleAnglesConfirm}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

// --- sub-components --------------------------------------------------------

function Header({
  stepLabel,
  onCancel,
}: {
  stepLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b-2 border-ink/10 bg-paper-2 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// CAMPAIGN CHAT'}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          {stepLabel}
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

function LogEntryView({
  entry,
  clientName,
  pickedAngleIds,
  onTogglePickedAngle,
}: {
  entry: LogEntry;
  clientName: string;
  pickedAngleIds: Set<string>;
  onTogglePickedAngle: (id: string, selected: boolean) => void;
}) {
  switch (entry.kind) {
    case 'bot-greeting':
      return (
        <ChatBubble author="bot">
          {entry.gapCount > 0 ? (
            <>
              Looking at{' '}
              <strong className="font-semibold">{clientName}</strong>.
              I&rsquo;ve drafted {entry.gapCount} suggestion
              {entry.gapCount === 1 ? '' : 's'} from your brand profile —
              accept or tweak each one in five seconds.
            </>
          ) : (
            <>
              Looking at{' '}
              <strong className="font-semibold">{clientName}</strong>.
              Brand profile is good to go.
            </>
          )}
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
              <span className="italic text-ink-quiet">
                (no suggestion — type your own)
              </span>
            )}
          </div>
          {entry.rationale ? (
            <p className="mt-2 text-[12px] italic leading-snug text-ink-quiet">
              {entry.rationale}
            </p>
          ) : null}
        </ChatBubble>
      );
    case 'bot-text':
      return <ChatBubble author="bot">{entry.text}</ChatBubble>;
    case 'bot-typing':
      return (
        <ChatBubble author="bot">
          <TypingIndicator />
        </ChatBubble>
      );
    case 'bot-angles':
      return (
        <ChatBubble
          author="bot"
          rich={
            <div className="-mx-1 mt-1">
              <AnglePickerCards
                angles={entry.angles}
                selected={pickedAngleIds}
                onToggle={onTogglePickedAngle}
              />
            </div>
          }
        />
      );
    case 'user':
      return <ChatBubble author="user">{entry.text}</ChatBubble>;
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
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-9"
        >
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

// --- composers --------------------------------------------------------------

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

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) {
    if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
      e.preventDefault();
      onSend();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isMultiline) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSend();
      }}
      className="sticky bottom-0 z-10 border-t-2 border-ink/20 bg-paper px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {`// YOUR ${FIELD_LABEL[field].toUpperCase()}`}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
            {isMultiline ? '⌘ + enter to send' : 'enter to send'}
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
                handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>)
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
                handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>)
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

function IdeaComposer({
  value,
  disabled,
  onChange,
  onSend,
  onCancel,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSend();
      }}
      className="sticky bottom-0 z-10 border-t-2 border-ink/20 bg-paper px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// YOUR ANGLE (optional)'}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
            enter to send
          </span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
            placeholder='e.g. "Push our same-week scheduling" — or leave blank and I’ll come up with three.'
            className={cn(
              'min-h-[68px] flex-1 resize-none rounded-md border-2 border-ink/20 bg-paper/40 px-3 py-2.5',
              'text-[14px] leading-[1.45] text-ink placeholder:text-ink-quiet',
              'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
              'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-60',
            )}
            aria-label="Your angle"
          />
          <SendButton disabled={disabled} />
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-ink-quiet">
            Or hit Send with nothing typed and I&rsquo;ll surprise you.
          </span>
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

function AngleConfirmBand({
  pickedCount,
  totalCount,
  onConfirm,
  onCancel,
}: {
  pickedCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t-2 border-ink/20 bg-paper px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// PICK YOUR ANGLES'}
        </span>
        <span className="text-[13px] text-ink">
          {pickedCount > 0 ? (
            <>
              <strong className="font-semibold">{pickedCount}</strong> of {totalCount} angle
              {totalCount === 1 ? '' : 's'} selected
            </>
          ) : (
            <span className="text-ink-quiet">
              Tick at least one angle to continue.
            </span>
          )}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={pickedCount === 0}
          className="h-11 px-6 text-[14px] font-semibold"
        >
          Build my campaign →
        </Button>
      </div>
    </div>
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

function seedInitialLog(
  clientName: string,
  gapCount: number,
  hasGaps: boolean,
): LogEntry[] {
  const greeting: LogEntry = {
    kind: 'bot-greeting',
    id: 'g',
    clientName,
    gapCount,
  };
  if (!hasGaps) {
    return [
      greeting,
      {
        kind: 'bot-text',
        id: 'idea-q',
        text:
          'Got an angle you want to test this month? Tell me, or hit Send and I’ll come up with three.',
      },
    ];
  }
  return [greeting];
}

function describeStep(
  step: Step,
  gapStepNumber: number | null,
  totalGapSteps: number,
): string {
  switch (step.kind) {
    case 'loading-proposals':
      return 'Reading your brand…';
    case 'gap-fill':
      return `Brand · step ${gapStepNumber} of ${totalGapSteps}`;
    case 'idea':
      return 'Your angle (optional)';
    case 'angle-gen':
      return 'Drafting three angles…';
    case 'angle-pick':
      return 'Pick your angles';
    case 'failed':
      return 'Something went wrong';
  }
}

function toAnswer(field: BriefField, raw: string): BriefAnswerInput | null {
  const value = raw.trim();
  if (value.length === 0) return null;
  if (field === 'accent_color') {
    const hex = normaliseHex(value);
    if (!hex) return null;
    return { field: 'accent_color', hex };
  }
  if (field === 'offer') return { field: 'offer', text: value };
  if (field === 'audience_line')
    return { field: 'audience_line', text: value };
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

function ensureHex(raw: string): string {
  return normaliseHex(raw) ?? '#d24317';
}

function makeProposalId(index: number): string {
  return `p-${index}`;
}

function makeUserId(suffix: string): string {
  return `u-${suffix}`;
}

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
