// =============================================================================
// ChatBubble — single message in the conversational onboarding chat.
//
// Visual language (matches GenerationBlueprint — architect's working
// drawing): no chat bubbles. Each message reads as a "spec line" on the
// blueprint sheet — a mono uppercase author tag (`// WEBNUA` or `// YOU`)
// above the body, with a coloured rule on the inside edge that "sketches
// in" via the shared @keyframes draw animation on mount.
//
// Two authors:
//   - 'bot'  — left-aligned. `// WEBNUA` in rust + rust left rule.
//   - 'user' — right-aligned. `// YOU` in ink-quiet + ink right rule.
//
// `rich` slot mounts inside the body below the prose text. Used for inline
// UI — the email Input, the 6-digit code grid, the picker / offer slots.
// The shell normally wraps rich content in a `SpecSheet` so it reads as
// a labelled section on the same blueprint; ChatBubble passes rich
// through without wrapping it (so a sheet's own bordered surface is the
// dominant frame, not a nested bubble).
// =============================================================================

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ChatBubbleAuthor = 'bot' | 'user';

export type ChatBubbleProps = {
  author: ChatBubbleAuthor;
  children?: ReactNode;
  /** Optional inline UI rendered below the prose. */
  rich?: ReactNode;
  /** Optional className for the OUTER wrapper (alignment). */
  wrapperClassName?: string;
};

export function ChatBubble({ author, children, rich, wrapperClassName }: ChatBubbleProps) {
  const isBot = author === 'bot';
  return (
    <div
      className={cn(
        'flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300',
        isBot ? 'justify-start' : 'justify-end',
        wrapperClassName,
      )}
    >
      <div
        className={cn(
          'relative max-w-[88%]',
          isBot ? 'pl-4' : 'pr-4 text-right',
        )}
      >
        {/* Side rule rendered as an SVG line so it sketches in via the
            shared @keyframes draw (stroke-dashoffset animation). Reads
            as a hand-drawn margin mark on the blueprint sheet, not a
            chat-bubble border. */}
        <svg
          aria-hidden
          className={cn(
            'absolute top-0 h-full w-[2px]',
            isBot ? 'left-0' : 'right-0',
          )}
          preserveAspectRatio="none"
          viewBox="0 0 2 100"
        >
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="100"
            strokeWidth="2"
            strokeLinecap="round"
            className={cn(
              isBot ? 'stroke-rust' : 'stroke-ink/40',
              '[stroke-dasharray:120] [stroke-dashoffset:120] animate-[draw_0.5s_ease-out_forwards]',
            )}
          />
        </svg>

        {/* Mono author tag — `// WEBNUA` for bot (rust) or `// YOU` for
            user (ink-quiet). Same vocabulary as the blueprint's section
            eyebrows so the chat reads as one design family. */}
        <div
          className={cn(
            'mb-1 font-mono text-[10px] uppercase tracking-[0.14em] font-bold',
            isBot ? 'text-rust' : 'text-ink-quiet',
          )}
        >
          {isBot ? '// WEBNUA' : '// YOU'}
        </div>
        {children ? (
          <div
            className={cn(
              'whitespace-pre-wrap text-[14px] leading-[1.55] text-ink',
              isBot ? 'text-left' : 'text-right',
            )}
          >
            {children}
          </div>
        ) : null}
        {rich ? (
          <div className={cn(children ? 'mt-3' : '', isBot ? 'text-left' : 'text-right')}>
            {rich}
          </div>
        ) : null}
      </div>
    </div>
  );
}
