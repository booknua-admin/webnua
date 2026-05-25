// =============================================================================
// ChatGenerationBubble — Session C placeholder for the AI generation handoff.
//
// Session C will fill this in with the staged-progress GenerationStatusCard
// equivalent surfaced inside the chat (reading "Drafting your page…" → "Got
// your specifics…" → "✓ Site ready"). For now the file shell + export shape
// is in place so the conversation shell can mount it and Session C can swap
// the body without touching the shell's import.
// =============================================================================

import { cn } from '@/lib/utils';

export type ChatGenerationBubbleProps = {
  /** Optional caption Session C will replace with a rotating stage label. */
  caption?: string;
  className?: string;
};

export function ChatGenerationBubble({
  caption = 'Generation status will appear here in Session C.',
  className,
}: ChatGenerationBubbleProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-rule bg-paper-2 px-3 py-2',
        'font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet',
        className,
      )}
    >
      {caption}
    </div>
  );
}
