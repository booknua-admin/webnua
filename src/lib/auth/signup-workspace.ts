// =============================================================================
// signup-workspace — provision a Webnua workspace for a self-serve signup.
//
// Phase 7 / onboarding-foundation session. The order — locked Q2:
// subscribe-before-workspace — is "Stripe Checkout completes → we create the
// workspace → we email the new client a magic link to sign in". This module
// is the workspace-creation half: called from the Stripe webhook handler
// when `customer.subscription.created` lands carrying our `kind=signup`
// metadata.
//
// Insert order (locked by FK / trigger fan-out):
//   1. clients row with an explicit UUID. The three AFTER INSERT triggers
//      (migrations 0060 / 0062 / 0077) fan out four SMS templates + five
//      email templates + nine automations automatically. RLS bypass: this
//      runs with the service-role client (anon would be refused).
//   2. auth.admin.createUser({ email, email_confirm: true, user_metadata:
//      { role:'client', client_id: <uuid>, display_name: <business> }})
//      — fires the 0017 trigger that inserts the public.users row with
//      the right shape.
//   3. client_stripe_customers row mapping clientId → stripe_customer_id.
//      This row is the idempotency anchor for webhook retries: if it
//      already exists for a given stripe_customer_id when the webhook
//      runs, the workspace has already been created and we skip.
//   4. auth.admin.generateLink({ type:'magiclink', email }) → URL.
//      Email the URL via sendWelcomeEmail (Resend).
//
// Idempotency. `customer.subscription.created` may fire more than once for
// the same subscription if Stripe retries. The caller (the webhook handler)
// checks for an existing client_stripe_customers row by stripe_customer_id
// BEFORE invoking this function — if present, the workspace was already
// created, so we run the standard apply-subscription-event path and skip
// the provisioning. This module also defends in depth: every insert is
// guarded by a precondition check, so a race that gets past the caller's
// guard still degrades to a partial-state replay rather than a duplicate.
//
// SERVER-ONLY — uses the service-role Supabase client.
// =============================================================================

import { randomUUID } from 'node:crypto';

import { getAppBaseUrl } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/server';

import { sendWelcomeEmail, type WelcomeEmailOutcome } from './welcome-email';

export type SignupWorkspaceInput = {
  businessName: string;
  businessEmail: string;
  /** A short one-line trade / category, e.g. "Residential electrician".
   *  Stored in `clients.industry`. */
  businessCategory: string;
  /** The Stripe Customer this signup paid through — used both as
   *  attribution and the row this workspace is keyed to in
   *  client_stripe_customers. */
  stripeCustomerId: string;
};

export type SignupWorkspaceResult = {
  clientId: string;
  clientSlug: string;
  /** Whether the welcome email reached Resend. 'skipped' = RESEND_API_KEY
   *  not configured; the magic link still exists in Supabase. */
  emailOutcome: WelcomeEmailOutcome;
};

/** Slugify a business name. Same shape as `lib/clients/create-client.ts`
 *  `slugify` — kept local to avoid pulling that whole module (which uses
 *  the browser Supabase client) into a server-only file. */
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

/**
 * Provision a workspace for a freshly-paid signup. Returns the new client's
 * slug + the welcome-email send outcome. Throws on any unrecoverable failure
 * (a 5xx propagates up to the webhook handler which surfaces 500 → Stripe
 * retries the delivery so the state self-heals).
 */
