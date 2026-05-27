// =============================================================================
// Weekly + monthly performance digest — HTML body builders.
//
// SoT-mirrored: the body strings here MUST stay in lockstep with migration
// 0103_performance_digest_templates.sql. The migration is the platform-level
// seed (one row per template_key on platform_email_templates) the production
// cron-driven send path reads; this module is the same content reflected in
// TypeScript so /api/dev/test-emails can preview-send without first applying
// the migration. When editing the HTML: change BOTH the migration and this
// module in the same commit — same precedent as lib/sms/default-templates.ts
// and lib/email/default-templates.ts.
//
// Render is dumb {{var}} substitution — no logic, no formatting. The caller
// builds the context strings (numeric formatting, date labels, trend signs).
//
// SERVER-ONLY — both consumers (the test route + the future digest job
// handler) run server-side. The brand footer is appended at render time the
// same way the existing branded emails do it.
// =============================================================================

import { EMAIL_BRAND_FOOTER, EMAIL_BRAND_FOOTER_TEXT } from './footer';

// --- context types -----------------------------------------------------------

/** The closed set of variables the weekly template substitutes. The cron
 *  worker builds this from per-client Supabase reads. */
export type WeeklyDigestContext = {
  businessName: string;
  windowLabel: string;
  leadsCount: string;
  leadsTrend: string;
  bookingsCount: string;
  bookingsTrend: string;
  reviewsCount: string;
  reviewsAvg: string;
  conversionRate: string;
  conversionTrend: string;
  topSource: string;
  dashboardLink: string;
};

/** Monthly extends weekly with three monthly-only fields. */
export type MonthlyDigestContext = WeeklyDigestContext & {
  monthLabel: string;
  highlight: string;
  revenue: string;
};

// --- HTML body templates (SoT-mirror of migration 0103) ----------------------

const WEEKLY_HTML = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Weekly round-up</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px 0;color:#0a0a0a;">Your week at {{businessName}}.</h1>
    <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6e685c;margin:0 0 22px 0;">{{windowLabel}}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px;margin:0 0 22px 0;">
      <tr>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Leads</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{leadsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{leadsTrend}}</div>
        </td>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Bookings</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{bookingsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{bookingsTrend}}</div>
        </td>
      </tr>
      <tr>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Reviews</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{reviewsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">Avg {{reviewsAvg}}</div>
        </td>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Conversion</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{conversionRate}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{conversionTrend}}</div>
        </td>
      </tr>
    </table>
    <div style="margin:0 0 22px 0;padding:14px 16px;background:#ffffff;border-left:3px solid #d24317;border-radius:6px;border:1px solid #c9c0b0;">
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:4px;">// Top source this week</div>
      <div style="font-size:14px;color:#0a0a0a;font-weight:600;">{{topSource}}</div>
    </div>
    <p style="margin:0 0 4px 0;">
      <a href="{{dashboardLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open dashboard →</a>
    </p>
    <p style="font-size:12px;color:#6e685c;margin:18px 0 0 0;line-height:1.5;">
      You're receiving this because weekly digests are on for your account.
      <a href="{{dashboardLink}}/settings/notifications" style="color:#d24317;text-decoration:none;">Manage preferences →</a>
    </p>
  </div>`;

const MONTHLY_HTML = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Month in review</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px 0;color:#0a0a0a;">{{monthLabel}} at {{businessName}}.</h1>
    <p style="font-size:14px;color:#4a4a45;margin:0 0 22px 0;line-height:1.5;">{{highlight}}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px;margin:0 0 16px 0;">
      <tr>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Leads</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{leadsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{leadsTrend}}</div>
        </td>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Bookings</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{bookingsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{bookingsTrend}}</div>
        </td>
      </tr>
      <tr>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Reviews</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{reviewsCount}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">Avg {{reviewsAvg}}</div>
        </td>
        <td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Conversion</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{conversionRate}}</div>
          <div style="font-size:11px;color:#6e685c;margin-top:4px;">{{conversionTrend}}</div>
        </td>
      </tr>
    </table>
    <div style="margin:0 0 22px 0;padding:18px 20px;background:#0a0a0a;border-radius:10px;color:#f5f1ea;">
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#e8743b;font-weight:700;margin-bottom:4px;">// Revenue</div>
      <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#f5f1ea;line-height:1;">{{revenue}}</div>
      <div style="font-size:11px;color:#a8a39a;margin-top:6px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0.06em;">From bookings completed in {{monthLabel}}</div>
    </div>
    <div style="margin:0 0 22px 0;padding:14px 16px;background:#ffffff;border-left:3px solid #d24317;border-radius:6px;border:1px solid #c9c0b0;">
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:4px;">// Top source</div>
      <div style="font-size:14px;color:#0a0a0a;font-weight:600;">{{topSource}}</div>
    </div>
    <p style="margin:0 0 4px 0;">
      <a href="{{dashboardLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open dashboard →</a>
    </p>
    <p style="font-size:12px;color:#6e685c;margin:18px 0 0 0;line-height:1.5;">
      You're receiving this because monthly digests are on for your account.
      <a href="{{dashboardLink}}/settings/notifications" style="color:#d24317;text-decoration:none;">Manage preferences →</a>
    </p>
  </div>`;

