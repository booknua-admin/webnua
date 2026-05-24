// =============================================================================
// signup-workspace — Pattern B's signup + publish-pay infrastructure.
//
// Pattern B refactors signup from "pay first, then onboard" (Session 1) to
// "sign up free, build a preview, pay to publish". Two operations live here:
//
//   provisionPendingSignup    — called from /api/sign-up. NO payment yet.
//                              Inserts the clients row (lifecycle_status =
//                              'pending_verification', the new default),
//                              creates the unconfirmed auth user, generates
//                              the magic link, hands the link back to the
//                              caller. The route then emails it via
//                              `verification-email.ts`.
//
//   markClientActiveOnPublish — called from the Stripe webhook on
//                              `customer.subscription.created` IF a matching
//                              client_stripe_customers row already exists
//                              (i.e. Checkout was initiated from the
//                              dashboard's "Publish to go live" CTA, not
//                              from /sign-up). Transitions
//                              clients.lifecycle_status from 'preview' to
//                              'active' and fires the post-publish welcome
//                              email.
//
// Insert order for provisionPendingSignup (locked by FK / trigger fan-out):
//   1. clients row with an explicit UUID + lifecycle_status='pending_verification'.
//      The three AFTER INSERT triggers (0060/0062/0077) seed 4 SMS templates +
//      5 email templates + 9 automations automatically.
//   2. auth.admin.createUser({ email, email_confirm: false, user_metadata:
//      { role:'client', client_id: <uuid>, display_name: <business> }}) —
//      fires the 0017 trigger that inserts the public.users row. The user is
//      UNCONFIRMED — clicking the verification email is what confirms them.
//      The 0085 trigger on auth.users.email_confirmed_at then transitions
//      the client from 'pending_verification' to 'preview'.
//   3. auth.admin.generateLink({ type:'magiclink', email }) → URL. Returned
//      to the caller so the verification email can carry it.
//
// Note — there is NO client_stripe_customers insert in the signup path.
// That row is created the first time the customer hits "Publish to go live"
// from the dashboard (the existing /api/integrations/stripe/checkout route
// inserts it before redirecting to Stripe Checkout).
//
// Idempotency. `provisionPendingSignup` is invoked synchronously from the
// route handler — there is no webhook retry to defend against here (the
// retry guard for Pattern A's webhook-driven provisioning is GONE; that
// code path has been removed). The /api/sign-up route handles duplicate
// emails via `emailAlreadyRegistered` BEFORE this function is called.
//
// SERVER-ONLY — uses the service-role Supabase client.
// =============================================================================

import { randomUUID } from 'node:crypto';

import { env, getAppBaseUrl } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/server';

import { CLIENT_OWNER_DEFAULTS } from './capabilities';
import { sendWelcomeEmail, type WelcomeEmailOutcome } from './welcome-email';

// --- shared types ------------------------------------------------------------

export type SignupWorkspaceInput = {
  businessName: string;
  businessEmail: string;
  /** A short one-line trade / category, e.g. "Residential electrician".
   *  Stored in `clients.industry`. */
  businessCategory: string;
  /** The origin (`https://app.webnua.com`) to use as the magic-link
   *  redirectTo base. The caller passes `new URL(request.url).origin` so
   *  the redirect lands on the same deployment the user signed up at —
   *  more reliable than `getAppBaseUrl()` because no env vars need to be
   *  set. **IMPORTANT** — this origin MUST be in the Supabase project's
   *  "Redirect URLs" allow-list (Authentication → URL Configuration);
   *  otherwise Supabase silently falls back to the project's Site URL. */
  redirectToBase?: string;
};

export type SignupWorkspaceResult = {
  clientId: string;
  clientSlug: string;
  /** The magic-link URL produced by Supabase. The caller emails it via
   *  `sendVerificationEmail`. NEVER returned to the public browser. */
  magicLink: string;
};

/** Slugify a business name — mirrors `lib/clients/create-client.ts` slugify.
 *  Kept local to avoid pulling that module (which uses the browser Supabase
 *  client) into this server-only file. */
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

