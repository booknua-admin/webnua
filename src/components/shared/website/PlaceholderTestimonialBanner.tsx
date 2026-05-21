'use client';

// =============================================================================
// PlaceholderTestimonialBanner (B16) — the editor nudge shown at the top of
// the fields panel when a reviews section still carries AI-drafted placeholder
// testimonials. It signals that the quotes + author names are AI-invented and
// must be replaced with real customer reviews before publishing.
//
// Dismissable per-section (localStorage, keyed by section id) so an operator
// who has acknowledged it is not nagged on every reopen. Self-gating: renders
// null unless the section is a reviews section that still has unedited
// placeholders — so the mount site can render it unconditionally.
// =============================================================================

import { useState } from 'react';

import { uneditedPlaceholderCount } from '@/lib/website/placeholder-testimonials';
import type { Section } from '@/lib/website/types';

const ACK_PREFIX = 'webnua:testimonial-placeholder-ack:';

function isAcknowledged(sectionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ACK_PREFIX + sectionId) === '1';
  } catch {
    return false;
  }
}

export function PlaceholderTestimonialBanner({ section }: { section: Section }) {
  const count = uneditedPlaceholderCount(section);
  const [acknowledged, setAcknowledged] = useState(() => isAcknowledged(section.id));

  if (count === 0 || acknowledged) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(ACK_PREFIX + section.id, '1');
    } catch {
      // localStorage unavailable — dismiss for this mount only.
    }
    setAcknowledged(true);
  };

  return (
    <div className="mb-4 rounded-lg border border-amber/30 bg-amber/[0.08] px-3.5 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber">
        ✦ AI-drafted placeholder
      </p>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-mid">
        {count === 1
          ? 'This testimonial was AI-drafted as a placeholder. '
          : `${count} testimonials here were AI-drafted as placeholders. `}
        Replace {count === 1 ? 'it' : 'them'} with real customer reviews before publishing —
        invented testimonials can damage credibility.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet transition-colors hover:text-ink"
      >
        Got it — dismiss
      </button>
    </div>
  );
}
