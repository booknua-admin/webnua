-- =============================================================================
-- 0103 — Weekly + monthly performance digest emails (Stream B: platform →
--        sub-account owner).
--
-- These are not automations the client owns — they are platform-level
-- notifications Webnua sends to each sub-account about their own business
-- performance. Two cadences:
--
--   weekly_performance_digest  — fired every Monday at 08:00 UTC for the
--                                trailing 7 days
--   monthly_performance_digest — fired on the 1st of each month at 08:00 UTC
--                                for the prior calendar month
--
-- Operator-managed copy in platform_email_templates (single row per
-- template_key — same shape as lead_notification / lead_digest from
-- migration 0079). Branded HTML matches the chrome standardised by
-- migrations 0098 + 0099 (paper bg, white card, rust eyebrow, branded
-- footer appended at send-time via lib/email/footer.ts).
--
-- Recipients: configured per-client on notification_preferences (added by
-- migration 0063). Two new columns added here:
--   notify_weekly_digest   — default true; sub-account owner opts in/out
--   notify_monthly_digest  — default true
-- Both default true so a freshly-created client gets the digests
-- automatically without opt-in friction.
--
-- The data-gathering logic + the send job handlers (send_weekly_digest /
-- send_monthly_digest) + the pg_cron schedules land in 0104; this migration
-- is just the template + opt-out columns so the seed can be reviewed in
-- isolation.
-- =============================================================================

-- 1. Extend the platform_email_templates check constraint to include the two
--    new digest keys.
alter table public.platform_email_templates
  drop constraint if exists platform_email_templates_template_key_check;

alter table public.platform_email_templates
  add constraint platform_email_templates_template_key_check
    check (template_key in
      ('lead_notification', 'lead_digest',
       'weekly_performance_digest', 'monthly_performance_digest'));

-- 2. Extend notification_preferences with the two opt-out booleans.
alter table public.notification_preferences
  add column if not exists notify_weekly_digest boolean not null default true,
  add column if not exists notify_monthly_digest boolean not null default true;

comment on column public.notification_preferences.notify_weekly_digest is
  'Whether this recipient receives the weekly performance digest (Mondays 08:00 UTC).';
comment on column public.notification_preferences.notify_monthly_digest is
  'Whether this recipient receives the monthly performance digest (1st of month 08:00 UTC).';

