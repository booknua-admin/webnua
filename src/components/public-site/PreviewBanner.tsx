'use client';

// =============================================================================
// PreviewBanner — Pattern B's floating "Preview mode" pill on the public site.
//
// Mounted by PublicSiteRenderer when the resolver returns `isPreview: true`
// (client lifecycle_status in 'preview' / 'onboarding'). The banner:
//   • Says "Preview mode — publish to go live" in the brand voice
//   • Floats at the bottom-center, fixed positioned so it follows scroll
//   • Carries a Dashboard CTA back to the app so the owner can hit Publish
//
// Form behaviour on a preview site lives in FormBlock (which reads the
// `publicSubmit.isPreview` flag from the slot context); this banner is the
// site-wide visual cue.
//
// The dashboard link is built at render time from the platform's APP_HOST
// — the published renderer runs server-side so it has access via the
// `appHref` prop. The component itself is `'use client'` because we want
// it to render with the rest of the (interactive) page hydration.
// =============================================================================

type PreviewBannerProps = {
  /** Full URL to the workspace dashboard, e.g. `https://app.webnua.com/dashboard`.
   *  Passed by the renderer so this component stays env-agnostic. */
  dashboardHref: string;
};

export function PreviewBanner({ dashboardHref }: PreviewBannerProps) {
  return (
    <div
      data-slot="preview-banner"
      // Fixed bottom-center pill. `pointer-events: none` on the wrapper +
      // `pointer-events: auto` on the inner pill stops the wrapper from
      // capturing clicks across the full bottom strip — only the pill is
      // interactive. z-50 to sit above the site's own sticky/overlay header.
      style={{
        position: 'fixed',
        bottom: '20px',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '14px',
          background: '#0a0a0a',
          color: '#f5f1ea',
          borderRadius: '999px',
          padding: '10px 18px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
          fontSize: '13px',
          fontWeight: 600,
          lineHeight: 1,
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#e8743b',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '999px',
              background: '#e8743b',
            }}
          />
          PREVIEW MODE
        </span>
        <span style={{ color: '#c9c0b0', fontWeight: 500 }}>
          forms disabled · not public yet
        </span>
        <a
          href={dashboardHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#d24317',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '7px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Publish to go live →
        </a>
      </div>
    </div>
  );
}
