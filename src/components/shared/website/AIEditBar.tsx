'use client';

// =============================================================================
// AIEditBar — the Bolt/Lovable-style persistent prompt floating over the
// editor preview. The operator types a natural-language instruction ("make
// the hero more premium", "add an FAQ about gutter cleaning"); the AI
// returns section operations which are applied to a PROPOSAL copy of the
// sections. The preview swaps to the proposal (that IS the visual diff —
// changed sections ring in rust) and this bar becomes the Apply / Discard
// decision. Apply commits through the editor's undoable state, so an applied
// AI edit is one ⌘Z away from gone; Discard drops the proposal untouched.
//
// Mounted by SectionEditor for page + funnel-step modes, gated on the `useAI`
// capability. The parent owns the proposal state (it has to swap the preview
// source); this bar owns the request lifecycle + the input.
// =============================================================================

import { useRef, useState } from 'react';

import { applyEditOperations, requestSectionEdit } from '@/lib/website/ai-edit';
import { normalizeError } from '@/lib/errors';
import type { BrandObject, Section } from '@/lib/website/types';
import { cn } from '@/lib/utils';

export type AIEditProposal = {
  sections: Section[];
  summary: string;
  changedIds: Set<string>;
};

export type AIEditBarProps = {
  sections: Section[];
  container: 'page' | 'funnelStep';
  brand: BrandObject;
  businessName: string;
  selectedSectionId: string | null;
  proposal: AIEditProposal | null;
  onProposal: (proposal: AIEditProposal) => void;
  onApply: () => void;
  onDiscard: () => void;
};

const SUGGESTIONS = ['Make the hero more premium', 'Tighten all the copy', 'Add an FAQ section'];

export function AIEditBar({
  sections,
  container,
  brand,
  businessName,
  selectedSectionId,
  proposal,
  onProposal,
  onApply,
  onDiscard,
}: AIEditBarProps) {
  const [instruction, setInstruction] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await requestSectionEdit({
        instruction: trimmed,
        container,
        sections,
        selectedSectionId,
        brand,
        businessName,
      });
      if (result.operations.length === 0) {
        setError(result.summary || 'The AI could not make that change.');
        return;
      }
      const applied = applyEditOperations(sections, result.operations);
      onProposal({
        sections: applied.sections,
        summary: result.summary,
        changedIds: applied.changedIds,
      });
      setInstruction('');
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setPending(false);
    }
  };

  // ---- Proposal state — the Apply / Discard decision card -------------------
  if (proposal) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-6">
        <div className="pointer-events-auto w-full max-w-[640px] rounded-2xl border border-rust/30 bg-ink p-4 text-paper shadow-glow animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-rust text-[13px] text-paper"
            >
              ✦
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-rust-light">
                {'// AI proposal — previewing above'}
              </p>
              <p className="mt-1 text-[13.5px] leading-[1.45] text-paper/90">{proposal.summary}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onApply}
              className="h-9 rounded-md bg-rust px-4 text-[13px] font-bold text-paper transition-colors hover:bg-rust-light"
            >
              Apply changes ✓
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="h-9 rounded-md border border-paper/25 px-4 text-[13px] font-bold text-paper/85 transition-colors hover:border-paper/60 hover:text-paper"
            >
              Discard
            </button>
            <span className="ml-auto hidden font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper/45 sm:block">
              Applied edits are undoable
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---- Idle / pending — the prompt bar --------------------------------------
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex flex-col items-center gap-2 px-6">
      {error ? (
        <div className="pointer-events-auto w-full max-w-[640px] rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2 text-[12px] leading-[1.45] text-warn animate-in fade-in-0 duration-200">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          'pointer-events-auto flex h-12 w-full max-w-[640px] items-center gap-3 rounded-pill border bg-ink pl-4 pr-2 text-paper shadow-card transition-colors',
          pending ? 'border-rust/60' : 'border-ink/20 focus-within:border-rust/60',
        )}
      >
        <span
          aria-hidden
          className={cn('text-[15px] text-rust-light', pending && 'motion-safe:animate-pulse')}
        >
          ✦
        </span>
        {pending ? (
          <p className="flex-1 truncate text-[13.5px] text-paper/70 motion-safe:animate-pulse">
            Drafting your edit{instruction ? ` — “${instruction.trim()}”` : ''}…
          </p>
        ) : (
          <input
            ref={inputRef}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder='Tell the AI what to change — e.g. "make the hero more premium"'
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-paper placeholder:text-paper/45 focus:outline-none"
          />
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || !instruction.trim()}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-rust px-3.5 text-[12px] font-bold text-paper transition-colors hover:bg-rust-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          Edit <span aria-hidden>→</span>
        </button>
      </div>
      {!pending && !instruction ? (
        <div className="pointer-events-auto hidden items-center gap-1.5 md:flex">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setInstruction(suggestion);
                inputRef.current?.focus();
              }}
              className="rounded-pill border border-ink/15 bg-card/85 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet backdrop-blur transition-colors hover:border-rust hover:text-rust"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
