'use client';

// =============================================================================
// CopyableId — a monospace identifier with a one-click copy affordance. Used
// to surface raw ids (e.g. a lead's form `submission_id`) where an operator
// may need the exact value to reconcile a record against another table.
//
// The id wraps (`break-all`) so a full UUID stays visible inside a narrow
// rail row rather than overflowing.
// =============================================================================

import { useState } from 'react';

export function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {
        // Clipboard unavailable (insecure context / denied) — no-op; the
        // value is still selectable in the DOM.
      },
    );
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : `${value} — click to copy`}
      className="group inline-flex items-center gap-1.5 text-right"
    >
      <span className="break-all font-mono text-[10px] font-normal leading-tight text-ink">
        {value}
      </span>
      <span
        aria-hidden
        className="shrink-0 font-mono text-[10px] text-ink-quiet transition-colors group-hover:text-rust"
      >
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  );
}
