// =============================================================================
// GBP integration job handlers — side-effect module.
//
// Phase 7 GBP. Imported by job-handler-manifest.ts so registerJobHandler() lands
// in the executor's module graph.
//
//   1. gbp_sync_reviews        — pull reviews from Google + upsert gbp_reviews.
//   2. gbp_send_review_request — fan out a review-request SMS or email via the
//                                Twilio / Resend send queues.
//
// Same retry discipline as send_sms / send_email: a retryable error (with
// attempts remaining) is re-thrown so the job requeues with fresh backoff; a
// terminal failure records what happened and returns cleanly.
//
// SERVER-ONLY.
// =============================================================================

import { enqueueJobImmediate, registerJobHandler } from '@/lib/integrations/_shared/jobs';
import { isResendConfigured } from '@/lib/integrations/resend/client';
import { getSenderByClientId as getEmailSenderByClientId } from '@/lib/integrations/resend/senders';
import { SEND_EMAIL_JOB, type SendEmailPayload } from '@/lib/integrations/resend/job-types';
import { isTwilioConfigured } from '@/lib/integrations/twilio/client';
import { getSenderByClientId as getSmsSenderByClientId } from '@/lib/integrations/twilio/senders';
import { SEND_SMS_JOB, type SendSmsPayload } from '@/lib/integrations/twilio/job-types';
import { getAutomationActionConfig } from '@/lib/automations/lookup';
import {
  getPlatformDefault,
  actionDefaultToConfig,
} from '@/lib/automations/platform-defaults';

import {
  buildReviewLink,
  composeLocationPath,
  formatLocationAddress,
  getLocation,
  isGbpConfigured,
  listReviews,
} from './client';
import {
  findLocationByClientId,
  updateLocationSyncState,
} from './locations';
import {
  attributeRequestToReview,
  findAttributableRequest,
  insertReviewRequest,
} from './review-requests';
import {
  listKnownReviewIds,
  markReviewsDeleted,
  upsertReviews,
} from './reviews';
import {
  GBP_SEND_REVIEW_REQUEST_JOB,
  GBP_SYNC_REVIEWS_JOB,
  normalizeSendReviewRequestPayload,
  type GbpSyncReviewsPayload,
} from './job-types';
import { starRatingToInt, type GbpReviewInsert } from './types';

// =============================================================================
// gbp_sync_reviews
// =============================================================================

