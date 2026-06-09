// =============================================================================
// POST /api/unsplash/download — trigger Unsplash's required download-tracking
// endpoint when a user selects a photo in the builder.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

type DownloadRequest = {
  downloadLocation?: unknown;
};

type UnsplashDownloadResponse = {
  errors?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  if (!env.UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ error: 'unsplash-not-configured' }, { status: 503 });
  }

  let body: DownloadRequest;
  try {
    body = (await request.json()) as DownloadRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const downloadLocation =
    typeof body.downloadLocation === 'string' ? body.downloadLocation.trim() : '';
  if (!downloadLocation) {
    return NextResponse.json(
      { error: 'missing-download-location', detail: 'downloadLocation is required.' },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    response = await fetch(downloadLocation, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[unsplash-download] network error', error);
    return NextResponse.json(
      { error: 'download-track-failed', detail: 'Unable to reach Unsplash right now.' },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as UnsplashDownloadResponse;
    const detail = extractUnsplashError(payload) || response.statusText || 'Unknown error';
    return NextResponse.json(
      { error: 'download-track-failed', status: response.status, detail },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

function extractUnsplashError(payload: UnsplashDownloadResponse): string {
  const errors = payload.errors;
  if (!Array.isArray(errors)) return '';
  return errors.filter((item): item is string => typeof item === 'string').join(' ').trim();
}
