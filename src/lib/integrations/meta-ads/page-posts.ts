// =============================================================================
// Meta — Facebook Page publishing (SERVER-ONLY).
//
// The social-calendar worker's publish path. Posts to the client's connected
// Facebook Page using the Page access token the customer's OAuth grant
// already provides (the same token the lead-form launch chain uses). Text
// posts go to /{page}/feed; posts with an image go to /{page}/photos (the
// caption rides along). Instagram + GBP publishing are follow-ups — the
// social_posts.channels array is already shaped for them.
// =============================================================================

import { callExternal } from '@/lib/integrations/_shared/call';
import type { IntegrationResult } from '@/lib/integrations/_shared/call';
import { env } from '@/lib/env';

import { getPageAccessToken } from './client';

const GRAPH = `https://graph.facebook.com/${env.META_API_VERSION ?? 'v21.0'}`;

function form(params: Record<string, string | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, v);
  }
  return usp.toString();
}

export type PagePostInput = {
  message: string;
  imageUrl?: string | null;
};

/** Publish one post to a Facebook Page. Returns the created post id. */
export async function publishFacebookPagePost(
  clientId: string,
  pageId: string,
  input: PagePostInput,
): Promise<IntegrationResult<{ id: string }>> {
  const tokenResult = await getPageAccessToken(clientId, pageId);
  if (!tokenResult.ok) return tokenResult;
  const pageToken = tokenResult.data;

  if (input.imageUrl) {
    return callExternal<{ id?: string; post_id?: string }>({
      provider: 'meta_ads',
      operation: 'page_photo_post',
      url: `${GRAPH}/${pageId}/photos`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      rawBody: form({
        access_token: pageToken,
        url: input.imageUrl,
        caption: input.message,
      }),
      clientId,
    }).then((result) =>
      result.ok
        ? {
            ok: true as const,
            data: { id: result.data.post_id ?? result.data.id ?? '' },
            status: result.status,
          }
        : result,
    );
  }

  return callExternal<{ id?: string }>({
    provider: 'meta_ads',
    operation: 'page_feed_post',
    url: `${GRAPH}/${pageId}/feed`,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    rawBody: form({ access_token: pageToken, message: input.message }),
    clientId,
  }).then((result) =>
    result.ok
      ? { ok: true as const, data: { id: result.data.id ?? '' }, status: result.status }
      : result,
  );
}
