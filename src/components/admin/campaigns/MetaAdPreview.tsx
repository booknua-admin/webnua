'use client';

// =============================================================================
// MetaAdPreview — visual mockup of how a Facebook News Feed ad will render.
//
// Phase 7.5 Session 1. Mounted in the launch wizard's step 4 + step 5
// review. Updates live as the operator picks a variant + uploads an
// image. This is the "what does the customer actually see?" sanity
// check before spend.
//
// Visual structure (Meta News Feed link-ad shape):
//   ┌─────────────────────────────────────┐
//   │ ◯  Page name              ⋯         │   ← header
//   │    Sponsored · ⌖                    │
//   │                                     │
//   │ Primary text goes here, up to       │   ← primary text (above image)
//   │ ~125 characters.                    │
//   │                                     │
//   │ ┌─────────────────────────────────┐ │
//   │ │           IMAGE                 │ │   ← image (1.91:1 ish)
//   │ └─────────────────────────────────┘ │
//   │ ┌─────────────────────────────────┐ │
//   │ │ business.example.com            │ │   ← link host
//   │ │ Headline goes here              │ │   ← headline (bold)
//   │ │ Description goes here    [CTA]  │ │   ← description + CTA button
//   │ └─────────────────────────────────┘ │
//   │                                     │
//   │ ♥ Like  💬 Comment  ↗ Share         │   ← reactions (decorative)
//   └─────────────────────────────────────┘
//
// All static — no interactivity. Click handlers are decorative; the
// CTA button just shows the chosen Meta CTA enum value.
//
// Webnua palette only (no shadcn role tokens beyond bg-card on the
// outer surface, per CLAUDE.md design-system bright line).
// =============================================================================

import { Eyebrow } from '@/components/ui/eyebrow';

export type MetaAdPreviewProps = {
  /** Page identity (left of header). */
  pageName: string;
  pageLogoUrl: string | null;

  /** Creative content. */
  primaryText: string;
  headline: string;
  description: string;
  ctaType: string;
  imageUrl: string | null;
  /** Brand accent (CTA button colour). Default rust. */
  accentColor?: string;

  /** Optional host shown above the headline in the link card.
   *  Derived from the campaign's linkUrl. */
  linkHost?: string;

  /** Optional callout banner at the top (e.g. "// FEED AD PREVIEW"). */
  caption?: string;
};

// --- CTA label map ---------------------------------------------------------
//
// Meta's CTA button labels are localised but the enum value → english
// label is stable enough to render here. If the operator picks an enum
// not in the map, we render the raw enum value title-cased.

const CTA_LABEL: Record<string, string> = {
  LEARN_MORE: 'Learn more',
  BOOK_NOW: 'Book now',
  GET_QUOTE: 'Get quote',
  CONTACT_US: 'Contact us',
  SIGN_UP: 'Sign up',
  GET_OFFER: 'Get offer',
  APPLY_NOW: 'Apply now',
  SHOP_NOW: 'Shop now',
};

function ctaLabel(cta: string): string {
  return (
    CTA_LABEL[cta] ??
    cta
      .toLowerCase()
      .split('_')
      .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
      .join(' ')
  );
}

// ---------------------------------------------------------------------------

export function MetaAdPreview({
  pageName,
  pageLogoUrl,
  primaryText,
  headline,
  description,
  ctaType,
  imageUrl,
  accentColor = '#d24317',
  linkHost,
  caption,
}: MetaAdPreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      {caption ? (
        <Eyebrow tone="quiet" bullet>
          {caption}
        </Eyebrow>
      ) : null}
      <div
        className="overflow-hidden rounded-[12px] border border-ink/15 bg-card shadow-card"
        data-slot="meta-ad-preview"
      >
        {/* --- header --- */}
        <div className="flex items-start gap-2.5 px-3.5 pt-3 pb-2">
          <PageAvatar logoUrl={pageLogoUrl} fallbackName={pageName} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="truncate text-[13px] font-semibold text-ink">
              {pageName || 'Your Business'}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-ink-quiet">
              <span>Sponsored</span>
              <span>·</span>
              <GlobeIcon />
            </div>
          </div>
          <DotsIcon />
        </div>

        {/* --- primary text --- */}
        {primaryText ? (
          <div className="px-3.5 pb-2.5 text-[14px] leading-[1.4] text-ink-soft">
            {primaryText}
          </div>
        ) : (
          <div className="px-3.5 pb-2.5 text-[13px] italic text-ink-quiet">
            Primary text appears here once you pick a variant.
          </div>
        )}

        {/* --- image --- */}
        <div className="relative aspect-[1.91/1] w-full bg-paper-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// AD IMAGE'}
              </div>
              <div className="text-[12px] text-ink-quiet">
                Upload an image to see the preview
              </div>
            </div>
          )}
        </div>

        {/* --- link card --- */}
        <div className="flex items-center justify-between gap-3 bg-paper-2 px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            {linkHost ? (
              <div className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                {linkHost}
              </div>
            ) : null}
            <div className="truncate text-[15px] font-semibold leading-tight text-ink">
              {headline || 'Headline appears here'}
            </div>
            {description ? (
              <div className="mt-0.5 truncate text-[12px] text-ink-quiet">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            disabled
            className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors"
            style={{ backgroundColor: accentColor }}
          >
            {ctaLabel(ctaType)}
          </button>
        </div>

        {/* --- reactions --- */}
        <div className="flex items-center justify-between border-t border-ink/8 px-3.5 py-2 text-[12px] font-medium text-ink-quiet">
          <ReactionItem icon="♡" label="Like" />
          <ReactionItem icon="💬" label="Comment" />
          <ReactionItem icon="↗" label="Share" />
        </div>
      </div>
    </div>
  );
}

// --- bits ------------------------------------------------------------------

function PageAvatar({
  logoUrl,
  fallbackName,
}: {
  logoUrl: string | null;
  fallbackName: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (fallbackName?.trim()[0] ?? 'W').toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-paper">
      {initial}
    </div>
  );
}

function ReactionItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[14px] leading-none">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a14 14 0 0 1 0 20M12 2a14 14 0 0 0 0 20" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-ink-quiet"
      aria-hidden
    >
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}
