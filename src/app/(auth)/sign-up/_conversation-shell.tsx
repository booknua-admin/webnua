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
import { ChatOfferCard } from '@/components/shared/conversation/ChatOfferCard';
import { ChatRefuseScreen } from '@/components/shared/conversation/ChatRefuseScreen';
import { ChatServicePicker } from '@/components/shared/conversation/ChatServicePicker';
import { ChatThinkingPhases } from '@/components/shared/conversation/ChatThinkingPhases';
import { SpecSheet } from '@/components/shared/conversation/SpecSheet';
import { TypingIndicator } from '@/components/shared/conversation/TypingIndicator';
import {
  GenerationBlueprint,
  type BlueprintPhase,
} from '@/components/shared/onboarding/GenerationBlueprint';
import { BrandMark } from '@/components/ui/BrandMark';
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
  type RefuseReason,
} from '@/lib/onboarding/conversation-types';
import { deriveBriefFromConversation } from '@/lib/onboarding/derive-brief';
import { resolveIndustryKnowledge } from '@/lib/onboarding/industry-knowledge';
import {
  runConversationGeneration,
  type GenerationProgressEvent,
} from '@/lib/onboarding/trigger-generation';
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
  | 'awaiting-business-name'
  | 'awaiting-knowledge'
  | 'turn-2-services'
  | 'turn-3-brand'
  | 'turn-4-offer'
  | 'turn-5-generation'
  | 'refused'
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

type ExtractResponse =
  | {
      refused: true;
      refuseReason: RefuseReason;
    }
  | {
      refused: false;
      extraction: ConversationExtraction;
    }
  | {
      // 4xx / 5xx body shape — no `refused` key, just error metadata.
      refused?: undefined;
      extraction?: undefined;
      error?: string;
      detail?: string;
    };

// ---------------------------------------------------------------------------
// bot copy
//
// Voice: direct, brief, honest. The previous strings were performative
// ("Great." "We're building…"); these tell the customer what's happening
// and what's next. Three principles:
//   1. Direct, not performative — no enthusiasm-acting.
//   2. Brief — short acknowledgments, no filler.
//   3. Clear about what's coming next.
// Also fixed: hardcoded HTML entities (`&apos;`) render literally inside
// chat bubbles since the strings are read as plain text.

const BOT_TURN1 =
  "Hey — I'm here to get your site set up. I'll ask a few quick questions about your business so we can build it right first time. You can edit anything later. To start, what do you do and where?";
const BOT_ASK_EMAIL = "What's your email? I'll send a 6-digit code to verify.";
const BOT_CODE_SENT = (email: string) =>
  `Code sent to ${email}. Type the 6 digits below — it expires in 10 minutes.`;
const BOT_POST_VERIFY = "Verified. Reading what you told me…";
const BOT_EXTRACTION_DONE = (e: ConversationExtraction) => {
  // "Got it — painter in Cork. Now your services." Brief and direct.
  const industryLine = e.industryFreeText ?? prettyIndustry(e.industry).toLowerCase();
  const tail = e.location ? ` in ${e.location}` : '';
  return `Got it — ${industryLine}${tail}. Now your services.`;
};
/** Compose the business-name ask. When the extraction surfaced a derived
 *  name we drop it into the suggestion ("even 'Cork Painters' works");
 *  otherwise stay generic. The customer answers freeform — empty / 'skip'
 *  / 'no' falls back to the derived name. */
const BOT_ASK_BUSINESS_NAME = (suggested: string): string => {
  const hint = suggested
    ? `Just keep it simple — even "${suggested}" works if that's how you trade.`
    : "Just keep it simple — even your own name works if that's how you trade.";
  return `What's your business called? ${hint}`;
};
/** First bubble after business-name submit — the customer sees this RIGHT
 *  before the ChatThinkingPhases card mounts. Honest about the wait
 *  ("one moment") without padding the bubble with stale specifics — the
 *  thinking card carries the per-business detail. */
const BOT_NAME_SAVED = (name: string) =>
  `Saved as "${name}". One moment — looking up how businesses like yours typically present online…`;
/** Second bubble — appears when the AI knowledge call resolves (or when
 *  the max-wait timer fires), right before the services picker mounts.
 *  Interpolates the business descriptor so it reads as bespoke; falls
 *  back to "businesses like yours" when descriptor is empty. */
const BOT_HERE_ARE_SERVICES = (businessLabel: string): string => {
  const trimmed = businessLabel.trim();
  if (trimmed) {
    return `Here's what we found for ${trimmed.toLowerCase()} businesses. Tick what you offer — we'll build around these.`;
  }
  return "Here's what businesses like yours typically offer. Tick what you offer — we'll build around these.";
};
const BOT_SERVICES_DONE = "Saved. Now your brand colors.";
const BOT_TURN3_PROMPT = "Brand colors and logo next. Both optional.";
const BOT_BRAND_DONE = "Locked in. Generating your offer next.";
const BOT_TURN4_PROMPT =
  "Here's a draft marketing offer for your landing page. Use it, refine it, or write your own.";
