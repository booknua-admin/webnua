'use client';

// =============================================================================
// ConversationShell — the conversational onboarding chat for /sign-up.
//
// Session B owns: turn-1 freeform message → email capture → 6-digit code
// verification → workspace provisioning → session mint → land at turn-2.
//
// Session C extends: AI extraction from turn 1 (with a clarifying-question
// loop when confidence is low), services picker (turn 2), brand picker
// (turn 3), offer iteration (turn 4), generation handoff (turn 5),
// dashboard redirect on completion.
//
// State machine phases:
//   turn-1-input     — bot asks "Tell me what you do and where", user types.
//   awaiting-email   — bot asks for email, user types.
//   awaiting-code    — code requested + sent, user types 6 digits.
//   verifying        — verify-code POST in flight.
//   extracting       — /api/onboarding/extract-business in flight.
//   clarifying       — bot asked a clarifying question, awaiting user reply.
//   turn-2-services  — services checkbox UI mounted.
//   turn-3-brand     — brand picker mounted.
//   turn-4-offer     — offer-iteration card mounted.
//   turn-5-generation — generation in flight or settled.
//   done             — about to redirect to /dashboard.
//
// Persistence: every turn transition POSTs the full conversation_state via
// /api/clients/[id]/conversation-state (per the locked "Save on every turn
// transition" decision). Reloads call GET on mount + resume from the
// stored `current_turn`. Failures surface inline; the shell can advance
// locally even when persistence is down.
//
// Mobile UX:
//   - sticky-bottom composer (ChatComposer)
//   - auto-scroll to bottom on new message (scroll-into-view ref)
//   - keyboard-avoidance via visualViewport listener
//   - 44px tap targets on every action
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChatBubble } from '@/components/shared/conversation/ChatBubble';
import { ChatBrandPicker } from '@/components/shared/conversation/ChatBrandPicker';
import { ChatComposer } from '@/components/shared/conversation/ChatComposer';
import {
  ChatGenerationBubble,
  type GenerationStatus,
} from '@/components/shared/conversation/ChatGenerationBubble';
import { ChatOfferCard } from '@/components/shared/conversation/ChatOfferCard';
import { ChatServicePicker } from '@/components/shared/conversation/ChatServicePicker';
import { TypingIndicator } from '@/components/shared/conversation/TypingIndicator';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import {
  EXTRACTION_CONFIDENCE_THRESHOLD,
  OFFER_REFINEMENT_LIMIT,
  type ConversationBrandFacts,
  type ConversationCapturedFacts,
  type ConversationExtraction,
  type ConversationMessage,
  type ConversationOfferRow,
  type ConversationState,
} from '@/lib/onboarding/conversation-types';
import { deriveBriefFromConversation } from '@/lib/onboarding/derive-brief';
import { runConversationGeneration } from '@/lib/onboarding/trigger-generation';
import { supabase } from '@/lib/supabase/client';
import {
  INDUSTRY_TEMPLATES,
  resolveIndustryTemplate,
  type IndustryKey,
} from '@/lib/website/industry-templates';
import {
  generateFunnelOffer,
  offerToRow,
  type FunnelOffer,
} from '@/lib/website/offer-generate';
import { derivePalette } from '@/lib/website/color-derivation';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// types

type Author = 'bot' | 'user';

