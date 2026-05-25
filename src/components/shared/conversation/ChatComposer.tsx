// =============================================================================
// ChatComposer — sticky-bottom text input + send button for the chat.
//
// Visual language matches GenerationBlueprint's BlueprintSheet: the
// composer reads as a labelled "fill in this field" affordance on the
// spec sheet — a mono `// YOUR ANSWER` corner label sits above the
// input, separated from the message stream by a top rule. The textarea
// itself uses a paper surface with rule border (no white card chrome).
//
// Mobile-aware: 44px tap target on the send button + a single-row
// textarea that grows naturally inside its flex container. Enter sends;
// shift-enter inserts a newline (consistent with chat surfaces across
// the platform — the leads ConversationComposer + the tickets TicketReply
// both follow this convention).
//
// `disabled` is set while the bot is "thinking" or while a network
// request is in flight. The send button shows a quiet pulsing state in
// that mode.
// =============================================================================

'use client';

import { type FormEvent, type KeyboardEvent, useState } from 'react';

import { cn } from '@/lib/utils';

export type ChatComposerProps = {
  placeholder?: string;
  disabled?: boolean;
  /** Override the send-button label. Defaults to 'Send'. */
  sendLabel?: string;
  onSend: (text: string) => void;
};

export function ChatComposer({
  placeholder = 'Type your reply…',
  disabled = false,
  sendLabel = 'Send',
  onSend,
}: ChatComposerProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 z-10 border-t-2 border-ink/20 bg-paper px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
            {'// YOUR ANSWER'}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
            enter to send · shift+enter for newline
          </span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'min-h-[44px] flex-1 resize-none rounded-md border-2 border-ink/20 bg-paper/40 px-3 py-2.5',
              'text-[14px] leading-[1.45] text-ink placeholder:text-ink-quiet',
              'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
              'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-60',
            )}
          />
          <button
            type="submit"
            disabled={disabled || value.trim().length === 0}
            className={cn(
              'inline-flex h-11 min-h-[44px] min-w-[72px] items-center justify-center rounded-md bg-rust px-4',
              'font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-rust-deep',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {disabled ? '…' : sendLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