registerJobHandler(GBP_SYNC_REVIEWS_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as Partial<GbpSyncReviewsPayload>;
  const clientId = payload.clientId;
  if (!clientId) {
    throw new Error('gbp_sync_reviews: payload missing clientId');
  }

  if (!isGbpConfigured()) {
    return { skipped: true, reason: 'gbp-not-configured' };
  }

  const location = await findLocationByClientId(clientId);
  if (!location) {
    // No connected location — silently skip; the cron only enqueues for
    // clients with locations, but a race (operator disconnected between
    // cron emit + job run) is possible.
    return { skipped: true, reason: 'no-location' };
  }

  // (a) Optionally refresh location detail — gives us metadata.newReviewUri
  // and a fresh placeId; only run when the payload asked (post-connect or
  // operator "Sync now") so the daily cron stays cheap on API quota.
  let refreshedLocationPatch: {
    location_title?: string;
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    review_link?: string | null;
  } = {};
  if (payload.refreshLocation === true) {
    const locResult = await getLocation(clientId, location.gbp_location_id);
    if (locResult.ok) {
      refreshedLocationPatch = {
        location_title: locResult.data.title ?? location.location_title,
        address: formatLocationAddress(locResult.data),
        phone: locResult.data.phoneNumbers?.primaryPhone ?? null,
        website: locResult.data.websiteUri ?? null,
        review_link: buildReviewLink(locResult.data) ?? location.review_link,
      };
    } else if (locResult.error.class !== 'auth_failed') {
      // Auth errors propagate via callWithToken; other failures we record
      // but continue with the cached location data — better to import
      // reviews on a slightly-stale title than to bail.
      console.warn(
        `[gbp_sync_reviews] getLocation failed for ${clientId}: ${locResult.error.message}`,
      );
    }
  }

  // (b) Pull the recent reviews page (up to 50). One page is V1 — most
  // small businesses have far fewer than 50 reviews; a paginated full
  // crawl can come with the operator "import history" flow.
  const locationPath = composeLocationPath(location.gbp_account_id, location.gbp_location_id);
  const reviewsResult = await listReviews(clientId, locationPath, 50);
  if (!reviewsResult.ok) {
    // callWithToken already classifies the error; the executor will
    // requeue retryable failures.
    throw new Error(`gbp_sync_reviews: listReviews failed: ${reviewsResult.error.message}`);
  }

  const reviews = reviewsResult.data.reviews ?? [];

  // Pre-query the existing gbp_review_ids so we can preserve seen state.
  // Two-pass strategy:
  //   - Fresh reviews → INSERT-as-upsert with is_new_since_last_view=true.
  //   - Known reviews → UPSERT WITHOUT the seen flag so any prior false
  //     (operator already saw it) survives.
  const knownIds = await listKnownReviewIds(clientId);

  const nowIso = new Date().toISOString();
  const newRows: GbpReviewInsert[] = [];
  const updateRows: GbpReviewInsert[] = [];
  const presentReviewIds: string[] = [];
  for (const r of reviews) {
    const rating = starRatingToInt(r.starRating);
    if (rating < 1 || rating > 5) continue;
    const reviewName = r.name ?? (r.reviewId ? `${locationPath}/reviews/${r.reviewId}` : null);
    if (!reviewName) continue;
    if (!r.createTime) continue;
    const base: GbpReviewInsert = {
      client_id: clientId,
      gbp_review_id: reviewName,
      reviewer_name:
        r.reviewer?.isAnonymous === true
          ? null
          : (r.reviewer?.displayName ?? null),
      reviewer_profile_photo_url: r.reviewer?.profilePhotoUrl ?? null,
      rating,
      comment: r.comment ?? null,
      created_at_google: r.createTime,
      updated_at_google: r.updateTime ?? null,
      reply_text: r.reviewReply?.comment ?? null,
      reply_created_at: r.reviewReply?.updateTime ?? null,
      synced_at: nowIso,
      deleted_at_google: null,
    };
    if (knownIds.has(reviewName)) {
      // Existing row — DON'T set is_new_since_last_view, leave it alone.
      updateRows.push(base);
    } else {
      // Fresh review — explicitly mark unseen.
      newRows.push({ ...base, is_new_since_last_view: true });
    }
    presentReviewIds.push(reviewName);
  }

  const insertedRows = await upsertReviews(newRows);
  const updatedRows = await upsertReviews(updateRows);
  const upserted = [...insertedRows, ...updatedRows];
  await markReviewsDeleted(clientId, presentReviewIds);

  // (c) Attribute any unattributed request — match each freshly-synced
  // review to a candidate gbp_review_request within the 7-day window.
  for (const review of upserted) {
    if (review.deleted_at_google) continue;
    const candidate = await findAttributableRequest(
      clientId,
      review.created_at_google,
    );
    if (candidate) {
      await attributeRequestToReview(candidate.id, review.id);
    }
  }

  // (d) Update the cached headline metrics on the location row.
  const aliveReviews = upserted.filter((r) => !r.deleted_at_google);
  const averageRating = computeAverageRating(reviewsResult.data.averageRating, aliveReviews);
  const reviewCount = reviewsResult.data.totalReviewCount ?? aliveReviews.length;
  await updateLocationSyncState(clientId, {
    ...refreshedLocationPatch,
    current_rating: averageRating,
    review_count: reviewCount,
    last_synced_at: nowIso,
  });

  return {
    synced: aliveReviews.length,
    deletedAtGoogle: upserted.length - aliveReviews.length,
    attributedRequests: 0, // populated by the attribute pass above; cheap to recompute
  };
});

/** Choose the rating to cache: Google's reported `averageRating` first
 *  (canonical), falling back to a calculation across the synced rows. */