function publicSiteDomain(): string {
  return (env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev').toLowerCase();
}

// --- 1. provisionPendingSignup (called from /api/sign-up) ------------------

/**
 * Provision a 'pending_verification' workspace + auth user + magic link for
 * a fresh /sign-up submission. Returns the magic link the caller emails to
 * the user. Throws on any unrecoverable failure — the caller returns a 500
 * to the browser (the form surfaces a retry).
 */
export async function provisionPendingSignup(
  input: SignupWorkspaceInput,
): Promise<SignupWorkspaceResult> {
  const svc = getServiceClient();

  const businessName = input.businessName.trim();
  const businessEmail = input.businessEmail.trim().toLowerCase();
  const industry = input.businessCategory.trim();

  if (!businessName || !businessEmail || !industry) {
    throw new Error('signup-workspace: missing required signup details');
  }

  // -- 1. clients row -------------------------------------------------------
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
        // lifecycle_status defaults to 'pending_verification' (migration 0085).
        // onboarded_by stays NULL — self-serve, no operator attribution.
      })
      .select('slug')
      .single();
    if (!error && data) {
      clientSlug = data.slug;
      break;
    }
    if (error?.code === '23505') {
      // Unique-violation on slug — try the next candidate.
      lastError = { code: error.code, message: error.message };
      continue;
    }
    if (error) {
      throw new Error(`signup-workspace: clients insert failed: ${error.message}`);
    }
  }
  if (!clientSlug) {
    throw new Error(
      `signup-workspace: could not allocate a unique client slug (last: ${
        lastError?.message ?? 'unknown'
      })`,
    );
  }

  // -- 2. auth user (unconfirmed) ------------------------------------------
  //
  // `email_confirm: false` means the user exists but is NOT yet allowed to
  // sign in via password — they must click the magic link first. Clicking
  // the link sets `email_confirmed_at`, which fires the migration 0085
  // trigger to advance the client from 'pending_verification' → 'preview'.
  const created = await svc.auth.admin.createUser({
    email: businessEmail,
    email_confirm: false,
    user_metadata: {
      role: 'client',
      client_id: clientId,
      display_name: businessName,
    },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      `signup-workspace: auth.admin.createUser failed: ${
        created.error?.message ?? 'no user returned'
      }`,
    );
  }

  // -- 2b. workspace-wide capability grant (Pattern B owner) ----------------
  //
  // The new auth user is the OWNER of this workspace. Without an explicit
  // grant they inherit only CLIENT_DEFAULTS (['viewBuilder']) — they could
  // view their generated site but every editor affordance (edit copy, edit
  // media, add sections, publish) would silently hide. Pattern B's promise
  // of "you publish your own" requires the full owner bundle.
  //
  // Stored as a workspace-wide grant (website_id NULL) so it covers every
  // site the owner ever creates. The clients_update RLS widening (migration
  // 0087) lets the owner edit their own clients row for profile fields.
  //
  // Service-role client bypasses the operator-only capability_grants_insert
  // policy — same trick the auth-user create uses.
  const authUserId = created.data.user.id;
  const { error: grantError } = await svc.from('capability_grants').insert({
    user_id: authUserId,
    website_id: null,
    capabilities: [...CLIENT_OWNER_DEFAULTS],
  });
  if (grantError) {
    // Non-fatal here — the workspace IS provisioned, the user CAN sign in.
    // We log loudly so an ops review picks up "missing owner grant" and the
    // operator can re-issue via /settings/access. Throwing would leave a
    // half-provisioned workspace (auth user exists, magic link sent) that
    // the route handler's catch can't unwind cleanly.
    console.error(
      `[signup-workspace] capability_grants insert failed for user ${authUserId}: ${grantError.message}`,
    );
  }

  // -- 2c. placeholder brand row --------------------------------------------
  //
  // Pattern B's editing surfaces (/settings/brand, the website SectionEditor)
  // ALL hard-block when no `brands` row exists for the workspace. Without
  // this insert the customer lands in a half-provisioned state where every
  // editor refuses to mount with "No brand registered for this client." —
  // the canonical Pattern B regression closed by this hotfix.
  //
  // The shape mirrors `lib/clients/create-client.ts` (the operator-concierge
  // path) but with PLACEHOLDER defaults the customer overrides via the
  // upcoming onboarding wizard (Session C) or the brand editor. NOT NULL
  // columns get a sane minimum: accent_color = Webnua rust, voice axes = 3
  // (neutral midpoint), audience_line = '' (the editor's `<Textarea>`
  // tolerates empty), industry_category = the signup-captured category
  // (a real string from the form).
  //
  // Non-fatal — if the insert fails, the workspace IS still provisioned and
  // an operator can heal it from /settings/access. Throwing here would leave
  // a half-provisioned workspace (auth user + magic link sent) the route
  // handler's catch can't unwind cleanly. Same discipline as 2b.
  const { error: brandError } = await svc.from('brands').insert({
    client_id: clientId,
    accent_color: '#d24317',
    voice_formality: 3,
    voice_urgency: 3,
    voice_technicality: 3,
    audience_line: '',
    industry_category: industry,
    top_jobs_to_be_booked: [],
  });
  if (brandError) {
    console.error(
      `[signup-workspace] brands insert failed for client ${clientId}: ${brandError.message}`,
    );
  }

  // -- 3. magic link --------------------------------------------------------
  //
  // The link lands the user on /dashboard. By that moment the migration
  // 0085 trigger has already advanced the client to 'preview', so the
  // dashboard renders the IntegrationOnboarding wizard (not the hub).
  //
  // Resolution order for the redirectTo base: caller-supplied origin
  // (preferred — the route handler reads `new URL(request.url).origin`
  // which is always the deployed URL, no env required) → `getAppBaseUrl()`
  // env fallback → null (Supabase falls back to project Site URL, which
  // is what produced the localhost magic-link bug pre-fix).
  const appBase = input.redirectToBase ?? getAppBaseUrl();
  const linkOptions = appBase ? { redirectTo: `${appBase}/dashboard` } : undefined;
  const linkResult = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: businessEmail,
    options: linkOptions,
  } as never);
  if (linkResult.error || !linkResult.data) {
    throw new Error(
      `signup-workspace: generateLink failed: ${linkResult.error?.message ?? 'no link returned'}`,
    );
  }
  const linkData = linkResult.data as unknown as {
    properties?: { action_link?: string };
    action_link?: string;
  };
  const magicLink = linkData.properties?.action_link ?? linkData.action_link ?? null;
  if (!magicLink) {
    throw new Error('signup-workspace: generateLink returned no action_link');
  }

  return { clientId, clientSlug, magicLink };
}