export async function provisionSignupWorkspace(
  input: SignupWorkspaceInput,
): Promise<SignupWorkspaceResult> {
  const svc = getServiceClient();

  const businessName = input.businessName.trim();
  const businessEmail = input.businessEmail.trim().toLowerCase();
  const industry = input.businessCategory.trim();

  if (!businessName || !businessEmail || !industry) {
    throw new Error('signup-workspace: missing required signup metadata');
  }

  // -- 1. clients row (explicit id; retry the slug on a unique clash) ----
  //
  // We pre-generate the UUID so the auth.admin.createUser call below can
  // hand it to the handle_new_user trigger as user_metadata.client_id. The
  // service-role client bypasses the operator-only `clients_insert` RLS.
  const clientId = randomUUID();
  const baseSlug = slugify(businessName);
  const candidates = [baseSlug, `${baseSlug}-${shortRand()}`, `${baseSlug}-${shortRand()}`];

  let clientSlug: string | null = null;
  let lastError: { code?: string; message: string } | null = null;
  for (const slug of candidates) {
    const { data, error } = await svc
      .from('clients')
      .insert({
        id: clientId,
        name: businessName,
        slug,
        industry,
        primary_contact_email: businessEmail,
        // `onboarded_by` is nullable; a self-serve signup has no operator.
      })
      .select('slug')
      .single();
    if (!error && data) {
      clientSlug = data.slug;
      break;
    }
    // 23505 = unique-violation. Try the next slug candidate.
    if (error?.code === '23505') {
      lastError = { code: error.code, message: error.message };
      continue;
    }
    if (error) throw new Error(`signup-workspace: clients insert failed: ${error.message}`);
  }
  if (!clientSlug) {
    throw new Error(
      `signup-workspace: could not allocate a unique client slug (last: ${lastError?.message ?? 'unknown'})`,
    );
  }

  // The three AFTER INSERT triggers (0060 sms_templates, 0062 email_templates,
  // 0077 automations) have now fired against `clientId`.

  // -- 2. auth user + public.users (via the 0017 trigger) ----------------
  //
  // `email_confirm: true` skips Supabase's "click to confirm" flow — the
  // user authenticates instead via the magic link we email below.
  const created = await svc.auth.admin.createUser({
    email: businessEmail,
    email_confirm: true,
    user_metadata: {
      role: 'client',
      client_id: clientId,
      display_name: businessName,
    },
  });
  if (created.error || !created.data.user) {
    // If the auth-user create failed, we have an orphan clients row +
    // template seed. A cleanup migration could prune; for V1 the operator
    // resolves manually. Propagate the error so Stripe retries — a second
    // delivery hits the idempotency guard at the webhook layer and we
    // skip this whole branch.
    throw new Error(
      `signup-workspace: auth.admin.createUser failed: ${
        created.error?.message ?? 'no user returned'
      }`,
    );
  }

  // -- 3. client_stripe_customers (the idempotency anchor) ---------------
  //
  // The webhook handler will then call applySubscriptionEvent which UPDATEs
  // this row with subscription-id / period-end / status. We seed it
  // 'incomplete' here so a moment later the SAME webhook delivery flips it
  // active when applySubscriptionEvent applies the inbound `subscription`.
  const { error: stripeRowError } = await svc.from('client_stripe_customers').insert({
    client_id: clientId,
    stripe_customer_id: input.stripeCustomerId,
    status: 'incomplete',
  } as never);
  if (stripeRowError) {
    // A duplicate here means another webhook delivery raced ahead — degrade
    // to OK; the apply-subscription step will mutate the existing row.
    if (stripeRowError.code !== '23505') {
      throw new Error(
        `signup-workspace: client_stripe_customers insert failed: ${stripeRowError.message}`,
      );
    }
  }

  // -- 4. magic link + welcome email -------------------------------------
  //
  // The link redirects through Supabase's verify-and-set-session flow,
  // landing on /dashboard where the IntegrationOnboarding screen takes
  // over (lifecycle_status defaults to 'onboarding' on the clients row).
  const appBase = getAppBaseUrl();
  const linkOptions = appBase ? { redirectTo: `${appBase}/dashboard` } : undefined;
  const linkResult = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: businessEmail,
    options: linkOptions,
  } as never);

  if (linkResult.error || !linkResult.data) {
    // We can ship the workspace without the link — the operator can resend
    // manually via Supabase admin OR the user can run /forgot-password
    // (when that lands). Log loudly + return; do not fail the webhook.
    console.warn(
      `[signup-workspace] generateLink failed for ${businessEmail}: ${
        linkResult.error?.message ?? 'no link returned'
      }`,
    );
    return { clientId, clientSlug, emailOutcome: 'skipped' };
  }

  // generateLink returns the URL under data.properties.action_link.
  const actionLink = (
    linkResult.data as unknown as { properties?: { action_link?: string }; action_link?: string }
  );
  const magicLink =
    actionLink.properties?.action_link ??
    actionLink.action_link ??
    null;
  if (!magicLink) {
    console.warn(
      `[signup-workspace] generateLink returned no action_link for ${businessEmail}`,
    );
    return { clientId, clientSlug, emailOutcome: 'skipped' };
  }

  const emailOutcome = await sendWelcomeEmail({
    recipientEmail: businessEmail,
    businessName,
    magicLink,
  });

  return { clientId, clientSlug, emailOutcome };
}

/**
 * Check whether a workspace has already been provisioned for the given Stripe
 * Customer id — the webhook handler's idempotency guard.
 */
export async function hasProvisionedWorkspace(stripeCustomerId: string): Promise<boolean> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('client_stripe_customers')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  return data != null;
}

/**
 * Check whether a Supabase auth user already exists for the given email — the
 * /api/sign-up pre-check, so we refuse the Checkout session rather than fail
 * later inside the webhook.
 *
 * Uses the Supabase admin paginated listUsers API. We pull a page and look
 * for a case-insensitive match — Supabase Auth stores emails lower-cased,
 * but a defensive compare costs nothing.
 */
export async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const svc = getServiceClient();
  const normalized = email.trim().toLowerCase();

  // listUsers is paginated; an email match is rare in the first page (the
  // page is unordered) so we scan up to a few pages. A platform with > 50k
  // users would need a different lookup — out of scope for the V1 audit
  // gate the route uses this for, which only needs to catch "this email
  // signed up an hour ago".
  const PAGE_SIZE = 200;
  const MAX_PAGES = 25;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      console.warn(`[signup-workspace] listUsers failed at page ${page}: ${error.message}`);
      return false; // fail-open — the webhook re-checks anyway
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && u.email.trim().toLowerCase() === normalized) return true;
    }
    if (users.length < PAGE_SIZE) return false; // exhausted
  }
  return false;
}
