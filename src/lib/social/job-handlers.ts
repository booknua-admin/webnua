// =============================================================================
// Social calendar — job handlers (SERVER-ONLY).
//
// • generate_social_calendar — Sonnet drafts ~3 posts/week for the next 30
//   days from the client's brand (industry, services, audience, voice).
//   Drafts land as `social_posts` status='draft' — the owner approves from
//   /social before anything publishes. No invented reviews / stats / claims
//   (same anti-fabrication discipline as the site generator).
//
// • social_publish_due — the every-15-min cron sweep (migration 0122).
//   Publishes every APPROVED post whose scheduled_for has passed to the
//   client's connected Facebook Page; marks published / failed honestly.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';
import { publishFacebookPagePost } from '@/lib/integrations/meta-ads/page-posts';

import { SOCIAL_POST_KINDS, type SocialPostRow } from './types';

export const GENERATE_SOCIAL_CALENDAR_JOB = 'generate_social_calendar';
export const SOCIAL_PUBLISH_DUE_JOB = 'social_publish_due';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You write a month of social posts (Facebook Page) for a local service business. Direct, specific, locally grounded — never generic "Welcome to our page" filler.

Rules:
- Each caption 40-120 words, plain English, first person as the business. No corporate filler ("comprehensive", "leverage", "elevate").
- Mix the angles across the month: practical tips a homeowner can use, a seasonal note, the offer/service framing, a behind-the-scenes prompt, a "send us a photo" engagement prompt. Vary openings — never start two posts the same way.
- NEVER invent reviews, customer names, job counts, certifications, awards, or statistics. If you want social proof, frame it as an invitation ("tell us how we did") not a fabricated claim.
- hashtags: 3-5, locally relevant, space-separated with #.
- Spread dayOffset values roughly evenly (about 3 posts per week, none on the same day).