-- 3. Seed the weekly performance digest template. Branded HTML mirrors the
--    chrome from migration 0098 — paper background, white card, rust
--    mono eyebrow, 22px Inter Tight headline, paper-tinted metric tiles in a
--    2x2 grid (mail clients can't render CSS grid reliably so we use
--    table-based layout instead), rust CTA. Plain-text body strips the
--    chrome and just lists the metrics.
--
--    Template variables (substituted at send time by lib/email/templates.ts
--    `renderEmail`):
--      {{client.businessName}}       — sub-account name
--      {{digest.windowLabel}}        — e.g. "20–26 May 2026"
--      {{digest.leadsCount}}         — leads received this week
--      {{digest.leadsTrend}}         — e.g. "+3 vs prior week" or "no change"
--      {{digest.bookingsCount}}      — bookings created
--      {{digest.bookingsTrend}}
--      {{digest.reviewsCount}}       — GBP reviews received
--      {{digest.reviewsAvg}}         — e.g. "4.8★" or "—" when none
--      {{digest.conversionRate}}     — leads→booked %, eg. "32%"
--      {{digest.conversionTrend}}
--      {{digest.topSource}}          — e.g. "Funnel: emergency-call-out"
--      {{platform.dashboardLink}}    — deep link to /dashboard for this client
--
insert into public.platform_email_templates (template_key, subject, body_html, body_text)
values (
  'weekly_performance_digest',
  'Your week at {{client.businessName}} — {{digest.leadsCount}} new leads',
  '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">' ||
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">' ||
    -- Eyebrow
    '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Weekly round-up</div>' ||
    -- Headline
    '<h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px 0;color:#0a0a0a;">Your week at {{client.businessName}}.</h1>' ||
    '<p style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6e685c;margin:0 0 22px 0;">{{digest.windowLabel}}</p>' ||
    -- 2x2 metric grid (table for mail-client compatibility)
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px;margin:0 0 22px 0;">' ||
      '<tr>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Leads</div>' ||
          '<div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.leadsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.leadsTrend}}</div>' ||
        '</td>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Bookings</div>' ||
          '<div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.bookingsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.bookingsTrend}}</div>' ||
        '</td>' ||
      '</tr>' ||
      '<tr>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Reviews</div>' ||
          '<div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.reviewsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">Avg {{digest.reviewsAvg}}</div>' ||
        '</td>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Conversion</div>' ||
          '<div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.conversionRate}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.conversionTrend}}</div>' ||
        '</td>' ||
      '</tr>' ||
    '</table>' ||
    -- Top source line
    '<div style="margin:0 0 22px 0;padding:14px 16px;background:#ffffff;border-left:3px solid #d24317;border-radius:6px;border:1px solid #c9c0b0;">' ||
      '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:4px;">// Top source this week</div>' ||
      '<div style="font-size:14px;color:#0a0a0a;font-weight:600;">{{digest.topSource}}</div>' ||
    '</div>' ||
    -- CTA
    '<p style="margin:0 0 4px 0;">' ||
      '<a href="{{platform.dashboardLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open dashboard →</a>' ||
    '</p>' ||
    -- Sub line
    '<p style="font-size:12px;color:#6e685c;margin:18px 0 0 0;line-height:1.5;">' ||
      'You''re receiving this because weekly digests are on for your account. ' ||
      '<a href="{{platform.dashboardLink}}/settings/notifications" style="color:#d24317;text-decoration:none;">Manage preferences →</a>' ||
    '</p>' ||
    '</div>' ||
    '</body></html>',
  -- Plain-text body
  'Your week at {{client.businessName}} — {{digest.windowLabel}}' || E'\n\n' ||
    'LEADS: {{digest.leadsCount}} ({{digest.leadsTrend}})' || E'\n' ||
    'BOOKINGS: {{digest.bookingsCount}} ({{digest.bookingsTrend}})' || E'\n' ||
    'REVIEWS: {{digest.reviewsCount}} (avg {{digest.reviewsAvg}})' || E'\n' ||
    'CONVERSION: {{digest.conversionRate}} ({{digest.conversionTrend}})' || E'\n\n' ||
    'Top source this week: {{digest.topSource}}' || E'\n\n' ||
    'Open dashboard: {{platform.dashboardLink}}' || E'\n\n' ||
    'Manage preferences: {{platform.dashboardLink}}/settings/notifications'
)
on conflict (template_key) do update set
  subject = excluded.subject,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  last_edited_at = now();

