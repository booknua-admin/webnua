'use client';

// =============================================================================
// ConversationShell — the conversational onboarding chat for /sign-up.
//
// Session B owns: turn-1 freeform message → email capture → 6-digit code
// verification → workspace provisioning → session mint → land at turn-2
// placeholder.
//
// Session C will fill in: AI extraction from turn-1, clarifying-question
// loop, service picker (Dialog ≥6 / inline ≤5), brand step, generation
// status, dashboard handoff.
//
// State machine phases:
//   turn-1-input     — bot asks "Tell me what you do and where", user types.
//   awaiting-email   — bot asks for email, user types.
//   awaiting-code    — code requested + sent, user types code in 6-digit grid.
//   verifying        — verify-code POST in flight.
//   turn-2           — verified + session minted. Placeholder bubble. Session
//                      C replaces this with the real next-turn surface.
//
// Mobile UX:
//   - sticky-bottom composer (ChatComposer)
//   - auto-scroll to bottom on new message (scroll-into-view ref)
//   - keyboard-avoidance via visualViewport listener that pads the message
//     container so the composer stays above the keyboard
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChatBubble } from '@/components/shared/conversation/ChatBubble';
import { ChatComposer } from '@/components/shared/conversation/ChatComposer';
import { ChatGenerationBubble } from '@/components/shared/conversation/ChatGenerationBubble';
import { TypingIndicator } from '@/components/shared/conversation/TypingIndicator';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// types

type Author = 'bot' | 'user';

type ChatMessage = {
  id: string;
  author: Author;
  text: string;
};

type Phase =
  | 'turn-1-input'
  | 'awaiting-email'
  | 'requesting-code'
  | 'awaiting-code'
  | 'verifying'
  | 'turn-2';

type RequestCodeResponse = {
  success: boolean;
  emailOutcome?: 'sent' | 'failed' | 'skipped';
  expiresInMinutes?: number;
  fallback?: string;
  message?: string;
  error?: string;
  detail?: string;
};

type VerifyCodeResponse = {
  success: boolean;
  email?: string;
  password?: string;
  clientId?: string;
  clientSlug?: string;
  redirect?: string;
  error?: string;
  detail?: string;
  retryAfterMinutes?: number;
  attemptsRemaining?: number;
};

// ---------------------------------------------------------------------------
// shell

const BOT_TURN1 = "Hey — I'm here to get your business live on Webnua. To start, tell me what you do and where (one sentence is fine).";
const BOT_ASK_EMAIL = "Great. What's the best email to reach you on? I'll send a 6-digit code to verify it.";
const BOT_CODE_SENT = (email: string) => `Code sent to ${email}. Type the 6 digits below — it expires in 10 minutes.`;
const BOT_TURN2 = "Thanks — you're in. The next steps will land here shortly while we finish building the conversational flow. For now, head to your dashboard.";

