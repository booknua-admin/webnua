// =============================================================================
// Conversation intelligence — inbound-message analysis (SERVER-ONLY).
//
// Reads an inbound customer email in the context of the lead's conversation
// and returns (1) a classified intent, (2) a one-line summary for the
// detection chip, and (3) a drafted reply in the owner's voice. The draft is
// NEVER sent automatically — it lands as a `suggested_actions` row the owner
// approves, edits, or dismisses (the platform's approval-first principle).
//
// Model: Haiku 4.5 — classification + a short reply draft is exactly the
// fast/cheap tier's job (the build spec's "Haiku for classification/intent
// detection"). The owner's approval gate is the quality control.
//
// Guardrails mirror the generation pipeline's: the draft must not invent
// prices, availability, credentials, or claims. When the customer asks for
// a price the draft acknowledges + promises a quote — it never makes one up.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

export const CONVERSATION_INTENTS = [
  'price_request',
  'booking_request',
  'reschedule_request',
  'complaint',
  'payment_question',
  'general_question',
  'spam_or_automated',
  'other',
] as const;

export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const INTENT_LABEL: Record<ConversationIntent, string> = {
  price_request: 'Price request',
  booking_request: 'Booking request',
  reschedule_request: 'Reschedule request',
  complaint: 'Complaint',
  payment_question: 'Payment question',
  general_question: 'Question',
  spam_or_automated: 'Spam / automated',
  other: 'Message',
};

export type ConversationAnalysis = {
  intent: ConversationIntent;
  urgency: 'normal' | 'high';
  /** One line for the detection chip — "kitchen + bathroom deep clean, Clontarf". */
  summary: string;
  /** The drafted reply (plain text, ready to send once approved). */
  reply: string;
};

export type AnalyzeInput = {
  businessName: string;
  /** e.g. "1 hour" — the client's response-time promise, if set. */
  responseTimePromise: string | null;
  customerName: string;
  /** Chronological transcript lines, oldest first. */
  transcript: { from: 'customer' | 'business'; text: string }[];
  /** The new inbound message being analysed. */
  inboundText: string;
};

const SYSTEM_PROMPT = `You are the inbox assistant for a local service business (trades: cleaning, electrical, plumbing, landscaping, beauty, and similar). A customer email just arrived. Your job:

1. Classify the customer's intent.
2. Summarise what they want in ONE short line (under 12 words) — concrete specifics, e.g. "3-bed deep clean, Clontarf, asking for price".
3. Draft a reply the business owner can send with one tap.

Reply rules — these are hard rules:
- Write as the business owner: warm, plain English, first person. No corporate filler.
- Under 110 words. Short sentences. No bullet lists unless listing offered times.
- NEVER invent a price, discount, availability slot, certification, or guarantee. If they ask for a price, acknowledge the job, say you'll confirm the exact price, and ask the one detail you'd genuinely need.
- Ask at most ONE clarifying question.
- For complaints: apologise plainly, take ownership, propose a concrete next step (a call). Never defensive.
- Sign off with the owner's first-person voice and the business name on the final line.
- If the message is spam, an auto-responder, or a marketing blast: intent is spam_or_automated and reply is an empty string.

Output STRICT JSON only, no code fences:
{"intent": "...", "urgency": "normal"|"high", "summary": "...", "reply": "..."}

urgency is "high" only for complaints or genuinely time-critical asks (today/emergency).`;

function buildUserMessage(input: AnalyzeInput): string {
  const lines: string[] = [];
  lines.push(`Business: ${input.businessName}`);
  if (input.responseTimePromise) {
    lines.push(`The business promises to respond within ${input.responseTimePromise}.`);
  }
  lines.push(`Customer: ${input.customerName || 'Unknown'}`);
  if (input.transcript.length > 0) {
    lines.push('', 'Conversation so far (oldest first):');
    for (const turn of input.transcript) {
      const who = turn.from === 'customer' ? 'CUSTOMER' : 'BUSINESS';
      lines.push(`${who}: ${turn.text.slice(0, 600)}`);
    }
  }
  lines.push('', 'NEW INBOUND MESSAGE from the customer:', input.inboundText.slice(0, 2000));
  return lines.join('\n');
}

function coerceIntent(value: unknown): ConversationIntent {
  return CONVERSATION_INTENTS.includes(value as ConversationIntent)
    ? (value as ConversationIntent)
    : 'other';
}

/** Run the analysis. Throws on API failure (the job spine retries). */
export async function analyzeInboundMessage(
  input: AnalyzeInput,
): Promise<ConversationAnalysis> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  // Defensive parse — tolerate a stray code fence.
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new Error(`analyzeInboundMessage: model returned non-JSON output`);
  }

  return {
    intent: coerceIntent(parsed.intent),
    urgency: parsed.urgency === 'high' ? 'high' : 'normal',
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : '',
    reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : '',
  };
}
