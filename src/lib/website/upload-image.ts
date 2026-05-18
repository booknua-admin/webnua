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
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the bucket limit.

export async function uploadSectionImage(
  file: File,
): Promise<Result<{ url: string }>> {
  if (!file.type.startsWith('image/')) {
    return err(AppError.validation({ file: 'That file is not an image.' }));
  }
  if (file.size > MAX_BYTES) {
    return err(AppError.validation({ file: 'Image must be under 10 MB.' }));
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
