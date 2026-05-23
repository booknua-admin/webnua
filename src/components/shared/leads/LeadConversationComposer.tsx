'use client';

// =============================================================================
// LeadConversationComposer — the live composer mounted on a lead's
// conversation view.
//
// Phase 7 Resend session. Wraps the visual `ConversationComposer` and wires
// the Email channel to `useReplyToLead`. The SMS channel stays a visual
// stub for now (no SMS-from-inbox path is in scope this session — the
// outbound SMS engine is Phase 8).
//
// Channel selection:
//   • When the lead has an email AND a phone, both channels appear; user
//     picks. Email replies go through the reply route; SMS replies are
//     informational-only (toast: "SMS sending from the inbox lands later").
//   • When only one channel is available, the composer locks to it.
// =============================================================================

import { useMemo, useState } from 'react';

import {
  ConversationComposer,
  type ConversationComposerSend,
} from '@/components/shared/leads/ConversationComposer';
import { useReplyToLead } from '@/lib/leads/queries';

type LeadConversationComposerProps = {
  leadId: string;
  /** Customer first name — feeds the textarea placeholder. */
  firstName: string;
  /** True when an email address is on file. Drives email-channel availability. */
  hasEmail: boolean;
  /** Visible helper chips (insert-variable / booking-link / etc.) — visual
   *  affordances from the existing conversation stub. */
  helpers?: string[];
  /** Controlled channel id (`'SMS'` | `'Email'`) — when provided, the
   *  composer mirrors the parent's choice. The conversation page lifts
   *  this state so the header tabs + composer tabs stay in lockstep. */
  activeChannelId?: string;
  onChannelChange?: (id: string) => void;
};

function LeadConversationComposer({
  leadId,
  firstName,
  hasEmail,
  helpers,
  activeChannelId,
  onChannelChange,
}: LeadConversationComposerProps) {
  const reply = useReplyToLead();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const channels = useMemo(() => {
    const list = ['SMS'];
    if (hasEmail) list.push('Email');
    return list;
  }, [hasEmail]);

  const defaultChannel = hasEmail ? 'Email' : 'SMS';

  async function handleSend(draft: ConversationComposerSend) {
    setStatusMessage(null);
    if (draft.channel === 'Email') {
      if (!hasEmail) {
        setStatusMessage('No email address on file for this lead.');
        return;
      }
      try {
        await reply.mutateAsync({
          leadId,
          subject: draft.subject,
          body: draft.body,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Send failed.';
        setStatusMessage(message);
      }
      return;
    }
    // SMS channel — out of scope this session.
    setStatusMessage(
      'Sending SMS from the inbox is not wired yet — use the lead view’s call button or wait for the automation engine.',
    );
  }

  return (
    <ConversationComposer
      channels={channels}
      defaultChannelId={defaultChannel}
      activeChannelId={activeChannelId}
      onChannelChange={onChannelChange}
      subjectChannels={['Email']}
      placeholder={`Reply to ${firstName}…`}
      helpers={helpers}
      onSend={handleSend}
      isSending={reply.isPending}
      errorMessage={reply.isError ? (reply.error as Error).message : statusMessage}
      sendLabel={hasEmail ? 'Send email →' : 'Send →'}
    />
  );
}

export { LeadConversationComposer };
