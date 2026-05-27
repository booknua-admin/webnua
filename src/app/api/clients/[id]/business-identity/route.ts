// =============================================================================
// /api/clients/[id]/business-identity — POST { businessName, industry? }
// for the conversational onboarding flow.
//
// Why this exists:
//
// /api/sign-up/verify-code seeds `clients.name` with a placeholder derived
// from the email domain ("user@cool-trade.com" → "Cool Trade") and slugs
// the workspace URL from that placeholder. That worked for Session B (we
// hadn't extracted a real name yet) but produced confusing workspace URLs
// once Session C started doing AI extraction — the customer might have
// said "I'm a painter in Cork" and got a slug like `gmail-7a3f.webnua.dev`.
//
// `clients.industry` is also seeded by verify-code with a placeholder
// string ('Pending — captured in chat'), which had nowhere to get
// overwritten before this route accepted it. Without that overwrite,
// every conversationally-onboarded client carried the placeholder string
// in `clients.industry` permanently — a latent data bug, since operator
// surfaces that read the column directly (filtering, search) would see
// the placeholder. (Brand-side reads were fine — generation reads
// `brands.industry_category` which the wizard-assets path writes.)
//
// This route closes the loop: after `/api/onboarding/extract-business`
// returns a high-confidence `businessName` + industry, the conversation
// shell POSTs here to:
//   1. Update `clients.name` to the AI-extracted business name.
//   2. Optionally update `clients.industry` if the caller passes one
//      (the extraction's industryFreeText or the mapped industry's
//      display name). Skipped when the field is omitted — back-compat
//      with callers that only want the name+slug update.
//   3. Re-slugify the workspace URL from the new name, retrying on
//      uniqueness collision the same way `provisionPendingSignup` does.
//      The new slug becomes the workspace's primary URL; the previous
//      placeholder slug is NOT redirected (a few-minute-old preview that
//      nobody has visited).
//
// Auth: requireClientAccess — the customer for their own client. The shell
// has just signed the user in via verify-code's mint-password handoff, so
// the bearer token resolves to the right tenant.
//
// Idempotency: re-POSTing the same businessName is a no-op (the slug check
// short-circuits when the existing slug matches the desired derivation).
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';

type Body = {
  businessName?: unknown;
  industry?: unknown;
};

const MAX_BUSINESS_NAME_LENGTH = 80;
const MAX_INDUSTRY_LENGTH = 80;

/** Mirror the slugify in `lib/auth/signup-workspace.ts`. Kept local so this
 *  route doesn't pull the server-only signup module (which carries the
 *  Stripe + magic-link machinery this route doesn't need). */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'client'
  );
}

function shortRand(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const raw = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  if (!raw) {
    return NextResponse.json({ error: 'business-name-required' }, { status: 400 });
  }
  if (raw.length > MAX_BUSINESS_NAME_LENGTH) {
    return NextResponse.json({ error: 'business-name-too-long' }, { status: 400 });
  }

  // Industry is OPTIONAL — when present, overwrites the placeholder seeded
  // by verify-code. Trimmed empty string is treated as "not provided" so
  // a caller can safely pass `extraction.industryFreeText ?? ''` without
  // wiping a previously-set value.
  const industryRaw = typeof body.industry === 'string' ? body.industry.trim() : '';
  if (industryRaw.length > MAX_INDUSTRY_LENGTH) {
    return NextResponse.json({ error: 'industry-too-long' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Read the current row so we can short-circuit when nothing needs to change.
  const { data: current, error: readError } = await svc
    .from('clients')
    .select('name, slug, industry')
    .eq('id', clientId)
    .maybeSingle();
  if (readError || !current) {
    return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
  }
  const row = current as { name: string; slug: string; industry: string | null };

  // Idempotency — same name, same derived slug, AND (when industry is
  // provided) same industry. With nothing changing, no work to do.
  const desiredSlugBase = slugify(raw);
  const industryUnchanged = !industryRaw || row.industry === industryRaw;
  if (row.name === raw && row.slug === desiredSlugBase && industryUnchanged) {
    return NextResponse.json({
      ok: true,
      name: row.name,
      slug: row.slug,
      industry: row.industry,
      changed: false,
    });
  }

  // Build the update payload once. Industry is only included when the
  // caller actually passed a non-empty value, so absent / empty-string
  // industry doesn't wipe a previously-set column.
  const updatePayload: Record<string, string> = { name: raw };
  if (industryRaw) updatePayload.industry = industryRaw;

  // If the slug already matches the desired base, skip the slug rewrite —
  // only the name (+ optional industry) is changing. (Can happen if the
  // customer's email-derived placeholder name happened to slugify the
  // same as their real name — unlikely but the check is free.)
  let nextSlug = row.slug;
  if (row.slug !== desiredSlugBase) {
    // Try base, then base-XXXX twice (same shape as provisionPendingSignup).
    const candidates = [desiredSlugBase, `${desiredSlugBase}-${shortRand()}`, `${desiredSlugBase}-${shortRand()}`];
    let allocated: string | null = null;
    let lastErrorMessage: string | null = null;
    for (const candidate of candidates) {
      const { error: updateError } = await svc
        .from('clients')
        .update({ ...updatePayload, slug: candidate } as never)
        .eq('id', clientId);
      if (!updateError) {
        allocated = candidate;
        break;
      }
      // Unique-violation on slug → try the next candidate.
      if (updateError.code === '23505') {
        lastErrorMessage = updateError.message;
        continue;
      }
      // Anything else is a real failure.
      console.error('[business-identity] clients update failed:', updateError.message);
      return NextResponse.json({ error: 'update-failed', detail: updateError.message }, { status: 500 });
    }
    if (!allocated) {
      console.error('[business-identity] could not allocate slug:', lastErrorMessage);
      return NextResponse.json({ error: 'slug-allocation-failed' }, { status: 500 });
    }
    nextSlug = allocated;
  } else {
    // Slug already matches; just update the name (+ optional industry).
    const { error: updateError } = await svc
      .from('clients')
      .update(updatePayload as never)
      .eq('id', clientId);
    if (updateError) {
      console.error('[business-identity] name update failed:', updateError.message);
      return NextResponse.json({ error: 'update-failed', detail: updateError.message }, { status: 500 });
    }
  }

  // PR A — auto-assign SMS alphanumeric sender id now that the canonical
  // business name has been captured. Pattern B verify-code seeds clients.name
  // with an email-derived placeholder; the real sender id should derive from
  // THIS name. enqueueSenderRegistration is idempotent — calling it for a
  // client that already has a sender returns the existing row without
  // re-enqueueing. Fire-and-forget: a Twilio outage must not block the
  // conversational flow from advancing.
  void (async () => {
    try {
      const { enqueueSenderRegistration } = await import(
        '@/lib/integrations/twilio/sender-registration'
      );
      await enqueueSenderRegistration(clientId);
    } catch (error) {
      console.error('[business-identity] sender auto-assign threw', error);
    }
  })();

  return NextResponse.json({
    ok: true,
    name: raw,
    slug: nextSlug,
    industry: industryRaw || row.industry,
    changed: true,
  });
}