// BOT_OFFER_DONE doubles as the turn-5 framing — the GenerationBlueprint
// renders its own fullscreen status, so we don't need a separate "building
// now" bubble (the blueprint takes over the entire viewport).
const BOT_OFFER_DONE = "Offer locked. Building your site now — takes about a minute.";

const RESEND_AVAILABLE_AFTER_MS = 10_000;

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function prettyIndustry(key: IndustryKey): string {
  const template = INDUSTRY_TEMPLATES[key];
  return template?.displayName ?? key;
}

// Phase → "// 0X — STEP LABEL" mapping for the shell header. The chat
// reads as an architect's intake; numbering every step makes the moves
// explicit. Numbers match the GenerationBlueprint header rhythm
// ("// step 5 of 5 · building").
function phaseToStepLabel(phase: Phase): string {
  switch (phase) {
    case 'turn-1-input':
    case 'extracting':
    case 'clarifying':
      return '// step 1 of 5 · what you do';
    case 'awaiting-email':
    case 'requesting-code':
    case 'awaiting-code':
    case 'verifying':
      return '// step 2 of 5 · verify email';
    case 'awaiting-business-name':
      return '// step 3 of 5 · your business';
    case 'awaiting-knowledge':
      return '// step 3 of 5 · researching your business';
    case 'turn-2-services':
      return '// step 3 of 5 · services';
    case 'turn-3-brand':
      return '// step 4 of 5 · brand';
    case 'turn-4-offer':
      return '// step 4 of 5 · offer';
    case 'turn-5-generation':
      return '// step 5 of 5 · building';
    case 'refused':
    case 'done':
      return '// Webnua platform';
    default:
      return '// Webnua platform';
  }
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
  // Refusal state — populated when the extraction step classified the business
  // as restaurant or ecom. Drives the `refused` phase + the `ChatRefuseScreen`
  // render branch. Persisted to capturedFacts so resume re-mounts the screen.
  const [refusedReason, setRefusedReason] = useState<RefuseReason | null>(null);
  // Per-turn local state — these are derived from / write into capturedFacts
  // but kept separately so the turn UIs stay responsive without each keystroke
  // costing a round-trip.
  const [offerInFlight, setOfferInFlight] = useState<FunnelOffer | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  // Generation phase (turn 5) — drives the GenerationBlueprint fullscreen
  // overlay. `phase` tracks the real progress event from
  // runConversationGeneration's onProgress callback, not the visual cursor;
  // the blueprint clamps text-stage rendering to whichever is more
  // conservative (visual cursor vs the highest unlocked-at index per phase).
  const [genPhase, setGenPhase] = useState<BlueprintPhase>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [genSoftError, setGenSoftError] = useState<string | null>(null);
  // attemptId — bumped on every Retry so the blueprint's internal cursor
  // resets without forcing a wholesale remount of the component tree.
  const [genAttemptId, setGenAttemptId] = useState(0);

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
        // Refusal is a terminal state — re-mount the RefuseScreen regardless
        // of which turn was last persisted.
        const persistedRefuseReason = (state.capturedFacts as { refusedReason?: unknown })
          .refusedReason;
        if (
          persistedRefuseReason === 'restaurant' ||
          persistedRefuseReason === 'ecom'
        ) {
          setRefusedReason(persistedRefuseReason);
          setPhase('refused');
          return;
        }
        switch (state.current_turn) {
          case 2:
            // Verified but services not yet picked. Three sub-states under
            // current_turn=2:
            //   - extraction present + businessNameConfirmedAt present
            //     → customer confirmed the name, on services picker.
            //   - extraction present + no businessNameConfirmedAt
            //     → customer needs to confirm the business name.
            //   - no extraction but firstMessage present
            //     → run extraction now; post-verify effect handles it.
            //   - neither → state is partial, restart conservatively.
            if (state.capturedFacts.extraction) {
              if (state.capturedFacts.businessNameConfirmedAt) {
                // Business name confirmed. Two sub-states:
                //   - industryKnowledge cached → land directly on the
                //     services picker (turn-2-services).
                //   - industryKnowledge missing → re-enter the
                //     awaiting-knowledge gate. The kick effect below
                //     fires when phase becomes awaiting-knowledge AND
                //     industryKnowledge is missing, so the AI call
                //     re-runs on resume.
                if (state.capturedFacts.industryKnowledge) {
                  setPhase('turn-2-services');
                } else {
                  setPhase('awaiting-knowledge');
                }
              } else {
                setPhase('awaiting-business-name');
              }
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
      appendMessage('bot', 'Fresh code on the way — same 6-digit drill.');
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

      // Fire business-identity update with the extracted name AS SOON AS
      // extraction lands at high-confidence. This rewrites clients.name +
      // the workspace slug from the email-derived placeholder ("Gmail")
      // to the customer's actual business name ("Cork Painters"). The
      // call updates local clientSlug state on success so turn-5
      // generation lands on the right subdomain.
      const extractedName = e.businessName.trim();
      if (extractedName) {
        void persistBusinessIdentity(extractedName);
      }

      const confirmation = BOT_EXTRACTION_DONE(e);
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        firstMessage,
        email,
        // Capture the AI-derived business name on capturedFacts so
        // deriveBriefFromConversation can read it without unpacking
        // extraction, AND so resume hydrates it cleanly. The customer
        // confirms / overrides this on the next turn
        // (`awaiting-business-name`) before services.
        businessName: extractedName || capturedFacts.businessName,
        clientSlug: clientSlug ?? capturedFacts.clientSlug,
        extraction: e,
        clarifyingQuestion: undefined,
      };
      // Insert the explicit business-name capture turn between extraction
      // and the services picker. We send TWO bubbles: the extraction
      // confirmation ("Got it — painter in Cork") + the name ask.
      // Persist `current_turn: 2` so a refresh lands back in this state
      // (the resume branch checks businessNameConfirmedAt to decide
      // business-name vs services).
      const suggestedName = extractedName || capturedFacts.businessName || '';
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        { id: newId('bot'), author: 'bot', text: confirmation },
        { id: newId('bot'), author: 'bot', text: BOT_ASK_BUSINESS_NAME(suggestedName) },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      setPhase('awaiting-business-name');
      void persistState({
        capturedFacts: nextFacts,
        current_turn: 2,
        messages: nextMessages,
      });
    },
    [capturedFacts, clientSlug, email, firstMessage, messages, persistState, persistBusinessIdentity],
  );

  // ---- business-name turn (between extraction + services picker) --------
  // Fires the industry-knowledge AI call in the background and advances to
  // turn-2-services. The call is non-blocking: if Sonnet takes 8 seconds we
  // still let the customer start ticking services — the picker uses the
  // template's defaults as a fallback when industryKnowledge hasn't landed
  // yet, and the funnel/site prompts pick up whichever value is on
  // capturedFacts at turn-5 time. The route never 5xx's (it returns the
  // template/generic fallback as a 200 on every error path), so a
  // background failure becomes silent observable noise, not a UX block.
  const industryKnowledgeFiredRef = useRef(false);
  const kickIndustryKnowledgeCall = useCallback(
    (factsAtFire: ConversationCapturedFacts) => {
      if (industryKnowledgeFiredRef.current) return;
      if (factsAtFire.industryKnowledge) {
        // Already cached (e.g. resumed signup) — nothing to fire.
        industryKnowledgeFiredRef.current = true;
        return;
      }
      const e = factsAtFire.extraction;
      if (!e) return;
      industryKnowledgeFiredRef.current = true;
      const industry = e.industryFreeText?.trim() || e.industry;
      void (async () => {
        try {
          const knowledge = await resolveIndustryKnowledge({
            industry,
            location: e.location?.trim() || undefined,
            specialty: e.specialty?.trim() || undefined,
            businessName: factsAtFire.businessName?.trim() || undefined,
          });
          // Read-then-write — the user may have advanced through more
          // turns while we awaited; preserve their later edits.
          setCapturedFacts((prev) => {
            const merged: ConversationCapturedFacts = {
              ...prev,
              industryKnowledge: knowledge,
            };
            // Persist so a refresh hydrates the cached knowledge.
            void persistState({
              capturedFacts: merged,
              // current_turn stays whatever it is by the time we land — the
              // industry-knowledge write is independent of turn progress.
              current_turn: Math.max(2, /* see below */ 2),
              messages,
            });
            return merged;
          });
        } catch (err) {
          // Silent — the route's fallback path means this should rarely
          // surface, and the picker still works off the template defaults.
          console.warn('[sign-up] industry-knowledge call failed', err);
        }
      })();
    },
    [messages, persistState],
  );

  const handleBusinessNameSubmit = useCallback(
    (rawName: string) => {
      if (phase !== 'awaiting-business-name') return;
      const trimmed = rawName.trim();
      const extracted = (capturedFacts.extraction?.businessName ?? '').trim();
      const derivedFromAI = (capturedFacts.businessName ?? '').trim();
      const fallbackName = derivedFromAI || extracted;

      // Resolution order: customer's typed name (clear) > "just me, [name]"
      // pattern derived as "[Name's] [Trade]" > skip / empty → fallback to
      // the AI-derived name. Casefold tokens so common skip phrases never
      // get captured as a literal business name.
      const lowered = trimmed.toLowerCase();
      const isSkip =
        !trimmed ||
        lowered === 'skip' ||
        lowered === 'no' ||
        lowered === 'none' ||
        lowered === 'n/a' ||
        lowered === '-';

      let resolvedName: string;
      if (isSkip) {
        resolvedName = fallbackName || 'My business';
      } else {
        // "Just me, Bob" / "Trading as Bob" / "Just Bob" → "Bob's [Trade]"
        const justMeMatch = /^(?:just\s+me[,\s]+|just\s+|trading\s+as\s+|under\s+my\s+name[,\s]+)([a-z][a-z'\-\s]+)$/i.exec(trimmed);
        if (justMeMatch) {
          const firstName = justMeMatch[1].trim().split(/\s+/)[0];
          const properName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
          const tradeWord =
            capturedFacts.extraction?.industryDescription?.trim() ||
            capturedFacts.extraction?.industryFreeText?.trim() ||
            (capturedFacts.extraction?.industry
              ? prettyIndustry(capturedFacts.extraction.industry)
              : 'Services');
          resolvedName = `${properName}'s ${tradeWord}`;
        } else {
          resolvedName = trimmed;
        }
      }

      const userBubbleText = isSkip
        ? `(use what you've got — ${fallbackName || 'my business'})`
        : trimmed;

      const confirmedAt = new Date().toISOString();
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        businessName: resolvedName,
        businessNameConfirmedAt: confirmedAt,
      };
      // Just the user echo + the BOT_NAME_SAVED bubble — the services
      // picker prompt is appended LATER, when the awaiting-knowledge
      // phase advances to turn-2-services. This keeps the chat in
      // lockstep with the visual UI: bubbles about services only land
      // when services are actually about to mount.
      const nextMessages: LocalChatMessage[] = [
        ...messages,
        { id: newId('user'), author: 'user', text: userBubbleText },
        { id: newId('bot'), author: 'bot', text: BOT_NAME_SAVED(resolvedName) },
      ];
      setCapturedFacts(nextFacts);
      setMessages(nextMessages);
      // Enter the gated thinking phase — ChatThinkingPhases mounts
      // immediately. A pair of effects below decides when to advance to
      // turn-2-services (minimum show duration + maximum hard timeout
      // + industryKnowledge resolution).
      setPhase('awaiting-knowledge');

      // If the customer's confirmed name differs from the email-derived
      // placeholder OR the AI's earlier derivation, push it to clients.name
      // + re-slugify. The route is idempotent — re-firing with the same
      // value is a no-op. Fire-and-forget; the conversation continues.
      if (resolvedName && resolvedName !== fallbackName) {
        void persistBusinessIdentity(resolvedName);
      }

      // Kick the industry-knowledge AI call. Background — when it
      // resolves it lands on capturedFacts.industryKnowledge and the
      // gate effect picks it up and advances. If it stalls past the
      // max timeout (route hard-failed somehow), the gate advances
      // anyway and the picker uses whatever the route returned (it
      // always returns a 200, even on internal failure, with a
      // template-derived or generic fallback).
      kickIndustryKnowledgeCall(nextFacts);

      void persistState({
        capturedFacts: nextFacts,
        current_turn: 2,
        messages: nextMessages,
      });
    },
    [
      capturedFacts,
      kickIndustryKnowledgeCall,
      messages,
      persistBusinessIdentity,
      persistState,
      phase,
    ],
  );

  // ---- awaiting-knowledge gate ------------------------------------------
  // Two-state flag pair drives the advance from awaiting-knowledge to
  // turn-2-services. `minElapsed` is a fixed "show the thinking surface
  // for at least N ms so it doesn't flash" timer; `maxElapsed` is the
  // hard ceiling that advances regardless of resolution. Advance fires
  // when:
  //   - mapped industry + min elapsed → advance immediately (template
  //     suffices for the picker; the AI call may still be in flight,
  //     but downstream generation reads industryKnowledge when it
  //     eventually lands).
  //   - unmapped industry + min elapsed + industryKnowledge resolved →
  //     advance with the AI services list.
  //   - max elapsed → advance regardless. Picker falls back to whatever
  //     servicesCatalogue resolves to. The route never 5xx's (returns
  //     200 with template/generic fallback on every error path), so by
  //     the time we hit max, capturedFacts.industryKnowledge is usually
  //     present anyway.
  const [knowledgeMinElapsed, setKnowledgeMinElapsed] = useState(false);
  const [knowledgeMaxElapsed, setKnowledgeMaxElapsed] = useState(false);

  // Resume safety: if we land in awaiting-knowledge after a refresh
  // (hydration branch) AND no industryKnowledge is cached AND the call
  // hasn't been kicked yet, fire it now. Without this the gate would
  // sit until the maximum-wait timer fired (12s for unmapped) and then
  // fall through with no AI knowledge.
  useEffect(() => {
    if (phase !== 'awaiting-knowledge') return;
    if (capturedFacts.industryKnowledge) return;
    kickIndustryKnowledgeCall(capturedFacts);
  }, [phase, capturedFacts, kickIndustryKnowledgeCall]);

  // Timer setup — runs once per phase entry. Mapped industries get a
  // short floor (the picker is instant-ready, the thinking surface is
  // brief courtesy framing); unmapped get a longer floor so the AI call
  // has time to land + the customer sees the phases tick through.
  useEffect(() => {
    if (phase !== 'awaiting-knowledge') {
      // Reset the two flags when leaving the phase so the next entry
      // starts fresh. Synchronous reset is the cleanest shape here —
      // the alternative (per-flag tracking + lazy resets) reads worse.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKnowledgeMinElapsed(false);
      setKnowledgeMaxElapsed(false);
      return;
    }
    const isMapped = extraction?.industry !== 'generic';
    const minimumMs = isMapped ? 1800 : 4000;
    const maximumMs = isMapped ? 6000 : 12000;
    const minTimer = window.setTimeout(() => setKnowledgeMinElapsed(true), minimumMs);
    const maxTimer = window.setTimeout(() => setKnowledgeMaxElapsed(true), maximumMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [phase, extraction?.industry]);

  // Advance decision — fires when the timers tick or when knowledge
  // lands. Appends the BOT_HERE_ARE_SERVICES bubble + persists the
  // current_turn=2 stamp (no-op if already 2 from
  // handleBusinessNameSubmit, but keeps the messages list in sync).
  useEffect(() => {
    if (phase !== 'awaiting-knowledge') return;
    const isMapped = extraction?.industry !== 'generic';
    const hasKnowledge = !!capturedFacts.industryKnowledge;
    const canAdvance =
      knowledgeMaxElapsed ||
      (knowledgeMinElapsed && (isMapped || hasKnowledge));
    if (!canAdvance) return;

    // Resolve the descriptor for the bubble — mapped industries read
    // the template's displayName; unmapped read industryFreeText
    // (preserved verbatim from the customer's phrasing).
    const isUnmapped = extraction?.industry === 'generic';
    const descriptor = isUnmapped
      ? (
          extraction?.industryFreeText?.trim() ||
          extraction?.industryDescription?.trim() ||
          ''
        )
      : extraction
        ? prettyIndustry(extraction.industry).toLowerCase()
        : '';
    const nextMessages: LocalChatMessage[] = [
      ...messages,
      { id: newId('bot'), author: 'bot', text: BOT_HERE_ARE_SERVICES(descriptor) },
    ];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(nextMessages);
    setPhase('turn-2-services');
    void persistState({
      capturedFacts,
      current_turn: 2,
      messages: nextMessages,
    });
  }, [
    phase,
    knowledgeMinElapsed,
    knowledgeMaxElapsed,
    capturedFacts,
    extraction,
    messages,
    persistState,
  ]);

  // Refusal handler — fires when the extract step classified the business
  // as restaurant or ecom. Flips the workspace to lifecycle_status='banned'
  // via the refuse-signup route (so the seat is freed), persists the reason
  // onto capturedFacts (so resume re-mounts the refuse screen), and lands
  // the shell in the `refused` phase which renders ChatRefuseScreen.
  const handleRefusal = useCallback(
    async (reason: RefuseReason) => {
      setRefusedReason(reason);
      const refusedAt = new Date().toISOString();
      const nextFacts: ConversationCapturedFacts = {
        ...capturedFacts,
        firstMessage,
        email,
        clientSlug: clientSlug ?? capturedFacts.clientSlug,
        refusedReason: reason,
        refusedAt,
      };
      setCapturedFacts(nextFacts);
      setPhase('refused');

      // Persist capturedFacts (so resume re-mounts the refuse screen even
      // if the ban call below fails) + flip the workspace to banned. Both
      // are fire-and-forget — the refuse screen renders regardless of
      // server state.
      void persistState({
        capturedFacts: nextFacts,
        current_turn: 1,
        messages,
      });

      if (!clientId) return;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/clients/${clientId}/refuse-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refuseReason: reason }),
        });
        if (!res.ok) {
          console.warn(
            '[sign-up] refuse-signup ban call failed — workspace remains in preview',
            await res.text().catch(() => '(no body)'),
          );
        }
      } catch (e) {
        console.warn('[sign-up] refuse-signup network error', e);
      }
    },
    [capturedFacts, clientId, clientSlug, email, firstMessage, messages, persistState],
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
        industryDescription: '',
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
        if (!res.ok) {
          console.warn('[sign-up] extraction failed', body);
          await handleExtractionDone(fallback);
        } else if (body.refused === true) {
          await handleRefusal(body.refuseReason);
        } else if (body.refused === false && body.extraction) {
          await handleExtractionDone(body.extraction);
        } else {
          // Shape didn't match either branch — log + degrade to fallback.
          console.warn('[sign-up] extraction response missing refused flag', body);
          await handleExtractionDone(fallback);
        }
      } catch (e) {
        console.warn('[sign-up] extraction network error', e);
        await handleExtractionDone(fallback);
      } finally {
        setBotThinking(false);
      }
    },
    [clientId, firstMessage, handleExtractionDone, handleRefusal],
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
      // Pass the resolved industry knowledge straight through — the route
      // tolerates absence (operator concierge path doesn't fetch it) and
      // weaves it into the user message as an additive block when
      // present. Picks up the cached value from capturedFacts; absent on
      // a slow-network case where the background call hasn't returned
      // by the time the customer reaches turn 4 (rare — the call fires
      // 2-3 turns earlier).
      industryKnowledge: capturedFacts.industryKnowledge
        ? {
            customerPainPoints: capturedFacts.industryKnowledge.customerPainPoints,
            desiredOutcomes: capturedFacts.industryKnowledge.desiredOutcomes,
            trustSignals: capturedFacts.industryKnowledge.trustSignals,
            voiceRecommendation: capturedFacts.industryKnowledge.voiceRecommendation,
            source: capturedFacts.industryKnowledge.source,
          }
        : undefined,
    };
  }, [capturedFacts.industryKnowledge, capturedFacts.services, extraction]);

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
        // Brief acknowledgment. The fullscreen GenerationBlueprint mounts
        // on top of the chat once we enter turn-5, so we don't need a
        // separate "building now" bubble.
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
  // Build-gating contract (Issue 2):
  //   - Routing to /dashboard happens ONLY when both generators succeed
  //     AND the customer clicks Continue on the ReadyOverlay.
  //   - The dashboard's wizard-completion gate is stamped via
  //     /api/clients/[id]/wizard-state POST { complete: true } only after
  //     a successful generation — so a customer who lands on /dashboard
  //     does NOT get bounced to /onboarding (the 7-step legacy wizard).
  //   - Idempotency: capturedFacts.buildingStartedAt is stamped the
  //     moment we enter turn-5 generation. A refresh that finds
  //     current_turn=5 + buildingStartedAt set re-enters the blueprint
  //     screen and re-fires the generator; wizard-assets' probe ensures
  //     no duplicate inserts happen at the DB layer.
  const runGeneration = useCallback(async () => {
    if (generationStartedRef.current) return;
    generationStartedRef.current = true;
    if (!clientId || !clientSlug) {
      setGenPhase('failed');
      setGenError('Missing client context — please refresh and try again.');
      generationStartedRef.current = false;
      return;
    }
    setGenPhase('probing');
    setGenError(null);
    setGenSoftError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setGenPhase('failed');
      setGenError('Not signed in — please refresh and verify again.');
      generationStartedRef.current = false;
      return;
    }

    // Stamp the buildingStartedAt flag on capturedFacts so a refresh-then-
    // resume can detect that we're already in the build phase and just
    // re-mount the blueprint (rather than retrigger from scratch). The
    // generation routes are idempotent via wizard-assets' probe, so even
    // if the timing is unlucky and the generator fires twice, the second
    // call is a no-op at the DB layer.
    const facts: ConversationCapturedFacts = {
      ...capturedFacts,
      buildingStartedAt:
        capturedFacts.buildingStartedAt ?? new Date().toISOString(),
    };
    if (facts.buildingStartedAt !== capturedFacts.buildingStartedAt) {
      setCapturedFacts(facts);
      void persistState({
        capturedFacts: facts,
        current_turn: 5,
        messages,
      });
    }

    const brief = deriveBriefFromConversation({
      capturedFacts: facts,
      email,
      fallbackBusinessName:
        facts.businessName?.trim() ||
        extraction?.businessName?.trim() ||
        extraction?.industryFreeText?.trim() ||
        (extraction ? prettyIndustry(extraction.industry) : 'My business'),
    });

    // Wire onProgress into the blueprint's BlueprintPhase. The blueprint
    // clamps its visual stage to the most conservative of (visual cursor,
    // highest unlocked-at index for this phase) — so the text stage
    // NEVER claims a step before the real backend reaches it.
    const handleProgress = (event: GenerationProgressEvent) => {
      switch (event.kind) {
        case 'probe':
          setGenPhase('probing');
          return;
        case 'generating-site':
          setGenPhase('generating-site');
          return;
        case 'generating-funnel':
          setGenPhase('generating-funnel');
          return;
        case 'persisting':
          setGenPhase('persisting');
          return;
        case 'attempt-failed':
          // Mid-attempt failures don't flip to 'failed' yet — the runner
          // will retry. We just stay on whatever phase we were on; the
          // final failure (after all retries) lands as ok:false below.
          console.warn(
            `[sign-up] generation attempt ${event.attempt} failed: ${event.error}`,
          );
          return;
        case 'soft-error':
          // A soft error rendered while still in flight — store but don't
          // flip phase; the runner can still resolve as ok:true.
          setGenSoftError(event.message);
          return;
      }
    };

    const result = await runConversationGeneration({
      clientId,
      clientSlug,
      token,
      brief,
      onProgress: handleProgress,
    });

    if (!result.ok) {
      setGenPhase('failed');
      setGenError(result.error);
      // Allow retry — clear the once-only guard.
      generationStartedRef.current = false;
      return;
    }
    setGenPhase('ready');
    if (result.softError) setGenSoftError(result.softError);

    // Persist conversation_state as turn 6 (post-generation) so a resume
    // visit detects we're done + redirects straight to /dashboard.
    void persistState({
      capturedFacts: facts,
      current_turn: 6,
      messages,
    });

    // Mark the wizard complete so the dashboard's gate doesn't bounce
    // this customer to /onboarding (the 7-step legacy wizard). The
    // conversational flow IS the onboarding wizard —
    // wizard_completed_at is the canonical "onboarding done" flag the
    // dashboard reads.
    //
    // Critical for build-gating (Issue 2): this stamp MUST land before
    // the customer reaches /dashboard. We don't await it inside this
    // callback because /dashboard's redirect-gate is async + fires
    // again on every navigation, so the worst case is a half-second
    // race where /dashboard renders the legacy-wizard redirect briefly
    // then resolves. To avoid that flash, the handleGenerationContinue
    // callback also awaits this before routing.
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/wizard-state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          // No `state` field — we don't want to clobber wizard_state
          // with our null. Just stamp wizard_completed_at.
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
    // attempt through. Bump attemptId so the blueprint resets its
    // visual cursor without remounting (key change would do it too;
    // attemptId is the more explicit signal).
    generationStartedRef.current = false;
    setGenAttemptId((id) => id + 1);
    setGenPhase('idle');
    setGenError(null);
    setGenSoftError(null);
    // The phase-change effect below kicks runGeneration when we transition
    // back to 'turn-5-generation'. We're already in that phase, so just
    // call runGeneration directly.
    void runGeneration();
  }, [runGeneration]);

  const handleGenerationContinue = useCallback(async () => {
    // Defence in depth: even though runGeneration kicked off the
    // wizard-state complete stamp, ensure it's landed (or at least
    // attempted) before we route. The dashboard's wizard-completion gate
    // is the difference between "land on the welcome surface" and
    // "bounce to /onboarding (legacy wizard)". Best-effort blocking
    // wait: if the stamp succeeded inside runGeneration we 200 in a
    // few ms; if it failed we do not block the customer from reaching
    // the dashboard (they'll see the legacy redirect once, which is
    // still better than holding them on this screen forever).
    if (clientId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch(`/api/clients/${clientId}/wizard-state`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ complete: true }),
          });
        }
      } catch {
        // Soldier on — see note above.
      }
    }
    router.push('/dashboard');
  }, [clientId, router]);

  // ---- render slots ------------------------------------------------------
  const resendSecondsLeft = Math.max(0, Math.ceil((resendReadyAt - nowMs) / 1000));
  const canResend = phase === 'awaiting-code' && resendSecondsLeft <= 0;

  const showTurn1Composer = phase === 'turn-1-input';
  const showClarifyingComposer = phase === 'clarifying';
  const showBusinessNameComposer = phase === 'awaiting-business-name';
  // Pre-fill suggestion for the composer placeholder — the AI's extracted
  // / derived name, when available.
  const suggestedBusinessName =
    capturedFacts.extraction?.businessName?.trim() ||
    capturedFacts.businessName?.trim() ||
    '';

  const industryForBrandStep: IndustryKey = extraction?.industry ?? 'generic';
  // Services catalogue resolution mirrors derive-brief's:
  //   - Mapped industries (the 10 named trades): template defaults stay
  //     authoritative; the AI knowledge supplements the GENERATION prompts
  //     but never replaces the curated picker list.
  //   - Unmapped industries (`generic`): prefer industryKnowledge.services
  //     when the AI call resolved; the generic template's defaults are
  //     intentionally vague and not useful for a real picker.
  //   - Fallback when industryKnowledge hasn't landed (still in flight on
  //     a slow connection): template defaults so the picker mounts cleanly.
  const servicesCatalogue = (() => {
    if (!extraction) return INDUSTRY_TEMPLATES.generic.defaultServices;
    if (
      extraction.industry === 'generic' &&
      capturedFacts.industryKnowledge &&
      capturedFacts.industryKnowledge.services.length > 0
    ) {
      return capturedFacts.industryKnowledge.services;
    }
    return resolveIndustryTemplate(extraction.industry).defaultServices;
  })();
  const industryDisplay = extraction
    ? prettyIndustry(extraction.industry)
    : 'Your business';

  // Blueprint copy interpolations — used by GenerationBlueprint's per-stage
  // messages. industryDisplay reads as plural-business-name ("painters",
  // "electricians") for "for {industryDisplay}" — falls back to
  // "service businesses" when extraction is missing.
  const blueprintIndustryDisplay = extraction
    ? prettyIndustry(extraction.industry).toLowerCase()
    : 'service businesses';
  // The ChatThinkingPhases card needs a SHORTER label — the AI-resolved
  // industryFreeText for unmapped ("wedding photographer"), or the
  // mapped template's singular displayName for the 10 named trades.
  // Used only by the phases card, kept distinct from blueprintIndustryDisplay
  // (which is plural for the build-side stage strings).
  const thinkingPhaseLabel = (() => {
    if (!extraction) return 'service';
    if (extraction.industry === 'generic') {
      return (
        extraction.industryFreeText?.trim() ||
        extraction.industryDescription?.trim() ||
        'service'
      );
    }
    return prettyIndustry(extraction.industry);
  })();
  const blueprintBusinessName =
    capturedFacts.businessName?.trim() ||
    capturedFacts.extraction?.businessName?.trim() ||
    undefined;

  // Terminal refusal branch — extract step classified the business as
  // restaurant/ecom. No chat UI, no composer; just the friendly redirect
  // screen. ChatRefuseScreen renders on a paper-bg full-screen layout so
  // we don't wrap it in the chat shell. Returned early so the main chat
  // tree below is never mounted for a refused signup.
  if (phase === 'refused' && refusedReason) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-paper">
        <ChatRefuseScreen
          refuseReason={refusedReason}
          onSignOut={async () => {
            await supabase.auth.signOut();
            router.replace('/');
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex w-full flex-col overflow-hidden bg-paper">
      {/* Blueprint grid backdrop — same 2-layer ink grid GenerationBlueprint
          uses. Sits behind the whole chat so the message stream reads as
          spec lines drawn onto a working sheet, not floating bubbles on
          a flat background. Pointer-events: none so it never intercepts
          clicks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 10px 10px, 10px 10px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '10px 10px, 10px 10px',
        }}
      />

      {/* Header — slim brand bar with phase-aware step label. Same chrome
          as GenerationBlueprint's header so the chat → build transition
          reads as continuous. */}
      <header className="relative z-10 flex items-center justify-center gap-3 border-b-2 border-ink/15 bg-paper/80 px-4 py-3 backdrop-blur-sm">
        <BrandMark size="default" className="text-ink" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {phaseToStepLabel(phase)}
        </span>
      </header>

      <div ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:gap-7 sm:py-10">
          {messages.map((m) => (
            <ChatBubble key={m.id} author={m.author}>
              {m.text}
            </ChatBubble>
          ))}

          {phase === 'awaiting-email' ? (
            <SpecSheet label="// VERIFY YOUR EMAIL" hint="email-capture.svg">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleEmailSubmit();
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-[12px] leading-[1.4] text-ink-mid">
                  We&apos;ll send a 6-digit code to confirm it&apos;s really you.
                </p>
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
                  className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md bg-rust px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-rust-deep disabled:opacity-50"
                >
                  {botThinking ? 'Sending…' : 'Send me a code →'}
                </button>
              </form>
            </SpecSheet>
          ) : null}

          {phase === 'awaiting-code' || phase === 'verifying' || phase === 'requesting-code' ? (
            <SpecSheet label="// 6-DIGIT CODE" hint="verify.json">
              <div className="flex flex-col gap-3">
                <p className="text-[12px] leading-[1.4] text-ink-mid">
                  Check your inbox. Type the code we just emailed you.
                </p>
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
                        'h-12 w-10 rounded-md border-2 border-ink/20 bg-paper/40 text-center',
                        'font-mono text-[18px] font-bold text-ink',
                        'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
                        'disabled:bg-paper-2 disabled:opacity-60',
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
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
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rust" />
                      Verifying…
                    </span>
                  ) : null}
                </div>
              </div>
            </SpecSheet>
          ) : null}

          {phase === 'awaiting-knowledge' ? (
            <ChatThinkingPhases businessLabel={thinkingPhaseLabel} />
          ) : null}

          {phase === 'turn-2-services' ? (
            <ChatServicePicker
              industryName={industryDisplay}
              options={servicesCatalogue}
              preTicked={extraction?.mentionedServices ?? []}
              initial={capturedFacts.services}
              onSubmit={(services) => advanceToTurn3(services)}
              onSkip={() => advanceToTurn3([])}
            />
          ) : null}

          {phase === 'turn-3-brand' ? (
            <ChatBrandPicker
              industryKey={industryForBrandStep}
              initial={capturedFacts.brand ?? null}
              onSubmit={(brand) => void advanceToTurn4(brand)}
              onSkip={() => void advanceToTurn4(null)}
            />
          ) : null}

          {phase === 'turn-4-offer' ? (
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
          ) : null}

          {/* turn-5 renders the fullscreen GenerationBlueprint OUTSIDE
              the chat container — see the mount near the end of the
              component. We leave the chat thread untouched so a refresh
              that lands mid-build still has the prior message history
              underneath the blueprint overlay. */}

          {botThinking ? (
            <ChatBubble author="bot">
              <TypingIndicator />
            </ChatBubble>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-md border-2 border-warn/40 bg-warn/[0.08] px-3 py-2.5 font-mono text-[12px] text-warn animate-in fade-in duration-300"
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                {'// ERROR'}
              </div>
              <div className="font-sans text-[13px] leading-[1.5]">{error}</div>
            </div>
          ) : null}

          {info ? (
            <div className="rounded-md border-2 border-ink/15 bg-paper/40 px-3 py-2.5 animate-in fade-in duration-300">
              <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// NOTE'}
              </div>
              <div className="text-[13px] leading-[1.5] text-ink-mid">{info}</div>
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
      {showBusinessNameComposer ? (
        <ChatComposer
          placeholder={
            suggestedBusinessName
              ? `e.g. ${suggestedBusinessName} — or "skip" to use what you've got`
              : 'Your business name, or "skip" to use a placeholder'
          }
          disabled={botThinking}
          sendLabel="Save"
          onSend={handleBusinessNameSubmit}
        />
      ) : null}

      {/* Fullscreen build-gating overlay (Issue 2 + 3). Mounts on top of
          the chat the moment we enter turn-5; unmounts when the customer
          clicks Continue from the ready overlay (which awaits the
          wizard-state stamp first, see handleGenerationContinue). */}
      {phase === 'turn-5-generation' ? (
        <GenerationBlueprint
          phase={genPhase}
          industryDisplay={blueprintIndustryDisplay}
          serviceCount={(capturedFacts.services ?? []).length}
          businessName={blueprintBusinessName}
          errorMessage={genError ?? undefined}
          softError={genSoftError ?? undefined}
          onRetry={handleGenerationRetry}
          onContinue={handleGenerationContinue}
          attemptId={genAttemptId}
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
