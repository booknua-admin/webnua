// =============================================================================
// Conversation intelligence — job handler (SERVER-ONLY).
//
// `analyze_inbound_message` is enqueued by the Resend inbound webhook the
// moment a customer reply lands on a lead. The handler loads the lead's
// conversation, runs the Haiku analysis, and writes a `suggested_actions`
// reply draft the owner approves from the dashboard feed or the lead view.
//
// Skips honestly (no row) when ANTHROPIC_API_KEY is unset or the message is
// spam/auto-responder. One open draft per lead (dedupe key) — a newer inbound
// supersedes the stale draft.
// =============================================================================

import { createSuggestedAction } from '@/lib/actions/server';
import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';
import { listMessagesForLead } from '@/lib/integrations/resend/messages';

import { analyzeInboundMessage, INTENT_LABEL } from './analyze';

export const ANALYZE_INBOUND_MESSAGE_JOB = 'analyze_inbound_message';

export type AnalyzeInboundMessagePayload = {
  emailMessageId: string;
  leadId: string;
  clientId: string;
};

function normalizePayload(raw: unknown): AnalyzeInboundMessagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.emailMessageId !== 'string' ||
    typeof p.leadId !== 'string' ||
    typeof p.clientId !== 'string'
  ) {
    return null;
  }
  return {
    emailMessageId: p.emailMessageId,
    leadId: p.leadId,
    clientId: p.clientId,
  };
}

registerJobHandler(ANALYZE_INBOUND_MESSAGE_JOB, async (rawPayload) => {
  const payload = normalizePayload(rawPayload);
  if (!payload) throw new Error('analyze_inbound_message: malformed payload');

  if (!env.ANTHROPIC_API_KEY) {
    return { skipped: 'anthropic-not-configured' };
  }

  const db = getIntegrationDb();

  // The inbound message being analysed.
  const { data: messageData } = await db
    .from('email_messages')
    .select('id, body_text, body_html, is_auto_responder, direction')
    .eq('id', payload.emailMessageId)
    .maybeSingle();
  const message = messageData as {
    body_text: string;
    body_html: string;
    is_auto_responder: boolean;
    direction: string;
  } | null;
  if (!message || message.direction !== 'inbound') {
    return { skipped: 'message-not-found' };
  }
  if (message.is_auto_responder) return { skipped: 'auto-responder' };
  const inboundText = (message.body_text || message.body_html).trim();
  if (!inboundText) return { skipped: 'empty-body' };

  // Lead + client facts for the prompt.
  const [{ data: leadData }, { data: clientData }] = await Promise.all([
    db
      .from('leads')
      .select('id, customer_name_snapshot, status')
      .eq('id', payload.leadId)
      .maybeSingle(),
    db
      .from('clients')
      .select('id, name, response_time_promise')
      .eq('id', payload.clientId)
      .maybeSingle(),
  ]);
  const lead = leadData as { customer_name_snapshot: string; status: string } | null;
  const client = clientData as { name: string; response_time_promise: string | null } | null;
  if (!lead || !client) return { skipped: 'lead-or-client-missing' };

  // Conversation transcript — the prior thread, oldest first, capped at the
  // last 10 messages so the prompt stays lean.
  const allMessages = await listMessagesForLead(payload.leadId);
  const transcript = allMessages
    .filter((m) => m.id !== payload.emailMessageId)
    .slice(-10)
    .map((m) => ({
      from: m.direction === 'inbound' ? ('customer' as const) : ('business' as const),
      text: (m.body_text || m.subject || '').trim(),
    }))
    .filter((t) => t.text.length > 0);

  const analysis = await analyzeInboundMessage({
    businessName: client.name,
    responseTimePromise: client.response_time_promise,
    customerName: lead.customer_name_snapshot,
    transcript,
    inboundText,
  });

  if (analysis.intent === 'spam_or_automated' || !analysis.reply) {
    return { skipped: 'spam-or-no-reply', intent: analysis.intent };
  }

  const customerLabel = lead.customer_name_snapshot || 'customer';
  const actionId = await createSuggestedAction({
    clientId: payload.clientId,
    kind: 'reply_draft',
    title:
      analysis.intent === 'complaint'
        ? `Complaint from ${customerLabel} — reply drafted`
        : `Reply drafted — ${customerLabel}`,
    body: analysis.reply,
    explanation: analysis.summary
      ? `Detected: ${INTENT_LABEL[analysis.intent]} — ${analysis.summary}`
      : `Detected: ${INTENT_LABEL[analysis.intent]}`,
    payload: {
      leadId: payload.leadId,
      draftText: analysis.reply,
      intent: analysis.intent,
    },
    sourceEntityType: 'lead',
    sourceEntityId: payload.leadId,
    dedupeKey: `reply_draft:${payload.leadId}`,
    urgency: analysis.urgency,
    // A reply draft goes stale fast — 48h, then it expires off the feed.
    expiresInHours: 48,
  });

  return { actionId, intent: analysis.intent, urgency: analysis.urgency };
});