const RESEND_AVAILABLE_AFTER_MS = 10_000;

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ConversationShell() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('turn-1-input');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: newId('bot'), author: 'bot', text: BOT_TURN1 },
  ]);
  const [botThinking, setBotThinking] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendReadyAt, setResendReadyAt] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ---- helpers -----------------------------------------------------------
  const appendMessage = useCallback((author: Author, text: string) => {
    setMessages((prev) => [...prev, { id: newId(author), author, text }]);
  }, []);

  // ---- auto-scroll + keyboard-avoidance ---------------------------------
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, phase, botThinking]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const handler = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      container.style.paddingBottom = `${overlap}px`;
    };
    handler();
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  // Re-render every second while in awaiting-code so the resend button can
  // flip from "Resend in Ns" to "Resend code" without a stale-closure.
  // We track wall-clock time in state so the resend timer math stays a pure
  // function of state during render (no Date.now() at render time).
  useEffect(() => {
    if (phase !== 'awaiting-code') return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // ---- turn-1: capture the freeform answer ------------------------------
  const handleTurn1Send = useCallback(
    async (text: string) => {
      if (phase !== 'turn-1-input') return;
      setFirstMessage(text);
      appendMessage('user', text);
      setError(null);
      setBotThinking(true);
      // Tiny artificial delay so the bot reply doesn't render in the same
      // paint tick as the user message (no perceived "thinking").
      await new Promise((resolve) => setTimeout(resolve, 600));
      appendMessage('bot', BOT_ASK_EMAIL);
      setBotThinking(false);
      setPhase('awaiting-email');
    },
    [appendMessage, phase],
  );

  // ---- requesting + sending the verification code -----------------------
  const requestCode = useCallback(
    async (forEmail: string): Promise<boolean> => {
      const response = await fetch('/api/sign-up/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forEmail }),
      });
      const body = (await response.json().catch(() => ({}))) as RequestCodeResponse;
      if (!response.ok) {
        setError(describeRequestError(body));
        return false;
      }
      if (body.success === false) {
        // Fallback / retry path — code IS in the DB (or not), email did not
        // arrive. Surface the message; the resend button takes them again.
        setInfo(body.message ?? 'We had trouble sending your code — tap Resend below to try again.');
        return true;
      }
      setInfo(null);
      return true;
    },
    [],
  );

  const handleEmailSubmit = useCallback(async () => {
    const candidate = emailDraft.trim().toLowerCase();
    setError(null);
    setInfo(null);
    if (!candidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setError('That email looks off — double-check and try again.');
      return;
    }
    setEmail(candidate);
    appendMessage('user', candidate);
    setBotThinking(true);
    setPhase('requesting-code');
    const ok = await requestCode(candidate);
    setBotThinking(false);
    if (!ok) {
      setPhase('awaiting-email');
      return;
    }
    appendMessage('bot', BOT_CODE_SENT(candidate));
    const now = Date.now();
    setNowMs(now);
    setResendReadyAt(now + RESEND_AVAILABLE_AFTER_MS);
    setCode(['', '', '', '', '', '']);
    setPhase('awaiting-code');
  }, [appendMessage, emailDraft, requestCode]);

  const handleResend = useCallback(async () => {
    if (Date.now() < resendReadyAt) return;
    setError(null);
    setInfo(null);
    setBotThinking(true);
    const ok = await requestCode(email);
    setBotThinking(false);
    if (ok) {
      const now = Date.now();
      setCode(['', '', '', '', '', '']);
      setNowMs(now);
      setResendReadyAt(now + RESEND_AVAILABLE_AFTER_MS);
      appendMessage('bot', "Fresh code on the way — same 6-digit drill.");
    }
  }, [appendMessage, email, requestCode, resendReadyAt]);

  // ---- code verification -------------------------------------------------
  const handleVerify = useCallback(
    async (joined: string) => {
      setError(null);
      setPhase('verifying');
      setBotThinking(true);
      let response: Response;
      try {
        response = await fetch('/api/sign-up/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: joined, firstMessage }),
        });
      } catch {
        setError('We could not reach our servers. Check your connection and try again.');
        setBotThinking(false);
        setPhase('awaiting-code');
        return;
      }
      const body = (await response.json().catch(() => ({}))) as VerifyCodeResponse;

      if (!response.ok || !body.success || !body.email || !body.password) {
        setError(describeVerifyError(body, response.status));
        setBotThinking(false);
        setPhase('awaiting-code');
        // On a wrong-code we reset the grid for the next attempt.
        if (body.error === 'wrong-code' || body.error === 'code-expired-or-invalid') {
          setCode(['', '', '', '', '', '']);
        }
        return;
      }

      // Mint the session client-side using the password the route just set.
      // The UserProvider's auth listener picks it up automatically.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (signInError) {
        setError(`We verified your code but could not sign you in: ${signInError.message}`);
        setBotThinking(false);
        setPhase('awaiting-code');
        return;
      }

      appendMessage('bot', BOT_TURN2);
      setBotThinking(false);
      setPhase('turn-2');
    },
    [appendMessage, email, firstMessage],
  );

  // ---- 6-digit input -----------------------------------------------------
  const setDigit = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/\D/g, '');
      if (cleaned.length > 1) {
        // paste handling — split across the grid from `index` onwards.
        setCode((prev) => {
          const next = [...prev];
          for (let i = 0; i < 6 - index; i += 1) {
            next[index + i] = cleaned[i] ?? next[index + i];
          }
          // If the paste filled the grid, kick verification.
          if (next.every((d) => d.length === 1)) {
            void handleVerify(next.join(''));
          }
          return next;
        });
        return;
      }
      setCode((prev) => {
        const next = [...prev];
        next[index] = cleaned;
        if (cleaned && index < 5) {
          // auto-advance to the next field
          window.setTimeout(() => {
            const el = document.getElementById(`code-${index + 1}`) as HTMLInputElement | null;
            el?.focus();
          }, 0);
        }
        if (next.every((d) => d.length === 1)) {
          void handleVerify(next.join(''));
        }
        return next;
      });
    },
    [handleVerify],
  );

  const handleCodeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && code[index].length === 0 && index > 0) {
      const el = document.getElementById(`code-${index - 1}`) as HTMLInputElement | null;
      el?.focus();
    }
  };

  // ---- render slots ------------------------------------------------------
  const resendSecondsLeft = Math.max(0, Math.ceil((resendReadyAt - nowMs) / 1000));
  const canResend = phase === 'awaiting-code' && resendSecondsLeft <= 0;

  const composerProps = (() => {
    switch (phase) {
      case 'turn-1-input':
        return {
          placeholder: "e.g. I'm a sparkie in Cottesloe doing residential rewires.",
          disabled: botThinking,
          sendLabel: 'Send',
          onSend: handleTurn1Send,
        };
      case 'awaiting-email':
        // Email-capture renders an Input inside a bubble (richer affordance);
        // composer disabled in this phase.
        return null;
      case 'requesting-code':
      case 'awaiting-code':
      case 'verifying':
      case 'turn-2':
        return null;
    }
  })();

  return (
    <div className="fixed inset-0 flex w-full flex-col bg-paper">
      <div className="flex items-center justify-center gap-3 border-b border-rule bg-paper px-4 py-3">
        <BrandMark size="default" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
          {messages.map((m) => (
            <ChatBubble key={m.id} author={m.author}>
              {m.text}
            </ChatBubble>
          ))}

          {phase === 'awaiting-email' ? (
            <ChatBubble
              author="bot"
              rich={
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailSubmit();
                  }}
                  className="flex flex-col gap-2"
                >
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@yourbusiness.com"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    autoFocus
                    className="min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={botThinking}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper hover:bg-rust-deep disabled:opacity-50"
                  >
                    {botThinking ? 'Sending…' : 'Send me a code →'}
                  </button>
                </form>
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {phase === 'awaiting-code' || phase === 'verifying' || phase === 'requesting-code' ? (
            <ChatBubble
              author="bot"
              rich={
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        id={`code-${i}`}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code[i]}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(e, i)}
                        disabled={phase === 'verifying' || phase === 'requesting-code'}
                        autoFocus={i === 0}
                        className={cn(
                          'h-12 w-10 rounded-md border border-rule bg-card text-center',
                          'font-mono text-[18px] font-bold text-ink',
                          'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
                          'disabled:bg-paper-2 disabled:opacity-60',
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={!canResend || botThinking}
                      className={cn(
                        'font-mono text-[11px] uppercase tracking-[0.12em] font-bold',
                        canResend ? 'text-rust hover:text-rust-deep' : 'text-ink-quiet',
                        'disabled:cursor-not-allowed',
                      )}
                    >
                      {canResend
                        ? 'Resend code'
                        : `Resend in ${resendSecondsLeft}s`}
                    </button>
                    {phase === 'verifying' ? (
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
                        Verifying…
                      </span>
                    ) : null}
                  </div>
                </div>
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {phase === 'turn-2' ? (
            <ChatBubble
              author="bot"
              rich={
                <div className="flex flex-col gap-3">
                  <ChatGenerationBubble />
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper hover:bg-rust-deep"
                  >
                    Open my dashboard →
                  </button>
                </div>
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {botThinking ? (
            <ChatBubble author="bot">
              <TypingIndicator />
            </ChatBubble>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[13px] text-warn"
            >
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-[12px] text-ink-quiet">
              {info}
            </div>
          ) : null}

          <div ref={scrollAnchorRef} aria-hidden />
        </div>
      </div>

      {composerProps ? <ChatComposer {...composerProps} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// error helpers

function describeRequestError(body: RequestCodeResponse): string {
  switch (body.error) {
    case 'email-invalid':
      return 'That email looks off — double-check and try again.';
    case 'email-too-long':
      return 'That email address is too long.';
    case 'disposable-email':
      return 'Please use your real business email — disposable email services are not accepted.';
    case 'rate-limited-ip':
    case 'rate-limited-email':
      return body.detail ?? 'Too many code requests right now. Try again in a few minutes.';
    case 'insert-failed':
      return 'We could not save your verification code. Try again in a moment.';
    default:
      return body.detail ?? 'Something went wrong. Try again.';
  }
}

function describeVerifyError(body: VerifyCodeResponse, status: number): string {
  switch (body.error) {
    case 'email-invalid':
    case 'code-format-invalid':
      return 'That code is not six digits — type it exactly as it appears in the email.';
    case 'first-message-required':
      return 'Looks like we lost your first message. Refresh and start again.';
    case 'too-many-attempts':
      if (typeof body.retryAfterMinutes === 'number') {
        return `Too many attempts. Wait ${body.retryAfterMinutes} minutes or request a fresh code.`;
      }
      return body.detail ?? 'Too many attempts. Request a fresh code below.';
    case 'wrong-code':
      if (typeof body.attemptsRemaining === 'number' && body.attemptsRemaining > 0) {
        return `That code doesn't match — ${body.attemptsRemaining} ${
          body.attemptsRemaining === 1 ? 'attempt' : 'attempts'
        } left.`;
      }
      return "That code doesn't match. Request a fresh one below.";
    case 'code-expired-or-invalid':
      return 'That code has expired or was already used. Tap Resend code below.';
    case 'email-already-registered':
      return 'An account already exists for this email — sign in instead.';
    case 'provision-failed':
      return body.detail
        ? `Could not create your workspace: ${body.detail}`
        : 'Could not create your workspace — try again in a moment.';
    case 'session-setup-failed':
      return 'We verified your code but could not set up your session. Try signing in directly.';
    default:
      return body.detail ?? `Something went wrong (${status}). Try again.`;
  }
}
