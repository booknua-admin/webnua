'use client';

// =============================================================================
// EnhanceableTextarea — textarea + ✦ enhance button + accept/reject preview.
//
// The accept/reject pattern is deliberate: AI enhancement should never
// silently replace the user's wording. On click, the component fetches the
// enhanced version, shows it alongside the original (or above the textarea
// for narrow surfaces), and offers explicit "Use this" / "Keep mine"
// buttons. Accept replaces the value; reject discards the preview. Errors
// surface inline beneath the textarea — same warn-tinted treatment used
// elsewhere in the wizard. See CLAUDE.md parked decision.
// =============================================================================

import { useState } from 'react';

import { AppError } from '@/lib/errors';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  /** The async enhancer the parent provides. Receives the current value,
   *  returns the enhanced one. Allows the offer field to keep its specific
   *  /api/enhance-offer route while other fields use /api/enhance-field. */
  enhance: (current: string) => Promise<string>;
  /** Optional minimum length under which the enhance button is disabled.
   *  Keeps users from burning a Sonnet call on a one-word input. */
  minLength?: number;
  className?: string;
};

export function EnhanceableTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
  enhance,
  minLength = 8,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEnhance = !busy && value.trim().length >= minLength && !preview;

  const runEnhance = async () => {
    setError(null);
    setBusy(true);
    try {
      const enhanced = await enhance(value);
      setPreview(enhanced);
    } catch (err) {
      const msg =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Enhancement failed.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (preview) onChange(preview);
    setPreview(null);
  };

  const reject = () => setPreview(null);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-start gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={busy || !!preview}
          className={cn(
            'w-full rounded-md border border-rule bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-rust',
            (busy || preview) && 'opacity-60',
          )}
        />
        <button
          type="button"
          disabled={!canEnhance}
          onClick={runEnhance}
          className="shrink-0 rounded-pill border border-rust/40 bg-rust-soft px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust transition-colors hover:bg-rust hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Enhancing…' : '✦ Enhance with AI'}
        </button>
      </div>

      {preview ? (
        <div className="flex flex-col gap-2 rounded-md border border-rust/40 bg-rust-soft/60 px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            ✦ AI-enhanced preview
          </p>
          <p className="whitespace-pre-wrap text-[13px] text-ink">{preview}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={accept}
              className="rounded-md bg-rust px-3 py-1.5 text-[12px] font-bold text-paper transition-colors hover:bg-rust-deep"
            >
              Use this →
            </button>
            <button
              type="button"
              onClick={reject}
              className="rounded-md border border-rule bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-mid transition-colors hover:border-rust/60 hover:text-ink"
            >
              Keep mine
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
            Enhancement error
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
