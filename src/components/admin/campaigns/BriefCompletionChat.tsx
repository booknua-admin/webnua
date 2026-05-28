'use client';

// =============================================================================
// BriefCompletionChat — short chat that fills in the customer's brand row
// when the brief is incomplete, then auto-fires generation.
//
// Phase 7.5 · Session 2.2. Mounted in-place over the Generate surface
// when `useBriefCompleteness` returns missing soft-block fields. Reuses
// the conversational onboarding chat primitives (ChatBubble + ChatComposer
// + TypingIndicator) so the visual language matches /sign-up.
//
// Flow:
//   • One short question per missing field, in the canonical order
//     (`sortChatFields` — offer → services → audience_line →
//     accent_color).
//   • Each answer auto-saves to its canonical `brands` column via
//     `saveBriefAnswer` (same RLS path /settings/brand uses).
//   • The operator may skip any question; skipped fields stay blank
//     (the generator falls back to qualitative defaults). `services` is
//     the only "hard" — skipping it leaves the AI without enough
//     context to draft useful ads, so the chat warns and lets the
//     operator either type something or cancel back to the Generate
//     surface.
//   • After the last turn the chat fires `onComplete()` and the parent
//     auto-fires generation. No "review your answers" intermediate
//     step — the design doc locks this as "friction is the enemy of
//     magic".
//
// Mount: REPLACES the Generate surface's idle state in-place rather
// than opening a dialog over it. The operator clicks Generate → the
// chat takes the page → completes → angle picker mounts on the same
// page. Same conversational-onboarding precedent.
//
// Out of scope for 2.2 (deliberately):
//   • Asking ad-axis questions (budget / targeting / objective) — those
//     are the review screen's job, not the brand-completion chat's.
//   • A "review your answers before generating" intermediate step.
//   • Voice-axis questions (the chat asks for the *content*, not the
//     *tone* — tone defaults stay at the brand row's stored values).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';

import { ChatBubble } from '@/components/shared/conversation/ChatBubble';
import { ChatComposer } from '@/components/shared/conversation/ChatComposer';
import { TypingIndicator } from '@/components/shared/conversation/TypingIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { INDUSTRY_PRIMARY_COLORS } from '@/lib/onboarding/industry-colors';
import { mapIndustry, type IndustryKey } from '@/lib/website/industry-templates';
import {
  saveBriefAnswer,
  sortChatFields,
  type BriefAnswerInput,
} from '@/lib/campaigns/brief-update';
import type { BriefField } from '@/lib/campaigns/brief-completeness';
import { cn } from '@/lib/utils';

// --- props ------------------------------------------------------------------

export type BriefCompletionChatProps = {
  /** Client UUID — drives the brand UPDATE. */
  clientId: string;
  /** Display name for the bot's opening greeting. */
  clientName: string;
  /** Industry freeform string from `clients.industry` (or
   *  `brands.industry_category`) — used to seed the accent-color picker. */
  industryFreeText: string;
  /** The missing-field list from `useBriefCompleteness`. The component
   *  re-orders these via `sortChatFields`. */
  missing: readonly BriefField[];
  /** Fires after every question is answered (or skipped). Parent
   *  auto-fires generation. */
  onComplete: () => void;
  /** Fires when the operator backs out — parent returns to the idle
   *  Generate state with the answered fields already persisted. */
  onCancel: () => void;
};

// --- message log type ------------------------------------------------------

type Author = 'bot' | 'user';

type LogEntry = {
  id: string;
  author: Author;
  /** Plain prose body. The user's free-text answer or the bot's
   *  question. */
  text?: string;
  /** Inline UI rendered below the prose — used for the accent-color
   *  picker and the "thinking" indicator. */
  rich?: 'typing' | 'color-picker' | 'done';
};

// --- the four locked questions ---------------------------------------------

const QUESTION: Record<BriefField, string> = {
  offer:
    "What's the one thing you'd put on a billboard for this business — the promise that gets the click?",
  audience_line:
    "Who's the customer you most want more of? One sentence.",
  services:
    "What are your top 3 services? Comma-separated.",
  accent_color: 'Pick one — what colour represents your brand?',
};

const PLACEHOLDER: Record<BriefField, string> = {
  offer: 'e.g. Burst pipe? On-site within 2 hours, fixed-price quote.',
  audience_line: 'e.g. Cottesloe homeowners renovating their kitchens.',
  services: 'e.g. Emergency call-outs, switchboard upgrades, safety checks',
  accent_color: '',
};

// --- main component --------------------------------------------------------

