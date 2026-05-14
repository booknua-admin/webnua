import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type {
  ConversationBubbleKind,
  ConversationDay,
  ConversationMessage,
} from '@/lib/leads/types';

type ConversationThreadProps = {
  days: ConversationDay[];
  className?: string;
};

function ConversationThread({ days, className }: ConversationThreadProps) {
  return (
    <div
      data-slot="conversation-thread"
      className={cn(
        'flex flex-col gap-4 bg-paper-2/40 px-7 py-7',
        className,
      )}
    >
      {days.map((day) => (
        <div key={day.id} className="flex flex-col gap-3">
          <ConversationDayDivider label={day.label} />
          {day.messages.map((msg) => (
            <ConversationMessageRow key={msg.id} message={msg} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ConversationDayDivider({ label }: { label: string }) {
  return (
    <div
      data-slot="conversation-day-divider"
      className="my-1 flex items-center justify-center text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet"
    >
      <span className="rounded-full bg-paper px-3 py-1">{label}</span>
    </div>
  );
}

const BUBBLE_ALIGN: Record<ConversationBubbleKind, string> = {
  incoming: 'justify-start',
  outgoing: 'justify-end',
  auto: 'justify-end',
  system: 'justify-center',
};

const BUBBLE_STYLES: Record<ConversationBubbleKind, string> = {
  incoming: 'bg-card border border-ink/8 text-ink',
  outgoing: 'bg-ink text-paper',
  auto: 'bg-rust/[0.10] border border-rust/30 text-ink',
  system:
    'bg-paper-2 border border-rule text-ink-quiet font-mono text-[11px] font-bold uppercase tracking-[0.08em]',
};

function ConversationMessageRow({ message }: { message: ConversationMessage }) {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center">
        <div
          data-slot="conversation-system"
          className={cn(
            'inline-flex max-w-[420px] items-center rounded-full px-3.5 py-1.5 text-center',
            BUBBLE_STYLES.system,
          )}
        >
          {message.body}
        </div>
      </div>
    );
  }

  const isOut = message.kind === 'outgoing' || message.kind === 'auto';

  return (
    <div
      data-slot="conversation-message"
      data-kind={message.kind}
      className={cn('flex', BUBBLE_ALIGN[message.kind])}
    >
      <div className={cn('max-w-[78%]', isOut ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-[14px] px-4 py-3 text-[14px] leading-[1.5]',
            BUBBLE_STYLES[message.kind],
          )}
        >
          {message.body}
        </div>
        <ConversationMessageMeta message={message} isOut={isOut} />
      </div>
    </div>
  );
}

function ConversationMessageMeta({
  message,
  isOut,
}: {
  message: ConversationMessage;
  isOut: boolean;
}) {
  const parts: ReactNode[] = [];
  if (message.autoLabel) {
    parts.push(
      <span
        key="auto"
        className="inline-flex items-center rounded-full bg-rust/[0.14] px-1.5 py-[1px] text-[9px] font-bold text-rust"
      >
        ⤿ {message.autoLabel}
      </span>,
    );
  }
  if (message.metaPrefix) {
    parts.push(<span key="prefix">{message.metaPrefix}</span>);
  }
  if (message.channel) parts.push(<span key="ch">{message.channel}</span>);
  if (message.delivered) {
    parts.push(
      <span key="delivered" className="text-good">
        DELIVERED
      </span>,
    );
  }
  if (message.time) parts.push(<span key="time">{message.time}</span>);

  return (
    <div
      data-slot="conversation-message-meta"
      className={cn(
        'mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet',
        isOut ? 'justify-end pr-1' : 'pl-1',
      )}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}

export { ConversationThread, ConversationDayDivider, ConversationMessageRow };
export type { ConversationThreadProps };
