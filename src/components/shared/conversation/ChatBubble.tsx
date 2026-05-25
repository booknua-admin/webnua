// =============================================================================
// ChatBubble — single message bubble in the conversational onboarding chat.
//
// Two authors:
//   - 'bot'  — paper-2 + ink text, left-aligned.
//   - 'user' — ink-bg + paper text, right-aligned.
//
// `rich` slot mounts inside the bubble below `children`. Used for inline UI:
// the email Input on turn-1's email-capture moment, the 6-digit code grid
// on the verify moment, the GenerationStatusCard placeholder slot Session C
// will fill. Designed so a single bubble can carry both a sentence + a
// control (rather than splitting them across two bubbles, which fragments
// the visual rhythm).
// =============================================================================

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ChatBubbleAuthor = 'bot' | 'user';

export type ChatBubbleProps = {
  author: ChatBubbleAuthor;
  children?: ReactNode;
  /** Optional inline UI rendered inside the bubble below the text. */
  rich?: ReactNode;
  /** Optional className for the OUTER wrapper (alignment). */
  wrapperClassName?: string;
};

export function ChatBubble({ author, children, rich, wrapperClassName }: ChatBubbleProps) {
  const isBot = author === 'bot';
  return (
    <div
      className={cn(
        'flex w-full',
        isBot ? 'justify-start' : 'justify-end',
        wrapperClassName,
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-3 text-[14px] leading-[1.55]',
          isBot
            ? 'bg-paper-2 text-ink'
            : 'bg-ink text-paper',
        )}
      >
        {children ? <div className="whitespace-pre-wrap">{children}</div> : null}
        {rich ? <div className={cn(children ? 'mt-3' : '')}>{rich}</div> : null}
      </div>
    </div>
  );
}
