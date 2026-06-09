// =============================================================================
// Browser-side Unsplash search helpers for the website builder.
//
// The access key stays server-side. The client only talks to local route
// handlers that proxy search and download-tracking calls.
// =============================================================================

import { AppError } from '@/lib/errors';

export type UnsplashSearchContext = {
  sectionLabel?: string;
  fieldLabel?: string;
  industry?: string;
  audienceLine?: string;
};

export type UnsplashPhotoResult = {
  id: string;
  alt: string;
  previewUrl: string;
  appliedUrl: string;
  width: number;
  height: number;
  color: string | null;
  photographerName: string;
  photographerUrl: string;
  unsplashUrl: string;
  downloadLocation: string;
};

export type UnsplashSearchInput = {
  query?: string;
  context?: UnsplashSearchContext;
};

type SearchSuccess = {
  queryUsed: string;
  photos: UnsplashPhotoResult[];
};

type ErrorBody = {
  error?: string;
  detail?: string;
  status?: number;
};

export async function searchUnsplashPhotos(
  input: UnsplashSearchInput,
  options?: { signal?: AbortSignal },
): Promise<SearchSuccess> {
  let response: Response;
  try {
    response = await fetch('/api/unsplash/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw AppError.unexpected(
      error,
      'Image search failed — network error. Check your connection and try again.',
    );
  }

  if (response.ok) {
    const body = (await response.json()) as Partial<SearchSuccess>;
    if (!Array.isArray(body.photos) || typeof body.queryUsed !== 'string') {
      throw AppError.unexpected(body, 'Image search returned an invalid response.');
    }
    return {
      queryUsed: body.queryUsed,
      photos: body.photos as UnsplashPhotoResult[],
    };
  }

  const body = await readErrorBody(response);
  if (response.status === 503) {
    throw AppError.validation(
      { unsplash: 'Unsplash image search is not configured (UNSPLASH_ACCESS_KEY missing).' },
      'Unsplash image search is not configured on this environment.',
    );
  }
  const upstream = body.status ? ` ${body.status}` : '';
  const detail = body.detail?.trim() || body.error || `HTTP ${response.status}`;
  throw AppError.unexpected(body, `Image search failed — Unsplash${upstream}: ${detail}`);
}

export async function trackUnsplashDownload(
  downloadLocation: string,
  options?: { signal?: AbortSignal },
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/unsplash/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadLocation }),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw AppError.unexpected(error, 'Unsplash download tracking failed.');
  }

  if (response.ok) return;

  const body = await readErrorBody(response);
  const detail = body.detail?.trim() || body.error || `HTTP ${response.status}`;
  throw AppError.unexpected(body, `Unsplash download tracking failed — ${detail}`);
}

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}
