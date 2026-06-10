// =============================================================================
// /api/email/unsubscribe — one-click customer opt-out.
//
// GET (the footer link a customer clicks) and POST (RFC 8058 one-click,
// for mail clients that POST the List-Unsubscribe-Post header target) both
// verify the HMAC token and stamp customers.unsubscribed_at. Idempotent —
// re-clicking an already-used link re-confirms. No auth: the signed token
// IS the authorisation (it only ever opts OUT, never in).
// =============================================================================

import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { getServiceClient } from '@/lib/supabase/server';

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f5f1ea;color:#0a0a0a;display:flex;min-height:100svh;align-items:center;justify-content:center;margin:0;padding:24px}
main{background:#fff;border:1px solid #c9c0b0;border-radius:16px;padding:40px 32px;max-width:420px;text-align:center}
h1{font-size:20px;margin:0 0 10px}p{font-size:14px;line-height:1.6;color:#4a4a45;margin:0}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') ?? '';
  const customerId = token ? verifyUnsubscribeToken(token) : null;
  if (!customerId) {
    return page(
      'Link not recognised',
      'This unsubscribe link is invalid or incomplete. If you keep receiving messages, reply to any of them and ask to be removed.',
      400,
    );
  }

  const svc = getServiceClient();
  const { error } = await svc
    .from('customers')
    .update({ unsubscribed_at: new Date().toISOString() } as never)
    .eq('id', customerId)
    .is('unsubscribed_at', null);
  if (error) {
    console.warn('[unsubscribe] update failed', error.message);
    return page(
      'Something went wrong',
      'We could not process the request just now — try the link again in a minute.',
      500,
    );
  }

  return page(
    "You're unsubscribed",
    'You will no longer receive automated messages from this business. If you change your mind, just reply to a previous message.',
  );
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

// RFC 8058 one-click unsubscribe POSTs to the same URL.
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
