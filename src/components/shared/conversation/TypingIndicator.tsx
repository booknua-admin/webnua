// =============================================================================
// TypingIndicator — three-dot pulse used while the bot is "thinking".
//
// Rendered inside a ChatBubble (author='bot') by the conversation shell.
// Pure visual; no business logic. Rust dots match the active-state pulse
// in the GenerationBlueprint progress sheet — same architectural cue.
// =============================================================================

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="Bot is typing">
      <span className="h-2 w-2 animate-pulse rounded-full bg-rust [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-rust/70 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-rust/40 [animation-delay:300ms]" />
    </div>
  );
}
