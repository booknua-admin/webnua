-- =============================================================================
-- 0098 — Rebrand the two operator-facing platform email templates
-- (lead_notification, lead_digest) with the standard Webnua HTML chrome
-- (paper bg, white card, rust eyebrow, mono footer) and a real card-list
-- for the digest summary.
--
-- The bodies in `lib/email/default-templates.ts` were updated in the same
-- changeset; this migration keeps the seeded platform rows in lockstep so
-- the live DB sends the new chrome immediately (no redeploy gap on the
-- platform-level resolver path).
-- =============================================================================

update public.platform_email_templates
   set body_html =
        '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">' ||
        '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">' ||
        '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// New lead</div>' ||
        '<h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 18px 0;color:#0a0a0a;">New lead in {{client.businessName}}.</h1>' ||
        '<div style="margin:0 0 16px 0;padding:14px 16px;background:#f5f1ea;border-left:3px solid #d24317;border-radius:6px;">' ||
        '<div style="font-weight:800;font-size:15px;color:#0a0a0a;margin-bottom:4px;">{{lead.fullName}}</div>' ||
        '<div style="font-size:13px;color:#4a4a45;line-height:1.55;">{{lead.phone}}<br/>{{lead.email}}</div>' ||
        '</div>' ||
        '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin:0 0 6px 0;">// About</div>' ||
        '<p style="font-size:14px;line-height:1.55;color:#0a0a0a;margin:0 0 10px 0;font-weight:600;">{{lead.service}}</p>' ||
        '<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;font-style:italic;">{{lead.preview}}</p>' ||
        '<p style="margin:0;">' ||
        '<a href="{{platform.inboxLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open in inbox →</a>' ||
        '</p>' ||
        '</div>' ||
        '<div style="text-align:center;font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>' ||
        '</body></html>',
       body_text =
        'New lead in {{client.businessName}}' || E'\n\n' ||
        '{{lead.fullName}}' || E'\n' ||
        '{{lead.phone}}' || E'\n' ||
        '{{lead.email}}' || E'\n\n' ||
        'About: {{lead.service}}' || E'\n\n' ||
        '"{{lead.preview}}"' || E'\n\n' ||
        'Open in inbox: {{platform.inboxLink}}'
 where template_key = 'lead_notification';

update public.platform_email_templates
   set body_html =
        '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">' ||
        '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">' ||
        '<div style="font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// New leads</div>' ||
        '<h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 18px 0;color:#0a0a0a;">{{digest.count}} new leads in {{client.businessName}}.</h1>' ||
        '<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 16px 0;">Captured in the last hour. Tap any one to open in the Webnua inbox.</p>' ||
        '<div style="margin:0 0 22px 0;">{{digest.summaryHtml}}</div>' ||
        '<p style="margin:0;">' ||
        '<a href="{{platform.inboxLink}}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open inbox →</a>' ||
        '</p>' ||
        '</div>' ||
        '<div style="text-align:center;font-family:''JetBrains Mono'',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>' ||
        '</body></html>',
       body_text =
        '{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.' || E'\n\n' ||
        '{{digest.summary}}' || E'\n\n' ||
        'Open the inbox: {{platform.inboxLink}}'
 where template_key = 'lead_digest';