type LocalChatMessage = {
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
  | 'extracting'
  | 'clarifying'
  | 'turn-2-services'
  | 'turn-3-brand'
  | 'turn-4-offer'
  | 'turn-5-generation'
  | 'done';

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

type ExtractResponse = {
  extraction?: ConversationExtraction;
  error?: string;
  detail?: string;
};

// ---------------------------------------------------------------------------
// bot copy

// FIX (Session X — conversational critical fixes): bot copy rewrite to
// honest expectations framing + direct/clear voice. The previous strings
// were chatty and performative; the new ones tell the customer what's
// happening and what's next, briefly. Three principles:
//   1. Direct, not performative — no enthusiasm-acting.
//   2. Brief — short acknowledgments, no filler.
//   3. Clear about what's coming next.
// Also fixed: hardcoded HTML entities (`&apos;`) — these render literally
// inside chat bubbles since the strings are read as plain text, not parsed
// as HTML. Use a real apostrophe.
const BOT_TURN1 =
  "Hey — I'm here to get your site set up. I'll ask a few quick questions about your business so we can build your site right first time. You can edit anything later. To start, what do you do and where?";
const BOT_ASK_EMAIL = "What's your email? I'll send a 6-digit code to verify.";
const BOT_CODE_SENT = (email: string) =>
  `Code sent to ${email}. Type the 6 digits below — it expires in 10 minutes.`;
const BOT_POST_VERIFY = "Verified. Reading what you told me…";
const BOT_EXTRACTION_DONE = (e: ConversationExtraction) => {
  // "Got it — painter in Cork. Now your services." (industry + location
  // interpolation). Brief and direct.
  const industryLine = e.industryFreeText ?? prettyIndustry(e.industry).toLowerCase();
  const tail = e.location ? ` in ${e.location}` : '';
  return `Got it — ${industryLine}${tail}. Now your services.`;
};
const BOT_TURN2_PROMPT =
  "Tick the services you offer. We'll build your site around these.";
const BOT_SERVICES_DONE = "Saved. Now your brand colors.";
const BOT_TURN3_PROMPT =
  "Brand colors and logo next. Both optional.";
const BOT_BRAND_DONE = "Locked in. Generating your offer next.";
const BOT_TURN4_PROMPT =
  "Here's a draft marketing offer for your landing page. Use it, refine it, or write your own.";
// BOT_OFFER_DONE doubles as the turn-5 framing — the generation card
// renders its own status, so we don't need a separate "building now" bubble.
const BOT_OFFER_DONE = "Offer locked. Building your site now — takes about a minute.";

const RESEND_AVAILABLE_AFTER_MS = 10_000;

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function prettyIndustry(key: IndustryKey): string {
  const template = INDUSTRY_TEMPLATES[key];
  return template?.displayName ?? key;
}

// =============================================================================
// shell
// =============================================================================

export function ConversationShell() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('turn-1-input');
  const [messages, setMessages] = useState<LocalChatMessage[]>([
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

  // Session C state — populated after verification.
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSlug, setClientSlug] = useState<string | null>(null);
  const [capturedFacts, setCapturedFacts] = useState<ConversationCapturedFacts>({});
  const [extraction, setExtraction] = useState<ConversationExtraction | null>(null);
  // Per-turn local state — these are derived from / write into capturedFacts
  // but kept separately so the turn UIs stay responsive without each keystroke
  // costing a round-trip.
  const [offerInFlight, setOfferInFlight] = useState<FunnelOffer | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  // Generation status (turn 5).
  const [genStatus, setGenStatus] = useState<GenerationStatus>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [genSoftError, setGenSoftError] = useState<string | null>(null);

  // Ref guards — once-only effects.
  const hydratedRef = useRef(false);
  const extractionStartedRef = useRef(false);
  const initialOfferStartedRef = useRef(false);
  const generationStartedRef = useRef(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ---- helpers -----------------------------------------------------------
  const appendMessage = useCallback((author: Author, text: string) => {
    setMessages((prev) => [...prev, { id: newId(author), author, text }]);
  }, []);

  // Persist conversation_state to the server. Fire-and-forget at the call
  // site — the local React state already advanced, so a persistence failure
  // shows inline but doesn't block forward progress. The route validates +
  // upserts; the optimistic-concurrency check is opt-in (we don't use it —
  // the chat surface is single-tab in practice).
  const persistState = useCallback(
    async (next: {
      capturedFacts: ConversationCapturedFacts;
      current_turn: number;
      messages: LocalChatMessage[];
    }) => {
      if (!clientId) return; // pre-verify; nothing to persist.
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const payload: ConversationState = {
          messages: next.messages.map(
            (m): ConversationMessage => ({
              id: m.id,
              role: m.author,
              content: m.text,
              timestamp: new Date().toISOString(),
            }),
          ),
          capturedFacts: next.capturedFacts,
          current_turn: next.current_turn,
          verified: true,
        };
        await fetch(`/api/clients/${clientId}/conversation-state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('[sign-up] conversation-state persist failed', e);
      }
    },
    [clientId],
  );

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

  useEffect(() => {
    if (phase !== 'awaiting-code') return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // ---- resume effect ----------------------------------------------------
  // On mount, if the customer is already authenticated (refresh after
  // verify, possibly mid-flow), hydrate conversation_state and resume.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;
      const metadataClientId =
        typeof session.user.user_metadata?.client_id === 'string'
          ? (session.user.user_metadata.client_id as string)
          : null;
      if (!metadataClientId) return;

      const token = session.access_token;
      try {
        const res = await fetch(`/api/clients/${metadataClientId}/conversation-state`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { state?: ConversationState };
        const state = body.state;
        if (!state || !state.verified) return;

        // Hydrate local state from the persisted thread.
        setClientId(metadataClientId);
        const slug =
          typeof state.capturedFacts.clientSlug === 'string'
            ? state.capturedFacts.clientSlug
            : null;
        if (slug) setClientSlug(slug);
        else {
          // Fallback — query the clients row directly (RLS-scoped to own).
          const { data: clientRow } = await supabase
            .from('clients')
            .select('slug')
            .eq('id', metadataClientId)
            .maybeSingle();
          const fallbackSlug = (clientRow as { slug?: string } | null)?.slug ?? null;
          if (fallbackSlug) setClientSlug(fallbackSlug);
        }
        setCapturedFacts(state.capturedFacts);
        if (state.capturedFacts.email) setEmail(state.capturedFacts.email);
        if (state.capturedFacts.extraction) {
          setExtraction(state.capturedFacts.extraction);
        }
        if (state.capturedFacts.firstMessage) {
          setFirstMessage(state.capturedFacts.firstMessage);
        }
        // businessName hydrates via capturedFacts directly (the deriver
        // reads it from there for generation). No separate state slot.
        // Hydrate messages — the route stores them as { id, role, content,
        // timestamp }; map back to the local Author shape.
        setMessages(
          state.messages
            .filter((m): m is ConversationMessage => Boolean(m && m.id && m.content))
            .map(
              (m): LocalChatMessage => ({
                id: m.id,
                author: m.role === 'user' ? 'user' : 'bot',
                text: m.content,
              }),
            ),
        );

        // Resume at the persisted current_turn.
        switch (state.current_turn) {
          case 2:
            // Verified but services not yet picked. If extraction is in
            // capturedFacts, jump to turn-2 services; otherwise run
            // extraction now.
            if (state.capturedFacts.extraction) {
              setPhase('turn-2-services');
            } else if (state.capturedFacts.firstMessage) {
              setPhase('extracting');
              // The post-verify effect will fire the extraction call.
            } else {
              // Edge case: state is partial. Restart the flow conservatively.
              setPhase('turn-1-input');
            }
            break;
          case 3:
            setPhase('turn-3-brand');
            break;
          case 4:
            setPhase('turn-4-offer');
            break;
          case 5:
            setPhase('turn-5-generation');
            break;
          case 6:
            // Already past generation — route them straight to the dashboard.
            router.push('/dashboard');
            return;
          default:
            // No usable resume state — start fresh.
            break;
        }
      } catch (e) {
        console.warn('[sign-up] resume hydration failed', e);
      }
    })();
  }, [router]);

  // ---- turn-1: capture the freeform answer ------------------------------
  const handleTurn1Send = useCallback(
    async (text: string) => {
      if (phase !== 'turn-1-input') return;
      setFirstMessage(text);
      appendMessage('user', text);
      setError(null);
      setBotThinking(true);
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
        setInfo(
          body.message ?? 'We had trouble sending your code — tap Resend below to try again.',
        );
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
      appendMessage('bot', 'Fresh code sent.');
    }
  }, [appendMessage, email, requestCode, resendReadyAt]);

  // ---- code verification → kick off extraction --------------------------
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

      if (
        !response.ok ||
        !body.success ||
        !body.email ||
        !body.password ||
        !body.clientId ||
        !body.clientSlug
      ) {
        setError(describeVerifyError(body, response.status));
        setBotThinking(false);
        setPhase('awaiting-code');
        if (body.error === 'wrong-code' || body.error === 'code-expired-or-invalid') {
          setCode(['', '', '', '', '', '']);
        }
        return;
      }

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

      setClientId(body.clientId);
      setClientSlug(body.clientSlug);
      appendMessage('bot', BOT_POST_VERIFY);
      setBotThinking(false);
      // Transition to 'extracting'. The phase-change effect below picks
      // this up on the next render (when setClientId has also settled)
      // and fires runExtraction.
      setPhase('extracting');
    },
    [appendMessage, email, firstMessage],
  );

  // ---- 6-digit input -----------------------------------------------------
  const setDigit = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/\D/g, '');
      if (cleaned.length > 1) {
        setCode((prev) => {
          const next = [...prev];
          for (let i = 0; i < 6 - index; i += 1) {
            next[index + i] = cleaned[i] ?? next[index + i];
          }
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

  // ---- extraction (post-verify) -----------------------------------------
  // `handleExtractionDone` is declared FIRST so `runExtraction` can close
  // over it cleanly. Each appends two-or-three new bot messages, updates
  // capturedFacts, persists, and advances the phase.

  // Write the AI-extracted business name to clients.name + re-slugify the
  // workspace URL. Fire-and-forget — failures surface in console but don't
  // block forward progress (the email-derived placeholder still works as a
  // fallback name + slug). Updates clientSlug local state on success so the
  // generation handoff uses the new slug.
  const persistBusinessIdentity = useCallback(
    async (businessName: string) => {
      if (!clientId || !businessName.trim()) return;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/clients/${clientId}/business-identity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ businessName: businessName.trim() }),
        });
        if (!res.ok) {
          console.warn(
            `[sign-up] business-identity update failed (${res.status})`,
          );
          return;
        }
        const body = (await res.json()) as { slug?: string; name?: string };
        if (typeof body.slug === 'string' && body.slug.length > 0) {
          setClientSlug(body.slug);
        }
      } catch (e) {
        console.warn('[sign-up] business-identity network error', e);
      }
    },
    [clientId],
  );

  const handleExtractionDone = useCallback(
    async (e: ConversationExtraction) => {
      setExtraction(e);
      if (e.confidence < EXTRACTION_CONFIDENCE_THRESHOLD && e.ambiguities.length > 0) {
        const question = composeClarifyingQuestion(e);
        const nextFacts: ConversationCapturedFacts = {
          ...capturedFacts,
          firstMessage,
          email,
          clientSlug: clientSlug ?? capturedFacts.clientSlug,
          extraction: e,
          clarifyingQuestion: question,
        };
        const nextMessages: LocalChatMessage[] = [
          ...messages,
          { id: newId('bot'), author: 'bot', text: question },
        ];
        setCapturedFacts(nextFacts);
        setMessages(nextMessages);
        setPhase('clarifying');
        void persistState({
          capturedFacts: nextFacts,
          current_turn: 1,
          messages: nextMessages,
        });
        return;
      }

      // FIX (Session X): fire business-identity update with the extracted
      // name AS SOON AS extraction lands at high-confidence. This rewrites
      // clients.name + the workspace slug from the email-derived placeholder
      // ("Gmail") to the customer's actual business name ("Cork Painters").
      // Fire-and-forget — the call updates local clientSlug state on success
      // so turn-5 generation lands on the right subdomain.
      const extractedName = e.businessName.trim();
      if (extractedName) {
        void persistBusinessIdentity(extractedName);
      }

      const confirmation = BOT_EXTRACTION_DONE(e);
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        firstMessage,
        email,
        // Capture the business name on capturedFacts so deriveBriefFrom
        // Conversation can read it without unpacking extraction, AND so
        // resume hydrates it cleanly.
        businessName: extractedName || capturedFacts.businessName,
        clientSlug: clientSlug ?? capturedFacts.clientSlug,
        extraction: e,
        clarifyingQuestion: undefined,
      };
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        { id: newId('bot'), author: 'bot', text: confirmation },
        { id: newId('bot'), author: 'bot', text: BOT_TURN2_PROMPT },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      setPhase('turn-2-services');
      void persistState({
        capturedFacts: nextFacts,
        current_turn: 2,
        messages: nextMessages,
      });
    },
    [capturedFacts, clientSlug, email, firstMessage, messages, persistState, persistBusinessIdentity],
  );

  const runExtraction = useCallback(
    async (priorMessages?: string[]) => {
      if (!clientId || !firstMessage) return;
      if (extractionStartedRef.current && !priorMessages) return;
      extractionStartedRef.current = true;
      setBotThinking(true);
      const fallback: ConversationExtraction = {
        businessName: '',
        industry: 'generic',
        industryFreeText: null,
        location: '',
        specialty: '',
        teamSize: '',
        yearsInBusiness: '',
        mentionedServices: [],
        confidence: 0,
        ambiguities: [],
      };
      try {
        const res = await fetch('/api/onboarding/extract-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstMessage,
            ...(priorMessages ? { priorAttempt: { messages: priorMessages } } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as ExtractResponse;
        if (!res.ok || !body.extraction) {
          console.warn('[sign-up] extraction failed', body);
          await handleExtractionDone(fallback);
        } else {
          await handleExtractionDone(body.extraction);
        }
      } catch (e) {
        console.warn('[sign-up] extraction network error', e);
        await handleExtractionDone(fallback);
      } finally {
        setBotThinking(false);
      }
    },
    [clientId, firstMessage, handleExtractionDone],
  );

  // Fire the extraction once we land in 'extracting' for the first time.
  // The once-only guard lives inside runExtraction (set after `setBotThinking`
  // so a guarded re-entry doesn't toggle the typing indicator). The lint's
  // "setState in effect via async call" trigger is the legitimate pattern
  // for kicking off an async API call when an external state value
  // (`phase`) changes — same shape as the wizard-shell's initial-mount
  // generation trigger; disabled inline.
  useEffect(() => {
    if (phase !== 'extracting') return;
    if (!clientId || !firstMessage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runExtraction();
  }, [phase, clientId, firstMessage, runExtraction]);

  // ---- clarifying-question reply ----------------------------------------
  // Re-extract with the clarifying answer concatenated. `runExtraction`
  // bypasses its once-only guard when `priorMessages` is supplied, so the
  // ref doesn't need a reset here.
  const handleClarifyingReply = useCallback(
    async (text: string) => {
      if (phase !== 'clarifying') return;
      appendMessage('user', text);
      setPhase('extracting');
      const question = capturedFacts.clarifyingQuestion ?? '';
      const priorMessages = [firstMessage, question, text].filter(Boolean);
      // Slight delay so the user message renders before the typing indicator.
      await new Promise((r) => setTimeout(r, 250));
      void runExtraction(priorMessages);
    },
    [appendMessage, capturedFacts.clarifyingQuestion, firstMessage, phase, runExtraction],
  );

  // ---- turn 2: services -------------------------------------------------
  const advanceToTurn3 = useCallback(
    (services: string[]) => {
      const nextFacts: ConversationCapturedFacts = { ...capturedFacts, services };
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        {
          id: newId('user'),
          author: 'user',
          text:
            services.length > 0
              ? services.length === 1
                ? `Just one for now: ${services[0]}`
                : `${services.length} services picked`
              : '(no services picked)',
        },
        // Brief acknowledgment + transition to next step.
        { id: newId('bot'), author: 'bot', text: BOT_SERVICES_DONE },
        { id: newId('bot'), author: 'bot', text: BOT_TURN3_PROMPT },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      setPhase('turn-3-brand');
      void persistState({
        capturedFacts: nextFacts,
        current_turn: 3,
        messages: nextMessages,
      });
    },
    [capturedFacts, messages, persistState],
  );

  // ---- turn 3: brand ----------------------------------------------------
  const advanceToTurn4 = useCallback(
    async (brand: ConversationBrandFacts | null) => {
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        brand: brand ?? undefined,
      };
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        {
          id: newId('user'),
          author: 'user',
          text: brand
            ? `Brand colour ${brand.primaryColor}${brand.logoUrl ? ' + logo uploaded' : ''}`
            : '(brand skipped — use the industry default)',
        },
        // Brief acknowledgment + transition.
        { id: newId('bot'), author: 'bot', text: BOT_BRAND_DONE },
        { id: newId('bot'), author: 'bot', text: BOT_TURN4_PROMPT },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      setPhase('turn-4-offer');

      // Write through to the brands row so generation picks up the values
      // when it fires from turn 5. Fire-and-forget — failures are logged
      // and the offer / generation flow continues with whatever the brand
      // editor saves later. Mirrors Step4Brand's brand-update shape.
      if (brand && clientId) {
        const industryKey: IndustryKey = extraction?.industry ?? 'generic';
        const palette = derivePalette({
          primary: brand.primaryColor,
          secondary: brand.secondaryColor,
          industry: industryKey,
        });
        void supabase
          .from('brands')
          .update({
            accent_color: brand.primaryColor,
            brand_colors: [brand.primaryColor, brand.secondaryColor ?? '']
              .filter(Boolean),
            derived_palette: palette as never,
            ...(brand.logoUrl ? { logo_url: brand.logoUrl } : {}),
          } as never)
          .eq('client_id', clientId)
          .then(({ error: brandErr }) => {
            if (brandErr) console.warn('[sign-up] brand write failed', brandErr.message);
          });
      }

      void persistState({
        capturedFacts: nextFacts,
        current_turn: 4,
        messages: nextMessages,
      });
    },
    [capturedFacts, clientId, extraction?.industry, messages, persistState],
  );

  // ---- turn 4: offer ----------------------------------------------------
  const offerInputs = useMemo(() => {
    const template = extraction
      ? resolveIndustryTemplate(extraction.industry)
      : null;
    const services = capturedFacts.services ?? template?.defaultServices ?? [];
    const funnelService = services[0] || template?.defaultServices[0] || 'Get in touch for a quote';
    const specialty = extraction?.specialty?.trim() || '';
    const audience = specialty
      ? `A customer looking for ${specialty}`
      : 'A customer';
    const industryDisplay = template?.displayName ?? extraction?.industry ?? 'this business';
    const customerPain = (() => {
      switch (template?.urgencyMode) {
        case 'emergency-callout':
          return `${audience} hits an urgent problem and needs a ${industryDisplay.toLowerCase()} on site today.`;
        case 'scheduled':
          return `${audience} wants ${industryDisplay.toLowerCase()} work done on a reliable schedule.`;
        case 'project':
          return `${audience} is planning a ${industryDisplay.toLowerCase()} project and needs a quote they can trust.`;
        case 'mixed':
        default:
          return `${audience} needs ${industryDisplay.toLowerCase()} work done — sometimes urgent, sometimes planned.`;
      }
    })();
    const guarantee =
      template?.objectionHandlers[0]?.response ||
      'Fixed-price quote before any work starts.';
    return {
      industry: industryDisplay,
      serviceArea: extraction?.location?.trim() || '',
      funnelService,
      funnelCustomerPain: customerPain,
      funnelGuarantee: guarantee,
    };
  }, [capturedFacts.services, extraction]);

  const callOfferGenerator = useCallback(async () => {
    initialOfferStartedRef.current = true;
    setOfferLoading(true);
    setOfferError(null);
    try {
      const offer = await generateFunnelOffer(offerInputs);
      setOfferInFlight(offer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOfferError(msg);
    } finally {
      setOfferLoading(false);
    }
  }, [offerInputs]);

  // Initial offer generation when we enter turn 4 — only fires when the
  // customer doesn't already have a persisted offer (resume case feeds
  // the picker via the `displayedOffer` derivation below). The once-only
  // guard lives inside `callOfferGenerator` (refs are written inside
  // callbacks, not effects).
  useEffect(() => {
    if (phase !== 'turn-4-offer') return;
    if (initialOfferStartedRef.current) return;
    if (capturedFacts.offer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void callOfferGenerator();
  }, [phase, capturedFacts.offer, callOfferGenerator]);

  // Render-time derivation: prefer the freshly-generated offer (in-flight
  // local state) over the persisted one. Keeps the offer card in sync
  // through a resume + a subsequent refine without ever calling setState
  // from an effect.
  const displayedOffer: FunnelOffer | null =
    offerInFlight ??
    (capturedFacts.offer
      ? {
          headline: capturedFacts.offer.headline,
          promise: capturedFacts.offer.promise,
          riskReversal: capturedFacts.offer.risk_reversal,
          ctaText: capturedFacts.offer.cta_text,
        }
      : null);

  const advanceToTurn5 = useCallback(
    (offer: FunnelOffer | null) => {
      const offerRow: ConversationOfferRow | null = offer ? offerToRow(offer) : null;
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        offer: offerRow,
      };
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        {
          id: newId('user'),
          author: 'user',
          text: offer
            ? `Offer locked: "${offer.headline}"`
            : '(offer skipped — placeholder copy will sit here)',
        },
        // Brief acknowledgment + transition. BOT_OFFER_DONE doubles as the
        // turn-5 framing; no separate BOT_TURN5_PROMPT bubble (the
        // generation card itself shows status).
        { id: newId('bot'), author: 'bot', text: BOT_OFFER_DONE },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      setPhase('turn-5-generation');
      void persistState({
        capturedFacts: nextFacts,
        current_turn: 5,
        messages: nextMessages,
      });
    },
    [capturedFacts, messages, persistState],
  );

  const handleOfferRefine = useCallback(async () => {
    const used = capturedFacts.offerRefinementsUsed ?? 0;
    if (used >= OFFER_REFINEMENT_LIMIT) return;
    const nextFacts: ConversationCapturedFacts = {
      ...capturedFacts,
      offerRefinementsUsed: used + 1,
    };
    setCapturedFacts(nextFacts);
    // Persist the counter immediately so a refresh mid-refine doesn't
    // "give back" the refinement.
    void persistState({
      capturedFacts: nextFacts,
      current_turn: 4,
      messages,
    });
    await callOfferGenerator();
  }, [capturedFacts, callOfferGenerator, messages, persistState]);

  // ---- turn 5: generation ----------------------------------------------
  const runGeneration = useCallback(async () => {
    if (generationStartedRef.current) return;
    generationStartedRef.current = true;
    if (!clientId || !clientSlug) {
      setGenStatus('failed');
      setGenError('Missing client context — please refresh and try again.');
      generationStartedRef.current = false;
      return;
    }
    setGenStatus('running');
    setGenError(null);
    setGenSoftError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setGenStatus('failed');
      setGenError('Not signed in — please refresh and verify again.');
      return;
    }

    const brief = deriveBriefFromConversation({
      capturedFacts,
      email,
      fallbackBusinessName:
        extraction?.industryFreeText?.trim() ||
        (extraction ? prettyIndustry(extraction.industry) : 'My business'),
    });

    // No onProgress sink — stage progression inside ChatGenerationBubble
    // is timer-driven, not event-driven. Real event-streaming is a
    // separate session (per the GenerationSplash comment); the
    // GenerationProgressEvent type is exported but not consumed here.
    const result = await runConversationGeneration({
      clientId,
      clientSlug,
      token,
      brief,
    });

    if (!result.ok) {
      setGenStatus('failed');
      setGenError(result.error);
      // Allow retry — clear the once-only guard.
      generationStartedRef.current = false;
      return;
    }
    setGenStatus('ready');
    if (result.softError) setGenSoftError(result.softError);
    // Mark conversation_state as "post-generation" (current_turn = 6) so a
    // subsequent visit redirects straight to the dashboard.
    void persistState({
      capturedFacts,
      current_turn: 6,
      messages,
    });
    // FIX (Session X): Mark the wizard complete so the dashboard's gate
    // doesn't bounce this customer to /onboarding (the 7-step legacy wizard).
    // The conversational flow IS the onboarding wizard — wizard_completed_at
    // is the canonical "onboarding done" flag the dashboard reads.
    // Fire-and-forget — the dashboard re-checks every navigation and will
    // pick up the flag on the redirect from this page.
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/wizard-state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          // No `state` field — we don't want to clobber wizard_state with
          // our null. Just stamp wizard_completed_at.
          body: JSON.stringify({ complete: true }),
        });
        if (!res.ok) {
          console.warn(
            `[sign-up] wizard-state complete stamp failed (${res.status})`,
          );
        }
      } catch (e) {
        console.warn('[sign-up] wizard-state complete network error', e);
      }
    })();
  }, [capturedFacts, clientId, clientSlug, email, extraction, messages, persistState]);

  // Trigger generation when we enter turn 5. Once-only guard inside
  // runGeneration itself; the effect just dispatches.
  useEffect(() => {
    if (phase !== 'turn-5-generation') return;
    if (generationStartedRef.current) return;
    void runGeneration();
  }, [phase, runGeneration]);

  const handleGenerationRetry = useCallback(() => {
    // Reset the guard so runGeneration's internal check lets a fresh
    // attempt through.
    generationStartedRef.current = false;
    void runGeneration();
  }, [runGeneration]);

  const handleGenerationContinue = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // ---- render slots ------------------------------------------------------
  const resendSecondsLeft = Math.max(0, Math.ceil((resendReadyAt - nowMs) / 1000));
  const canResend = phase === 'awaiting-code' && resendSecondsLeft <= 0;

  const showTurn1Composer = phase === 'turn-1-input';
  const showClarifyingComposer = phase === 'clarifying';

  const industryForBrandStep: IndustryKey = extraction?.industry ?? 'generic';
  const servicesCatalogue = extraction
    ? resolveIndustryTemplate(extraction.industry).defaultServices
    : INDUSTRY_TEMPLATES.generic.defaultServices;
  const industryDisplay = extraction
    ? prettyIndustry(extraction.industry)
    : 'Your business';

  return (
    <div className="fixed inset-0 flex w-full flex-col bg-paper">
      <div className="flex items-center justify-center gap-3 border-b border-rule bg-paper px-4 py-3">
        <BrandMark size="default" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
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
                    className="min-h-[44px] text-base sm:text-[14px]"
                  />
                  <button
                    type="submit"
                    disabled={botThinking}
                    className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper hover:bg-rust-deep disabled:opacity-50"
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
                      {canResend ? 'Resend code' : `Resend in ${resendSecondsLeft}s`}
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

          {phase === 'turn-2-services' ? (
            <ChatBubble
              author="bot"
              rich={
                <ChatServicePicker
                  industryName={industryDisplay}
                  options={servicesCatalogue}
                  preTicked={extraction?.mentionedServices ?? []}
                  initial={capturedFacts.services}
                  onSubmit={(services) => advanceToTurn3(services)}
                  onSkip={() => advanceToTurn3([])}
                />
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {phase === 'turn-3-brand' ? (
            <ChatBubble
              author="bot"
              rich={
                <ChatBrandPicker
                  industryKey={industryForBrandStep}
                  initial={capturedFacts.brand ?? null}
                  onSubmit={(brand) => void advanceToTurn4(brand)}
                  onSkip={() => void advanceToTurn4(null)}
                />
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {phase === 'turn-4-offer' ? (
            <ChatBubble
              author="bot"
              rich={
                <ChatOfferCard
                  offer={displayedOffer}
                  refinementsUsed={capturedFacts.offerRefinementsUsed ?? 0}
                  loading={offerLoading}
                  error={offerError}
                  onAccept={(o) => advanceToTurn5(o)}
                  onRefine={() => void handleOfferRefine()}
                  onUseMyOwn={(o) => advanceToTurn5(o)}
                  onSkip={() => advanceToTurn5(null)}
                />
              }
            >
              {null}
            </ChatBubble>
          ) : null}

          {phase === 'turn-5-generation' ? (
            <ChatBubble
              author="bot"
              rich={
                <ChatGenerationBubble
                  status={genStatus}
                  errorMessage={genError ?? undefined}
                  softError={genSoftError ?? undefined}
                  onRetry={handleGenerationRetry}
                  onContinue={handleGenerationContinue}
                />
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

      {showTurn1Composer ? (
        <ChatComposer
          placeholder="e.g. I'm a sparkie in Cottesloe doing residential rewires."
          disabled={botThinking}
          sendLabel="Send"
          onSend={handleTurn1Send}
        />
      ) : null}
      {showClarifyingComposer ? (
        <ChatComposer
          placeholder="Type your answer…"
          disabled={botThinking}
          sendLabel="Send"
          onSend={handleClarifyingReply}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers

/** Build a clarifying question from the model's ambiguities list. We take
 *  the first ambiguity (the model lists them in priority order) and frame
 *  it as a single sentence the bot can ask. Keeps the chat momentum.
 *
 *  The model returns ambiguities as either:
 *    - "industry — \"do houses\" could be cleaning, painting, or builder"
 *    - "which side of HVAC — heating only, cooling only, or both"
 *  We strip the leading "key — " framing for a cleaner question. */
function composeClarifyingQuestion(e: ConversationExtraction): string {
  const first = e.ambiguities[0]?.trim();
  if (!first) {
    return "I want to make sure I got that right — could you tell me a bit more about your trade and where you work?";
  }
  // Pull out the explanation half if the model used "key — explanation".
  const dash = first.indexOf('—');
  const body = dash > -1 ? first.slice(dash + 1).trim() : first;
  return `One quick thing — ${body}?`;
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
