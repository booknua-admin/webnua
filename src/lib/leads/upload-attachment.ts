// =============================================================================
// uploadLeadAttachment — upload a lead form image to the private
// `lead-attachments` bucket and return its STORAGE PATH (not a URL).
//
// The bucket is private (lead uploads are tenant-private customer data), so
// nothing public is produced — the lead inbox resolves a short-lived signed
// URL from the stored path at render time. Objects are prefixed by client id
// (`{clientId}/{file}`); the bucket RLS gates read/insert on that prefix.
//
// Bucket created by migration 0031.
// =============================================================================

import { AppError, err, normalizeError, ok, type Result } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'lead-attachments';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a job photo from a phone.

export async function uploadLeadAttachment(
  file: File,
  clientId: string,
): Promise<Result<{ path: string }>> {
  if (!file.type.startsWith('image/')) {
    return err(AppError.validation({ file: 'That file is not an image.' }));
  }
  if (file.size > MAX_BYTES) {
    return err(
      AppError.validation({ file: 'Image must be under 8 MB.' }),
    );
  }

  const ext =
    (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'jpg';
  // Client-id prefix — the bucket RLS gates read/insert on this segment.
  const path = `${clientId}/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return err(normalizeError(error));

  return ok({ path });
}
