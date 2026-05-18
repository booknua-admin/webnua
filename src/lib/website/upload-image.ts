// =============================================================================
// uploadSectionImage — upload a section image to Supabase Storage and return
// its public URL (Phase 6 · section-library uplift · image upload).
//
// Section data stores an image as a URL string; this just changes how that
// URL is produced — from a paste to an upload. The `section-media` bucket is
// created by migration 0027.
// =============================================================================

import { AppError, err, normalizeError, ok, type Result } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'section-media';
// Web-image cap — keeps storage lean (large photos should be compressed
// before upload). Stricter than the 10 MB Storage-bucket limit.
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

export async function uploadSectionImage(
  file: File,
): Promise<Result<{ url: string }>> {
  if (!file.type.startsWith('image/')) {
    return err(AppError.validation({ file: 'That file is not an image.' }));
  }
  if (file.size > MAX_BYTES) {
    return err(
      AppError.validation({
        file: 'Image must be under 3 MB — compress large photos before uploading.',
      }),
    );
  }

  const ext =
    (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'png';
  const path = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return err(normalizeError(error));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return ok({ url: data.publicUrl });
}