// --- 2. markClientActiveOnPublish (called from Stripe webhook) ------------

export type PublishActivationResult = {
  clientId: string;
  emailOutcome: WelcomeEmailOutcome;
};

/** Look up a client by Stripe Customer id. Returned shape carries the
 *  fields the publish-activation flow needs. Null when no mapping row. */
async function findClientByStripeCustomer(
  stripeCustomerId: string,
): Promise<{
  clientId: string;
  clientName: string;
  clientSlug: string;
  primaryEmail: string | null;
  lifecycle: string;
} | null> {
  const svc = getServiceClient();
  const { data: mapping } = await svc
    .from('client_stripe_customers')
    .select('client_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (!mapping) return null;
  const clientId = (mapping as { client_id: string }).client_id;

  const { data: client } = await svc
    .from('clients')
    .select('id, name, slug, primary_contact_email, lifecycle_status')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return null;
  const row = client as unknown as {
    id: string;
    name: string;
    slug: string;
    primary_contact_email: string | null;
    lifecycle_status: string;
  };
  return {
    clientId: row.id,
    clientName: row.name,
    clientSlug: row.slug,
    primaryEmail: row.primary_contact_email,
    lifecycle: row.lifecycle_status,
  };
}

/** Resolve a billing recipient email — the client's primary_contact_email
 *  if set, else their first client-role user's email. */
async function resolvePublishRecipient(
  clientId: string,
  primaryEmail: string | null,
): Promise<string | null> {
  if (primaryEmail) return primaryEmail;
  const svc = getServiceClient();
  const { data } = await svc
    .from('users')
    .select('email')
    .eq('client_id', clientId)
    .eq('role', 'client')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

/**
 * Stripe webhook publish-pay handler. The customer clicked "Publish to go
 * live" on the dashboard, completed Checkout, and Stripe fired
 * `customer.subscription.created`. This:
 *   1. Looks up the client by stripe_customer_id (the mapping row was
 *      created by /api/integrations/stripe/checkout before redirect).
 *   2. Transitions lifecycle_status from 'preview' → 'active'. The UPDATE
 *      is guarded by a WHERE on lifecycle_status='preview' so a duplicate
 *      webhook delivery is a no-op (idempotent).
 *   3. Fires the post-publish welcome email.
 *
 * Returns null when no matching client_stripe_customers row exists — the
 * subscription is a Pattern A leftover (Session 1 in-flight signup), and
 * the caller falls through to the existing Pattern A path.
 */
export async function markClientActiveOnPublish(
  stripeCustomerId: string,
): Promise<PublishActivationResult | null> {
  const client = await findClientByStripeCustomer(stripeCustomerId);
  if (!client) return null;

  // Idempotent — only flip 'preview' → 'active'. Repeated webhook deliveries
  // see lifecycle_status already 'active' and the UPDATE no-ops (no row
  // changed). Other states (already-active, paused, banned) are LEFT ALONE.
  const svc = getServiceClient();
  const { error } = await svc
    .from('clients')
    .update({ lifecycle_status: 'active' })
    .eq('id', client.clientId)
    .eq('lifecycle_status', 'preview');
  if (error) {
    throw new Error(`markClientActiveOnPublish: clients update failed: ${error.message}`);
  }

  // If lifecycle was NOT 'preview' (already active / paused / etc.), the
  // welcome email already fired in a prior delivery. Skip the resend.
  if (client.lifecycle !== 'preview') {
    return { clientId: client.clientId, emailOutcome: 'skipped' };
  }

  const recipient = await resolvePublishRecipient(client.clientId, client.primaryEmail);
  if (!recipient) {
    console.warn(
      `[publish-activate] client ${client.clientId} has no contact email; activated without welcome email`,
    );
    return { clientId: client.clientId, emailOutcome: 'skipped' };
  }

  const appBase = getAppBaseUrl();
  const dashboardUrl = appBase ? `${appBase}/dashboard` : 'https://app.webnua.com/dashboard';
  const liveSiteUrl = `https://${client.clientSlug}.${publicSiteDomain()}`;

  const emailOutcome = await sendWelcomeEmail({
    recipientEmail: recipient,
    businessName: client.clientName,
    liveSiteUrl,
    dashboardUrl,
  });

  return { clientId: client.clientId, emailOutcome };
}

// --- helpers shared with /api/sign-up + webhook ----------------------------

/** True if `client_stripe_customers` already has a row for the given Stripe
 *  Customer. Pattern B's publish path uses this to detect "this Customer is
 *  one of ours" before activating. */
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
 * /api/sign-up pre-check. Pages through the admin listUsers API (Supabase
 * stores emails lower-cased; we compare insensitively for safety).
 */
export async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const svc = getServiceClient();
  const normalized = email.trim().toLowerCase();

  const PAGE_SIZE = 200;
  const MAX_PAGES = 25;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      console.warn(`[signup-workspace] listUsers failed at page ${page}: ${error.message}`);
      return false; // fail-open — the route's auth-user create would error if a dup exists
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && u.email.trim().toLowerCase() === normalized) return true;
    }
    if (users.length < PAGE_SIZE) return false; // exhausted
  }
  return false;
}