-- 4. Seed the monthly performance digest template. Same chrome, swapped
--    eyebrow + headline + the "highlights" insight band (which weekly lacks
--    because a week is too short for meaningful month-over-month framing).
--
--    Additional variables (in addition to the weekly ones):
--      {{digest.monthLabel}}         — e.g. "May 2026"
--      {{digest.highlight}}          — one-sentence operator-summary (eg.
--                                       "Strongest month for new leads since
--                                       you launched.")
--      {{digest.revenue}}            — formatted total (eg. "€4,820") OR "—"
--                                       when bookings carry no price
--
insert into public.platform_email_templates (template_key, subject, body_html, body_text)
values (
  'monthly_performance_digest',
  '{{digest.monthLabel}} at {{client.businessName}} — {{digest.leadsCount}} leads',
  '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">' ||
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">' ||
    -- Eyebrow
    '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Month in review</div>' ||
    -- Headline
    '<h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px 0;color:#0a0a0a;">{{digest.monthLabel}} at {{client.businessName}}.</h1>' ||
    '<p style="font-size:14px;color:#4a4a45;margin:0 0 22px 0;line-height:1.5;">{{digest.highlight}}</p>' ||
    -- 2x2 metric grid
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px;margin:0 0 16px 0;">' ||
      '<tr>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Leads</div>' ||
          '<div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.leadsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.leadsTrend}}</div>' ||
        '</td>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Bookings</div>' ||
          '<div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.bookingsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.bookingsTrend}}</div>' ||
        '</td>' ||
      '</tr>' ||
      '<tr>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Reviews</div>' ||
          '<div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.reviewsCount}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">Avg {{digest.reviewsAvg}}</div>' ||
        '</td>' ||
        '<td width="50%" valign="top" style="background:#f5f1ea;border-radius:10px;padding:16px 18px;border:1px solid rgba(0,0,0,0.04);">' ||
          '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:6px;">Conversion</div>' ||
          '<div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">{{digest.conversionRate}}</div>' ||
          '<div style="font-size:11px;color:#6e685c;margin-top:4px;">{{digest.conversionTrend}}</div>' ||
        '</td>' ||
      '</tr>' ||
    '</table>' ||
    -- Revenue band (full-width)
    '<div style="margin:0 0 22px 0;padding:18px 20px;background:#0a0a0a;border-radius:10px;color:#f5f1ea;">' ||
      '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#e8743b;font-weight:700;margin-bottom:4px;">// Revenue</div>' ||
      '<div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#f5f1ea;line-height:1;">{{digest.revenue}}</div>' ||
      '<div style="font-size:11px;color:#a8a39a;margin-top:6px;font-family:''JetBrains Mono'',ui-monospace,monospace;letter-spacing:0.06em;">From bookings completed in {{digest.monthLabel}}</div>' ||
    '</div>' ||
    -- Top source line
    '<div style="margin:0 0 22px 0;padding:14px 16px;background:#ffffff;border-left:3px solid #d24317;border-radius:6px;border:1px solid #c9c0b0;">' ||
      '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin-bottom:4px;">// Top source</div>' ||
      '<div style="font-size:14px;color:#0a0a0a;font-weight:600;">{{digest.topSource}}</div>' ||
    '</div>' ||
    -- CTA
    '<p style="margin:0 0 4px 0;">' ||
      '<a href="{{platform.dashboardLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open dashboard →</a>' ||
    '</p>' ||
    -- Sub line
    '<p style="font-size:12px;color:#6e685c;margin:18px 0 0 0;line-height:1.5;">' ||
      'You''re receiving this because monthly digests are on for your account. ' ||
      '<a href="{{platform.dashboardLink}}/settings/notifications" style="color:#d24317;text-decoration:none;">Manage preferences →</a>' ||
    '</p>' ||
    '</div>' ||
    '</body></html>',
  -- Plain-text body
  '{{digest.monthLabel}} at {{client.businessName}}' || E'\n\n' ||
    '{{digest.highlight}}' || E'\n\n' ||
    'LEADS: {{digest.leadsCount}} ({{digest.leadsTrend}})' || E'\n' ||
    'BOOKINGS: {{digest.bookingsCount}} ({{digest.bookingsTrend}})' || E'\n' ||
    'REVIEWS: {{digest.reviewsCount}} (avg {{digest.reviewsAvg}})' || E'\n' ||
    'CONVERSION: {{digest.conversionRate}} ({{digest.conversionTrend}})' || E'\n\n' ||
    'REVENUE: {{digest.revenue}} (from bookings completed in {{digest.monthLabel}})' || E'\n' ||
    'TOP SOURCE: {{digest.topSource}}' || E'\n\n' ||
    'Open dashboard: {{platform.dashboardLink}}' || E'\n\n' ||
    'Manage preferences: {{platform.dashboardLink}}/settings/notifications'
)
on conflict (template_key) do update set
  subject = excluded.subject,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  last_edited_at = now();
