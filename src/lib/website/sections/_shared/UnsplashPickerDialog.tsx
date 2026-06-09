'use client';

// =============================================================================
// UnsplashPickerDialog — search/select stock photos for MediaField.
//
// The picker is builder-only. It searches via local route handlers so the
// Unsplash access key never reaches the browser, shows attribution inline, and
// triggers the required download-tracking call when a photo is selected.
// =============================================================================

import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppError } from '@/lib/errors';
import {
  searchUnsplashPhotos,
  trackUnsplashDownload,
  type UnsplashPhotoResult,
  type UnsplashSearchContext,
} from '@/lib/website/unsplash-search';

type UnsplashPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: UnsplashSearchContext;
  onSelectImage: (url: string) => void;
};

export function UnsplashPickerDialog({
  open,
  onOpenChange,
  context,
  onSelectImage,
}: UnsplashPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhotoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const showEmptyState = hasAutoSearched && !loading && !error && results.length === 0;

  useEffect(() => {
    if (!open) {
      setHasAutoSearched(false);
      return;
    }
    if (hasAutoSearched) return;
    setHasAutoSearched(true);
    void runSearch('');
  }, [hasAutoSearched, open]);

  const runSearch = async (rawQuery: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await searchUnsplashPhotos({
        query: rawQuery,
        context,
      });
      setResults(response.photos);
      if (!rawQuery.trim()) setQuery(response.queryUsed);
    } catch (caught) {
      setResults([]);
      setError(readErrorMessage(caught, 'Image search failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (photo: UnsplashPhotoResult) => {
    setError(null);
    setSelectingId(photo.id);
    try {
      try {
        await trackUnsplashDownload(photo.downloadLocation);
      } catch (caught) {
        console.error('[unsplash-picker] download tracking failed', caught);
      }
      onSelectImage(photo.appliedUrl);
      onOpenChange(false);
    } catch (caught) {
      setError(readErrorMessage(caught, 'Unable to use that image.'));
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[calc(100vh-3rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find on Unsplash</DialogTitle>
          <DialogDescription>
            Search stock photography for this section. Blank search uses the current
            builder context to suggest a starting query.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search photos"
            className="block w-full rounded-[7px] border border-rule bg-card px-3.5 py-[11px] font-sans text-[14px] text-ink transition-colors focus:border-rust focus:outline-none focus:ring-[3px] focus:ring-rust/12"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-rust px-4 py-2 text-[12px] font-bold text-paper transition-colors hover:bg-rust-deep disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        <p className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-[12px] text-ink-mid">
          Using an image keeps Unsplash&apos;s hotlinked URL and reports the required
          download event. Each result includes the photographer credit link.
        </p>

        {error ? (
          <div className="rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
              Unsplash error
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((photo) => {
            const selecting = selectingId === photo.id;
            return (
              <article
                key={photo.id}
                className="overflow-hidden rounded-xl border border-rule bg-card"
              >
                <div className="aspect-[4/3] bg-paper-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt={photo.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="grid gap-2 px-3 py-3">
                  <p className="line-clamp-2 text-[13px] leading-[1.45] text-ink">
                    {photo.alt}
                  </p>
                  <p className="text-[12px] text-ink-mid">
                    Photo by{' '}
                    <a
                      href={photo.photographerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-rust hover:text-rust-deep"
                    >
                      {photo.photographerName}
                    </a>{' '}
                    on{' '}
                    <a
                      href={photo.unsplashUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-rust hover:text-rust-deep"
                    >
                      Unsplash
                    </a>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSelect(photo)}
                    disabled={!!selectingId}
                    className="rounded-md border border-rust/30 bg-rust-soft px-3 py-2 text-[12px] font-bold text-rust transition-colors hover:border-rust hover:bg-rust-soft/80 disabled:cursor-wait disabled:opacity-60"
                  >
                    {selecting ? 'Using…' : 'Use image'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {showEmptyState ? (
          <p className="rounded-md border border-dashed border-rule bg-paper px-4 py-6 text-center text-[13px] text-ink-mid">
            No photos found for this query. Try a broader search.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