// --- render -----------------------------------------------------------------

/** Substitute {{key}} placeholders in `template` from `ctx`. Unknown keys
 *  pass through as `[[key]]` so a missing variable is visible in the output
 *  instead of silently disappearing. */
function substitute(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, raw: string) => {
    const key = raw.trim();
    return ctx[key] ?? `[[${key}]]`;
  });
}

/** Render the weekly digest HTML body — chrome + appended brand footer. */
export function buildWeeklyDigestHtml(ctx: WeeklyDigestContext): string {
  return substitute(WEEKLY_HTML, ctx) + EMAIL_BRAND_FOOTER + '</body></html>';
}

/** Render the monthly digest HTML body. */
export function buildMonthlyDigestHtml(ctx: MonthlyDigestContext): string {
  return substitute(MONTHLY_HTML, ctx) + EMAIL_BRAND_FOOTER + '</body></html>';
}

/** Plain-text alt for the weekly digest. Mail clients fall back to this when
 *  HTML is blocked, and Gmail uses it to derive the preview snippet. */
export function buildWeeklyDigestText(ctx: WeeklyDigestContext): string {
  return [
    `Your week at ${ctx.businessName} — ${ctx.windowLabel}`,
    '',
    `LEADS: ${ctx.leadsCount} (${ctx.leadsTrend})`,
    `BOOKINGS: ${ctx.bookingsCount} (${ctx.bookingsTrend})`,
    `REVIEWS: ${ctx.reviewsCount} (avg ${ctx.reviewsAvg})`,
    `CONVERSION: ${ctx.conversionRate} (${ctx.conversionTrend})`,
    '',
    `Top source this week: ${ctx.topSource}`,
    '',
    `Open dashboard: ${ctx.dashboardLink}`,
    '',
    `Manage preferences: ${ctx.dashboardLink}/settings/notifications`,
    '',
    EMAIL_BRAND_FOOTER_TEXT,
  ].join('\n');
}

/** Plain-text alt for the monthly digest. */
export function buildMonthlyDigestText(ctx: MonthlyDigestContext): string {
  return [
    `${ctx.monthLabel} at ${ctx.businessName}`,
    '',
    ctx.highlight,
    '',
    `LEADS: ${ctx.leadsCount} (${ctx.leadsTrend})`,
    `BOOKINGS: ${ctx.bookingsCount} (${ctx.bookingsTrend})`,
    `REVIEWS: ${ctx.reviewsCount} (avg ${ctx.reviewsAvg})`,
    `CONVERSION: ${ctx.conversionRate} (${ctx.conversionTrend})`,
    '',
    `REVENUE: ${ctx.revenue} (from bookings completed in ${ctx.monthLabel})`,
    `TOP SOURCE: ${ctx.topSource}`,
    '',
    `Open dashboard: ${ctx.dashboardLink}`,
    '',
    `Manage preferences: ${ctx.dashboardLink}/settings/notifications`,
    '',
    EMAIL_BRAND_FOOTER_TEXT,
  ].join('\n');
}

// --- standard subjects -------------------------------------------------------

export function buildWeeklyDigestSubject(ctx: WeeklyDigestContext): string {
  return `Your week at ${ctx.businessName} — ${ctx.leadsCount} new leads`;
}

export function buildMonthlyDigestSubject(ctx: MonthlyDigestContext): string {
  return `${ctx.monthLabel} at ${ctx.businessName} — ${ctx.leadsCount} leads`;
}

// --- sample contexts (for /api/dev/test-emails) -----------------------------

export const SAMPLE_WEEKLY_CONTEXT: WeeklyDigestContext = {
  businessName: 'Dublin Cleaning Co (test)',
  windowLabel: '20–26 May 2026',
  leadsCount: '14',
  leadsTrend: '+3 vs prior week',
  bookingsCount: '9',
  bookingsTrend: '+2 vs prior week',
  reviewsCount: '4',
  reviewsAvg: '4.8★',
  conversionRate: '64%',
  conversionTrend: '+8pp vs prior week',
  topSource: 'Funnel: emergency-call-out (8 leads)',
  dashboardLink: 'https://app.webnua.com/dashboard',
};

export const SAMPLE_MONTHLY_CONTEXT: MonthlyDigestContext = {
  businessName: 'Dublin Cleaning Co (test)',
  windowLabel: 'May 2026',
  monthLabel: 'May 2026',
  highlight:
    'Strongest month for new leads since you launched — bookings up 38% on April, and three of those leads came in over a quiet bank-holiday weekend.',
  leadsCount: '52',
  leadsTrend: '+14 vs April',
  bookingsCount: '34',
  bookingsTrend: '+9 vs April',
  reviewsCount: '17',
  reviewsAvg: '4.9★',
  conversionRate: '65%',
  conversionTrend: '+4pp vs April',
  revenue: '€4,820',
  topSource: 'Funnel: emergency-call-out (28 leads · 53% of total)',
  dashboardLink: 'https://app.webnua.com/dashboard',
};
