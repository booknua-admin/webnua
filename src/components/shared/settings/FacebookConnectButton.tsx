'use client';

// =============================================================================
// FacebookConnectButton — Meta-brand-compliant "Continue with Facebook" CTA.
//
// Meta App Review requires the OAuth initiation button to match their
// brand guidelines (https://developers.facebook.com/brand/resources):
//   • Background: #1877F2 (the locked Facebook brand blue)
//   • Text: "Continue with Facebook" in white, weight 600+
//   • Facebook "f" glyph on the left
//   • Min height ~40px, 6px corner radius
//   • System sans (SF Pro / Helvetica Neue / Arial)
//
// Reviewers regularly bounce apps for off-brand login buttons (custom
// colors, missing logo, wrong copy) — using the canonical Webnua
// `Button` for the Meta OAuth init was the most common cosmetic
// rejection trigger. This component is a deliberate exception to the
// Webnua palette discipline (see CLAUDE.md design-system section): the
// brand-color rule from Meta overrides ours for this single button.
// =============================================================================

import { cn } from '@/lib/utils';

export function FacebookConnectButton({
  onClick,
  disabled = false,
  label = 'Continue with Facebook',
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** Override the standard label. Allowed by Meta's brand guidelines:
   *  "Continue with Facebook" | "Log in with Facebook" | "Sign up with
   *  Facebook" | "Connect with Facebook". Default fits the OAuth
   *  consent context here. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Meta's brand colors are inlined rather than via Tailwind tokens
      // because they MUST be #1877F2 / white — Webnua's design tokens
      // are deliberately the wrong palette for this single component.
      style={{ backgroundColor: '#1877F2', color: '#ffffff' }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5',
        'font-sans text-[14px] font-semibold leading-none',
        'transition-opacity duration-150',
        'hover:opacity-90 active:opacity-80',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      aria-label={label}
    >
      <FacebookGlyph />
      <span>{label}</span>
    </button>
  );
}

/** The Facebook "f" mark in white. Inlined SVG so the bundle stays
 *  free of an extra dependency. Path is the official Facebook brand
 *  mark — the f sits inside the implicit blue background of the
 *  parent button. */
function FacebookGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12Z" />
    </svg>
  );
}
