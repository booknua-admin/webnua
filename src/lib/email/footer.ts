// =============================================================================
// Shared email-footer constant — single source of truth for the Webnua brand
// footer that appears at the bottom of every Webnua → operator branded email
// (verification, welcome, re-engagement, invite, cancellation-warning,
// stripe payment-failed, lead_notification, lead_digest).
//
// The footer uses an absolute HTTPS URL for the logo image — mail clients
// can't fetch relative URLs or data: URIs reliably. The URL points at a
// static asset served from /public on the deployment. Recipient mail clients
// (Gmail, Outlook, Apple Mail) lazy-load remote images on first view; the
// `alt="Webnua"` fallback renders when images are blocked.
//
// Update the URL here when the deployment host changes — every branded
// sender + the platform_email_templates seeds read from this constant.
// =============================================================================

/** Absolute URL of the Webnua wordmark image used in email footers. The
 *  matching file must exist at `public/webnua-logo.png` on the deployment.
 *  Width is fixed at 120px in the footer composition. */
export const EMAIL_LOGO_URL = 'https://app.webnua.com/webnua-logo.png';

/** Pre-composed HTML footer block ready to drop into the bottom of any
 *  branded operator email. Uses inline styles only (mail clients strip
 *  <style> blocks). The image carries `alt="Webnua"` so blocked-image
 *  views still see the brand name. */
export const EMAIL_BRAND_FOOTER = `<div style="text-align:center;margin-top:18px;padding:0 16px;">
  <img src="${EMAIL_LOGO_URL}" width="100" alt="Webnua" style="display:inline-block;height:auto;border:0;outline:none;text-decoration:none;opacity:0.7;" />
</div>`;

/** Plain-text equivalent for text/plain bodies — just the brand name. */
export const EMAIL_BRAND_FOOTER_TEXT = '© Webnua';