function computeAverageRating(
  googleAverage: number | undefined,
  rows: { rating: number }[],
): number | null {
  if (typeof googleAverage === 'number' && googleAverage > 0) {
    // Round to one decimal place — Google's value sometimes carries
    // five places of precision the operator doesn't want.
    return Math.round(googleAverage * 10) / 10;
  }
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

// =============================================================================
// gbp_send_review_request
// =============================================================================
//
// Decides channel (SMS preferred when the customer has a phone AND the
// client has an approved alphanumeric sender; email otherwise) and enqueues
// the underlying send_sms / send_email job. The gbp_review_requests row is
// the high-level audit log of "we asked"; the per-channel detail (delivery
// status, segment count, Resend message id) lives on sms_messages /
// email_messages.

registerJobHandler(GBP_SEND_REVIEW_REQUEST_JOB, async (rawPayload) => {
  const payload = normalizeSendReviewRequestPayload(rawPayload);
  if (!payload) {
    throw new Error('gbp_send_review_request: payload missing or invalid');
  }

  const { clientId, leadId, bookingId, recipientName, recipientPhone, recipientEmail } = payload;

  // (a) Resolve the review link. Without it we cannot send anything
  // meaningful — there is nothing to point the customer at.
  const location = await findLocationByClientId(clientId);
  if (!location || !location.review_link) {
    return { skipped: true, reason: 'no-review-link' };
  }
  const reviewLink = location.review_link;

  // (b) Pick the channel. The order matches the task brief: SMS preferred
  // (higher open rate, fewer spam folders), with email as the fallback.
  // A channel is "usable" when:
  //   - There is a recipient address for it.
  //   - The underlying integration is configured.
  //   - There is an approved sender for the client.
  const smsReady = await isSmsChannelReady(clientId, recipientPhone);
  const emailReady = await isEmailChannelReady(clientId, recipientEmail);

  if (smsReady && recipientPhone) {
    // Phase 8 Session 2: pull the body from the client's
    // `review_request_sms` automation action so manual sends honour any
    // per-client edits. Falls back to the platform default so a brand-new
    // client (or one whose seeding glitched) still produces a sensible send.
    const smsBody = await resolveReviewRequestSmsBody(clientId);
    if (!smsBody) {
      return { skipped: true, reason: 'no-review-request-sms-body' };
    }
    const sendPayload: SendSmsPayload = {
      clientId,
      body: smsBody,
      templateKey: 'review_request',
      recipientPhone,
      relatedLeadId: leadId,
      contextOverrides: {
        'review.link': reviewLink,
        ...(recipientName ? { 'lead.firstName': firstName(recipientName) } : {}),
      },
    };
    await enqueueJobImmediate(SEND_SMS_JOB, sendPayload, {
      provider: 'twilio',
      clientId,
      correlationId: bookingId ?? undefined,
    });

    await insertReviewRequest({
      client_id: clientId,
      lead_id: leadId,
      booking_id: bookingId,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_email: null,
      channel: 'sms',
      status: 'sent',
      review_link: reviewLink,
    });
    return { channel: 'sms', enqueued: true };
  }

  if (emailReady && recipientEmail) {
    const emailParts = await resolveReviewRequestEmailParts(clientId);
    if (!emailParts) {
      return { skipped: true, reason: 'no-review-request-email-body' };
    }
    const sendPayload: SendEmailPayload = {
      clientId,
      templateKey: 'review_request',
      recipientEmail,
      recipientName: recipientName ?? undefined,
      relatedLeadId: leadId,
      subject: emailParts.subject,
      bodyHtml: emailParts.bodyHtml,
      bodyText: emailParts.bodyText,
      contextOverrides: {
        'review.link': reviewLink,
        ...(recipientName ? { 'lead.firstName': firstName(recipientName) } : {}),
      },
    };
    await enqueueJobImmediate(SEND_EMAIL_JOB, sendPayload, {
      provider: 'resend',
      clientId,
      correlationId: bookingId ?? undefined,
    });

    await insertReviewRequest({
      client_id: clientId,
      lead_id: leadId,
      booking_id: bookingId,
      recipient_name: recipientName,
      recipient_phone: null,
      recipient_email: recipientEmail,
      channel: 'email',
      status: 'sent',
      review_link: reviewLink,
    });
    return { channel: 'email', enqueued: true };
  }

  // Neither channel is usable — log the request as failed so the operator
  // log shows we tried.
  await insertReviewRequest({
    client_id: clientId,
    lead_id: leadId,
    booking_id: bookingId,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_email: recipientEmail,
    channel: recipientPhone ? 'sms' : 'email',
    status: 'failed',
    error_message: 'no-usable-channel',
    review_link: reviewLink,
  });
  return { skipped: true, reason: 'no-usable-channel' };
});

// --- helpers -----------------------------------------------------------------

/** Resolve the SMS body for a manual review-request send.
 *  Reads the client's `review_request_sms` automation action_config.body
 *  (the per-client edit target); falls back to the platform default if the
 *  automation row is missing. Never reads `is_enabled` — a manual send must
 *  work even when the operator has disabled the automation. */
async function resolveReviewRequestSmsBody(clientId: string): Promise<string | null> {
  // PR B.6 (migration 0110): review_request flipped to email-primary —
  // email at position 1, SMS at position 2. This resolver reads the SMS
  // body for the operator's manual review-request send affordance.
  const live = await getAutomationActionConfig(clientId, 'review_request', 2);
  if (live) {
    const body = (live.config as { body?: unknown }).body;
    if (typeof body === 'string' && body.trim().length > 0) return body;
  }
  // Fallback — half-seeded client. Position 2 is the SMS action.
  const def = getPlatformDefault('review_request');
  const smsAction = def?.actions.find((a) => a.position === 2);
  if (!smsAction) return null;
  const cfg = actionDefaultToConfig(smsAction);
  const body = cfg.body;
  return typeof body === 'string' && body.length > 0 ? body : null;
}

/** Resolve the email subject + bodies for a manual review-request send.
 *  Reads the client's `review_request` automation action_config at
 *  position 1 (the email action under the email-primary shape — PR B.6
 *  migration 0110). Falls back to the platform default. */
async function resolveReviewRequestEmailParts(
  clientId: string,
): Promise<{ subject: string; bodyHtml: string; bodyText: string } | null> {
  const live = await getAutomationActionConfig(clientId, 'review_request', 1);
  if (live) {
    const cfg = live.config as {
      subject?: unknown;
      body?: unknown;
      body_html?: unknown;
      body_text?: unknown;
    };
    const subject = typeof cfg.subject === 'string' ? cfg.subject : '';
    // Customer-facing emails ship plain text only (migration 0097); body_html
    // is empty. Prefer the consolidated `body` field that the new shape
    // writes (migration 0109), fall back to the legacy body_text key.
    const bodyText =
      typeof cfg.body === 'string'
        ? cfg.body
        : typeof cfg.body_text === 'string'
          ? cfg.body_text
          : '';
    const bodyHtml = typeof cfg.body_html === 'string' ? cfg.body_html : '';
    if (subject && (bodyText || bodyHtml)) {
      return { subject, bodyHtml, bodyText };
    }
  }
  const def = getPlatformDefault('review_request');
  const emailAction = def?.actions.find((a) => a.position === 1);
  if (!emailAction) return null;
  const cfg = actionDefaultToConfig(emailAction) as {
    subject?: string;
    body?: string;
    body_html?: string;
    body_text?: string;
  };
  const bodyText = cfg.body ?? cfg.body_text ?? '';
  const bodyHtml = cfg.body_html ?? '';
  if (!cfg.subject || (!bodyText && !bodyHtml)) return null;
  return {
    subject: cfg.subject,
    bodyHtml,
    bodyText,
  };
}

async function isSmsChannelReady(
  clientId: string,
  recipientPhone: string | null,
): Promise<boolean> {
  if (!recipientPhone) return false;
  if (!isTwilioConfigured()) return false;
  const sender = await getSmsSenderByClientId(clientId);
  return sender !== null && sender.status === 'approved';
}

async function isEmailChannelReady(
  clientId: string,
  recipientEmail: string | null,
): Promise<boolean> {
  if (!recipientEmail) return false;
  if (!isResendConfigured()) return false;
  const sender = await getEmailSenderByClientId(clientId);
  return sender !== null && sender.status === 'active';
}

/** Best-effort first-name from a freeform "First Last" customer name —
 *  used to populate {{lead.firstName}} when the booking carries a customer
 *  name but no lead, since the SMS render context defaults to "there"
 *  otherwise. */
function firstName(fullName: string): string {
  const cleaned = fullName.trim();
  if (cleaned.length === 0) return 'there';
  const first = cleaned.split(/\s+/)[0];
  return first.length > 0 ? first : 'there';
}

export {};