export function BriefCompletionChat({
  clientId,
  clientName,
  industryFreeText,
  missing,
  onComplete,
  onCancel,
}: BriefCompletionChatProps) {
  const fields = useMemo(() => sortChatFields(missing), [missing]);
  const industryKey: IndustryKey = useMemo(
    () => mapIndustry(industryFreeText),
    [industryFreeText],
  );

  const [log, setLog] = useState<LogEntry[]>([]);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);

  // Seed the opening greeting + the first question. One-shot effect —
  // re-renders never re-greet. Mirrors the onboarding shell's pattern
  // (it tracks the same intent via a `seededRef`).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const n = fields.length;
    const greeting = `Quick — ${n} question${n === 1 ? '' : 's'} before we draft your ads. Each one saves to your brand profile, so we only ask once.`;
    setLog([
      { id: 'g-0', author: 'bot', text: greeting },
      { id: makeQuestionId(0), author: 'bot', text: QUESTION[fields[0]] },
    ]);
  }, [fields]);

  // Auto-scroll the message stream to the bottom on every log change.
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    streamRef.current?.scrollTo({
      top: streamRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [log]);

  const currentField: BriefField | null = fields[stepIndex] ?? null;
  const totalSteps = fields.length;

  /** Persist an answer + advance. The bot's "thinking" indicator
   *  renders briefly so the operator sees the system acknowledge their
   *  input before the next question appears. */
  async function advance(
    field: BriefField,
    answer: BriefAnswerInput,
    userSummary: string,
  ): Promise<void> {
    setError(null);
    setPending(true);

    // Echo the user's reply into the log.
    setLog((prev) => [
      ...prev,
      { id: makeReplyId(stepIndex), author: 'user', text: userSummary },
      { id: `t-${stepIndex}`, author: 'bot', rich: 'typing' },
    ]);

    try {
      await saveBriefAnswer(clientId, answer);
    } catch (e) {
      // Pull the typing indicator + flag the error inline; the operator
      // can re-submit the same value.
      setLog((prev) => prev.filter((entry) => entry.id !== `t-${stepIndex}`));
      setError(e instanceof Error ? e.message : 'Saving that failed — try again.');
      setPending(false);
      return;
    }

    // Replace typing with the next question or a "done" acknowledgement.
    const nextStep = stepIndex + 1;
    setLog((prev) => {
      const withoutTyping = prev.filter((entry) => entry.id !== `t-${stepIndex}`);
      if (nextStep >= totalSteps) {
        return [
          ...withoutTyping,
          { id: 'done', author: 'bot', text: 'All set. Drafting your ads now.' },
        ];
      }
      return [
        ...withoutTyping,
        { id: makeQuestionId(nextStep), author: 'bot', text: QUESTION[fields[nextStep]] },
      ];
    });

    setStepIndex(nextStep);
    setPending(false);
    if (nextStep >= totalSteps) {
      setDone(true);
    }
  }

  /** Skip the current question — no DB write, just advance. The
   *  generator falls back to qualitative defaults for unanswered
   *  fields. `services` is special: skipping leaves the AI with no
   *  service list to work from, so the bot pushes back. */
  function skip() {
    if (!currentField) return;
    if (currentField === 'services') {
      setError(
        "Your services are the one thing the AI can't invent. Type the top 3 you'd want more of, or cancel back and we'll come back to it later.",
      );
      return;
    }
    setError(null);
    setLog((prev) => [
      ...prev,
      { id: makeReplyId(stepIndex), author: 'user', text: '(skipped)' },
    ]);
    const nextStep = stepIndex + 1;
    setLog((prev) => {
      if (nextStep >= totalSteps) {
        return [
          ...prev,
          { id: 'done', author: 'bot', text: 'All set. Drafting your ads now.' },
        ];
      }
      return [
        ...prev,
        { id: makeQuestionId(nextStep), author: 'bot', text: QUESTION[fields[nextStep]] },
      ];
    });
    setStepIndex(nextStep);
    if (nextStep >= totalSteps) {
      setDone(true);
    }
  }

  // When all fields are done, auto-fire generation after a short beat
  // so the operator sees the "all set" line before the angle-drafting
  // splash takes over.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      onComplete();
    }, 900);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  // --- input slot ---------------------------------------------------------

  function handleTextSend(text: string) {
    if (!currentField) return;
    if (currentField === 'offer') {
      void advance('offer', { field: 'offer', text }, text);
    } else if (currentField === 'audience_line') {
      void advance('audience_line', { field: 'audience_line', text }, text);
    } else if (currentField === 'services') {
      void advance('services', { field: 'services', text }, text);
    }
  }

  function handleColorPicked(hex: string, label: string) {
    void advance('accent_color', { field: 'accent_color', hex }, `${label} (${hex})`);
  }

  const isTextStep =
    currentField === 'offer' ||
    currentField === 'audience_line' ||
    currentField === 'services';
  const isColorStep = currentField === 'accent_color';

  // --- render -------------------------------------------------------------

  return (
    <div className="flex min-h-[480px] flex-col gap-0 overflow-hidden rounded-2xl border border-rule bg-card">
      <Header
        stepIndex={Math.min(stepIndex, Math.max(0, totalSteps - 1))}
        totalSteps={totalSteps}
        onCancel={onCancel}
      />
      <div
        ref={streamRef}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <BotIntro clientName={clientName} />
          {log.map((entry) => (
            <ChatBubble key={entry.id} author={entry.author}>
              {entry.text ?? null}
              {entry.rich === 'typing' ? <TypingIndicator /> : null}
            </ChatBubble>
          ))}
          {error ? <InlineErrorBanner message={error} /> : null}
        </div>
      </div>
      {!done && currentField ? (
        <div className="border-t-2 border-ink/10 bg-paper">
          {isTextStep ? (
            <ChatComposer
              placeholder={PLACEHOLDER[currentField] ?? 'Your answer'}
              disabled={pending}
              sendLabel="Send"
              onSend={handleTextSend}
            />
          ) : null}
          {isColorStep ? (
            <ColorPickerStep
              industryKey={industryKey}
              disabled={pending}
              onPick={handleColorPicked}
            />
          ) : null}
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pb-3 pt-1 sm:px-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              ← Back to Generate
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={pending}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-rust hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skip this question →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- sub-components --------------------------------------------------------

function Header({
  stepIndex,
  totalSteps,
  onCancel,
}: {
  stepIndex: number;
  totalSteps: number;
  onCancel: () => void;
}) {
  const displayStep = Math.min(stepIndex + 1, totalSteps);
  return (
    <div className="flex items-center justify-between border-b-2 border-ink/10 bg-paper-2 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// FILL IN YOUR BRIEF'}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Step {displayStep} of {totalSteps}
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

function BotIntro({ clientName }: { clientName: string }) {
  return (
    <ChatBubble author="bot">
      Hey — looking at <strong className="font-semibold">{clientName}</strong>{' '}
      now. A couple of things are missing from your brand profile that the AI
      needs to draft good ads. Each answer saves to your profile so we never
      ask again.
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

// --- color picker step -----------------------------------------------------

/** Three industry-seeded swatches + a custom hex input. Honest about
 *  what an accent colour does ("appears on buttons + highlights") so
 *  the operator picks intentionally. */
function ColorPickerStep({
  industryKey,
  disabled,
  onPick,
}: {
  industryKey: IndustryKey;
  disabled: boolean;
  onPick: (hex: string, label: string) => void;
}) {
  const industryHex =
    INDUSTRY_PRIMARY_COLORS[industryKey] ?? INDUSTRY_PRIMARY_COLORS.generic;
  // Two industry seeds + the Webnua rust default = three swatches.
  // Industry seed first so the operator's trade-appropriate option is
  // the leftmost / default focus.
  const SWATCHES: ReadonlyArray<{ hex: string; label: string }> = [
    { hex: industryHex, label: `${industryKey} default` },
    { hex: '#d24317', label: 'Webnua rust' },
    { hex: '#1e6b3a', label: 'Trusted green' },
  ];
  const [customHex, setCustomHex] = useState<string>(industryHex);

  function submitCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const cleaned = normaliseHex(customHex);
    if (!cleaned) return;
    onPick(cleaned, 'Custom');
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// YOUR PICK'}
        </span>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.hex, s.label)}
            className={cn(
              'group flex flex-col items-start gap-2 rounded-md border-2 border-ink/15 bg-paper/40 p-3 text-left hover:border-rust',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'min-w-[140px] flex-1',
            )}
          >
            <span
              className="h-10 w-full rounded-sm border border-ink/10"
              style={{ backgroundColor: s.hex }}
              aria-hidden
            />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet group-hover:text-rust">
              {s.label}
            </span>
            <span className="font-mono text-[11px] text-ink">{s.hex}</span>
          </button>
        ))}
        <form
          onSubmit={submitCustom}
          className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-md border-2 border-ink/15 bg-paper/40 p-3"
        >
          <input
            type="color"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-sm border border-ink/10 p-0"
            aria-label="Custom colour"
          />
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              maxLength={7}
              className="h-9 flex-1 font-mono text-[12px]"
              aria-label="Custom hex"
            />
            <Button type="submit" disabled={disabled || !normaliseHex(customHex)} className="h-9 px-3">
              Use →
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function makeQuestionId(stepIndex: number): string {
  return `q-${stepIndex}`;
}

function makeReplyId(stepIndex: number): string {
  return `r-${stepIndex}`;
}

/** Coerce a hex string into the canonical `#rrggbb` shape — `# ` is
 *  optional in user input, uppercase + lowercase both accepted, but the
 *  output is always 7 chars starting with `#`. Returns null when the
 *  input isn't a valid hex. */
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
