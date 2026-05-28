// =============================================================================
// Browser-side ad image upload — Supabase Storage → public URL.
//
// Phase 7.5 Session 1. The launch wizard's step 4 uses this when the
// operator picks an image. The file lands in the existing `section-media`
// bucket under the `meta-creative/{clientId}/` prefix (RLS already
// allows the operator's upload via the existing bucket policy).
//
// The launch orchestrator (`launch-orchestrator.ts`) reads the returned
// public URL and pushes it to Meta's `/act_{id}/adimages` endpoint —
// Meta fetches the image server-side and returns an image_hash that
// the creative references. Supabase Storage stays the source of truth
// for the original, so Session 4's refresh-proposal flow can compare
// against the original even after Meta CDN URLs expire.
//
// Image limits: 4 MB cap (slightly above the 3 MB section-image cap
// because Meta ad creatives benefit from higher-quality originals;
// well under Meta's own 30 MB ceiling). Image dimensions are read
// from the file via an Image element so the wizard's preview can
// match the Meta feed-ad aspect ratio.
// =============================================================================

import { AppError, err, normalizeError, ok, type Result } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'section-media';
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export type UploadedAdImage = {
  url: string;
  width: number;
  height: number;
  filename: string;
};

export async function uploadAdImage(
  clientId: string,
  file: File,
): Promise<Result<UploadedAdImage>> {
  if (!file.type.startsWith('image/')) {
    return err(AppError.validation({ file: 'That file is not an image.' }));
  }
  if (file.size > MAX_BYTES) {
    return err(
      AppError.validation({
        file: 'Image must be under 4 MB — compress large photos before uploading.',
      }),
    );
  }
  const ext =
    (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'jpg';
  const filename = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const path = `meta-creative/${clientId}/${filename}`;

  // Read dimensions in parallel with the upload.
  const [dims, uploadResult] = await Promise.all([
    readImageDimensions(file).catch(() => ({ width: 0, height: 0 })),
    supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    }),
  ]);
  if (uploadResult.error) return err(normalizeError(uploadResult.error));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return ok({
    url: data.publicUrl,
    width: dims.width,
    height: dims.height,
    filename,
  });
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions.'));
    };
    img.src = url;
  });
}
