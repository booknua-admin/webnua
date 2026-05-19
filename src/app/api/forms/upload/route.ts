// =============================================================================
// Public form image upload — POST /api/forms/upload (multipart/form-data).
//
// A lead-capture form with an image field uploads each file here before it
// submits. The route is PUBLIC; it writes with the service-role client into
// the private `lead-attachments` bucket (migration 0031 — which explicitly
// anticipated "the public renderer routes uploads through a service-role
// function"). Objects are prefixed by client id so the bucket RLS scopes
// reads to the owning client.
//
// Returns the storage PATH (not a URL — the bucket is private; the leads
// inbox resolves a signed URL at render time). The path then rides along in
// the /api/forms/submit payload as the field's `imagePath`.
// =============================================================================

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/public-site/rate-limit';

const BUCKET = 'lead-attachments';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a phone job photo.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  if (!rateLimit(`forms-upload:${clientIp(req)}`, 30, 60_000)) {
    return bad('Too many uploads — please wait a minute.', 429);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return bad('Invalid upload.');
  }

  const file = formData.get('file');
  const clientId = formData.get('clientId');

  if (typeof clientId !== 'string' || !UUID_RE.test(clientId)) {
    return bad('Missing or invalid client.');
  }
  if (!(file instanceof File)) return bad('No file provided.');
  if (!ALLOWED_MIME.has(file.type)) {
    return bad('Only JPEG, PNG, WebP or GIF images are accepted.');
  }
  if (file.size > MAX_BYTES) return bad('Image must be under 8 MB.');

  const svc = getServiceClient();
  const { data: client } = await svc
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return bad('Unknown client.', 404);

  const ext =
    (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'jpg';
  const path = `${clientId}/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await svc.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return bad('Upload failed — please try again.', 500);

  return NextResponse.json({ ok: true, path });
}
