// =============================================================================
// ChatComposer — sticky-bottom text input + send button for the chat.
//
// Mobile-aware: 44px tap target on the send button + a single-row Input
// that grows naturally inside its flex container. Enter sends; shift-enter
// inserts a newline (consistent with chat surfaces across the platform —
// the leads ConversationComposer + the tickets TicketReply both follow
// this convention).
//
// `disabled` is set while the bot is "thinking" or while a network request
// is in flight. The send button shows a quiet pulsing state in that mode.
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
      className="sticky bottom-0 z-10 flex items-end gap-2 border-t border-rule bg-paper px-3 py-3"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'min-h-[44px] flex-1 resize-none rounded-md border border-rule bg-card px-3 py-2.5',
          'text-[14px] leading-[1.45] text-ink placeholder:text-ink-quiet',
          'focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust',
          'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-60',
        )}
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className={cn(
          'inline-flex h-11 min-w-[64px] items-center justify-center rounded-md bg-rust px-4',
          'text-[13px] font-bold text-paper hover:bg-rust-deep',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {disabled ? '…' : sendLabel}
      </button>
    </form>
  );
}
