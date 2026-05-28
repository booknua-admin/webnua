// =============================================================================
// Browser-side composite-image upload — Supabase Storage → public URL.
//
// Phase 7.5 · Session 1.4b.1. Sibling of `upload-ad-image.ts`. The wizard
// uses this at launch time after the canvas compositor renders the
// final composite to a Blob; the returned public URL is what the launch
// payload sends to Meta.
//
// Lands under the same `meta-creative/{clientId}/` Storage prefix the
// base-image uploads use, so an operator can see both the originals and
// the composites side-by-side in the bucket (useful for the deferred
// training pipeline that wants to correlate creatives with outcomes).
//
// Anti-pattern: the wizard does NOT upload a composite on every
// preview re-render — that would burn Storage on every keystroke. The
// preview uses canvas.toDataURL; the upload only fires when the
// operator confirms launch.
// =============================================================================

import { AppError, err, normalizeError, ok, type Result } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'section-media';
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — generous, our renders are <1MB

export type UploadedComposite = {
  url: string;
  filename: string;
};

/** Upload a canvas-rendered composite to Supabase Storage. The Blob
 *  comes from `composeToBlob` in `creative-templates.ts` — always a
 *  JPEG at 1080×566. */
export async function uploadCompositeBlob(
  clientId: string,
  blob: Blob,
): Promise<Result<UploadedComposite>> {
  if (!blob.type.startsWith('image/')) {
    return err(
      AppError.validation({
        blob: 'Composite blob is not an image — compositor produced wrong MIME type.',
      }),
    );
  }
  if (blob.size > MAX_BYTES) {
    return err(
      AppError.validation({
        blob: 'Composite is larger than 6 MB — canvas output should be well under this.',
      }),
    );
  }
  const filename = `composite-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;
  const path = `meta-creative/${clientId}/${filename}`;
  const uploadResult = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/jpeg',
  });
  if (uploadResult.error) return err(normalizeError(uploadResult.error));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return ok({ url: data.publicUrl, filename });
}