Output STRICT JSON only — an array:
[{"dayOffset": 1, "kind": "tip|offer|seasonal|behind_scenes|before_after", "caption": "...", "hashtags": "#a #b #c"}]`;

type DraftPost = { dayOffset: number; kind: string; caption: string; hashtags: string };

/** 09:30 local-ish in the client's timezone → UTC instant for a calendar
 *  date N days from now. Uses the same Intl approach as the quiet-hours
 *  helper — no date library. */
function scheduleInstant(daysFromNow: number, timezone: string): string {
  const day = new Date(Date.now() + daysFromNow * 86_400_000);
  const ymd = day.toISOString().slice(0, 10);
  // Resolve the tz offset at that date by comparing the wall clock the
  // timezone reports for a known UTC instant.
  const probe = new Date(`${ymd}T09:30:00Z`);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.format(probe); // "HH:MM" the tz shows at 09:30 UTC
    const [h, m] = parts.split(':').map(Number);
    const offsetMinutes = h * 60 + m - (9 * 60 + 30);
    return new Date(probe.getTime() - offsetMinutes * 60_000).toISOString();
  } catch {
    return probe.toISOString();
  }
}

registerJobHandler(GENERATE_SOCIAL_CALENDAR_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as { clientId?: unknown };
  const clientId = typeof payload.clientId === 'string' ? payload.clientId : null;
  if (!clientId) throw new Error('generate_social_calendar: missing clientId');
  if (!env.ANTHROPIC_API_KEY) return { skipped: 'anthropic-not-configured' };

  const db = getIntegrationDb();
  const [{ data: clientData }, { data: brandData }] = await Promise.all([
    db
      .from('clients')
      .select('name, service_area, industry, quiet_hours_timezone')
      .eq('id', clientId)
      .maybeSingle(),
    db
      .from('brands')
      .select('industry_category, audience_line, tagline, services, top_jobs_to_be_booked')
      .eq('client_id', clientId)
      .maybeSingle(),
  ]);
  const client = clientData as {
    name: string;
    service_area: string | null;
    industry: string | null;
    quiet_hours_timezone: string | null;
  } | null;
  if (!client) return { skipped: 'client-not-found' };
  const brand = brandData as {
    industry_category: string | null;
    audience_line: string | null;
    tagline: string | null;
    services: string[] | null;
    top_jobs_to_be_booked: string[] | null;
  } | null;

  const services = brand?.services?.length
    ? brand.services
    : (brand?.top_jobs_to_be_booked ?? []);
  const userMessage = [
    `Business: ${client.name}`,
    `Trade: ${brand?.industry_category || client.industry || 'local service business'}`,
    client.service_area ? `Service area: ${client.service_area}` : null,
    services.length ? `Services: ${services.join(', ')}` : null,
    brand?.audience_line ? `Audience: ${brand.audience_line}` : null,
    brand?.tagline ? `Tagline: ${brand.tagline}` : null,
    '',
    'Draft 13 posts for the next 30 days.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let drafts: DraftPost[];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not-an-array');
    drafts = parsed as DraftPost[];
  } catch {
    throw new Error('generate_social_calendar: model returned non-JSON output');
  }

  const timezone = client.quiet_hours_timezone || 'UTC';
  const validKinds = new Set<string>(SOCIAL_POST_KINDS);
  const rows = drafts
    .filter(
      (d) =>
        typeof d.caption === 'string' &&
        d.caption.trim().length > 0 &&
        Number.isFinite(d.dayOffset),
    )
    .slice(0, 20)
    .map((d) => ({
      client_id: clientId,
      status: 'draft',
      scheduled_for: scheduleInstant(
        Math.min(Math.max(Math.round(d.dayOffset), 1), 30),
        timezone,
      ),
      caption: d.caption.trim().slice(0, 4000),
      hashtags: typeof d.hashtags === 'string' ? d.hashtags.trim().slice(0, 300) : '',
      post_kind: validKinds.has(d.kind) ? d.kind : 'tip',
      created_via: 'ai',
    }));

  if (rows.length === 0) return { drafted: 0 };
  const { error } = await db.from('social_posts').insert(rows);
  if (error) throw new Error(`generate_social_calendar: insert — ${error.message}`);
  return { drafted: rows.length };
});

registerJobHandler(SOCIAL_PUBLISH_DUE_JOB, async () => {
  const db = getIntegrationDb();
  const { data: dueData, error } = await db
    .from('social_posts')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(25);
  if (error) throw new Error(`social_publish_due: read — ${error.message}`);
  const due = (dueData as SocialPostRow[] | null) ?? [];
  if (due.length === 0) return { published: 0 };

  // Page id per client, cached across the sweep.
  const pageIdByClient = new Map<string, string | null>();
  async function pageIdFor(clientId: string): Promise<string | null> {
    if (pageIdByClient.has(clientId)) return pageIdByClient.get(clientId)!;
    const { data } = await db
      .from('client_meta_ad_accounts')
      .select('meta_page_id')
      .eq('client_id', clientId)
      .maybeSingle();
    const pageId = (data as { meta_page_id: string | null } | null)?.meta_page_id ?? null;
    pageIdByClient.set(clientId, pageId);
    return pageId;
  }

  let published = 0;
  let failed = 0;
  for (const post of due) {
    const pageId = await pageIdFor(post.client_id);
    if (!pageId) {
      await db
        .from('social_posts')
        .update({
          status: 'failed',
          publish_error:
            'No Facebook Page connected — connect Meta on Settings → Integrations, then re-approve.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('status', 'approved');
      failed += 1;
      continue;
    }

    const message = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;
    const result = await publishFacebookPagePost(post.client_id, pageId, {
      message,
      imageUrl: post.image_url,
    });

    if (result.ok) {
      await db
        .from('social_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          meta_post_id: result.data.id || null,
          publish_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('status', 'approved');
      published += 1;
    } else {
      await db
        .from('social_posts')
        .update({
          status: 'failed',
          publish_error: result.error.message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('status', 'approved');
      failed += 1;
    }
  }

  return { published, failed };
});
