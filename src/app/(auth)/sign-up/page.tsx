'use client';

// =============================================================================
// /sign-up — the self-serve signup form.
//
// Locked Q2: subscribe-before-workspace. This form captures three fields, then
// sends them to /api/sign-up which mints a Stripe Checkout session. The
// browser is then redirected to Stripe's hosted page; on successful payment,
// Stripe fires `customer.subscription.created` which the webhook handler
// catches to create the actual workspace + email a magic link to sign in.
//
// What we capture:
//   - business name (clients.name)
//   - business email (clients.primary_contact_email + auth.users.email)
//   - business category / trade — one-liner (clients.industry)
//
// What we DELIBERATELY don't capture here:
//   - service area / contact name / phone — Session 2 (the onboarding wizard)
//     collects these into the brief that drives website + funnel generation.
//   - a password — sign-in is magic-link. The audit (§3 Step 2b) flagged the
//     dead "Forgot password?" button; a passwordless flow sidesteps it.
//
// Mobile responsiveness: single-column flex with `w-full max-w-md` — the
// auth layout already centres + caps width. Touch targets ≥ 44px (the Button
// primitive ships h-10 on default / h-11 on lg).
// =============================================================================

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';

/** Friendly translation of the API error codes. `detail` (if present)
 *  carries the upstream provider's specific error message — for
 *  `stripe-checkout-failed` we append it so the operator can diagnose
 *  without crawling server logs. */
function describeError(code: string | undefined, detail?: string | null): string {
  switch (code) {
    case 'business-name-required':
      return 'Please enter your business name.';
    case 'business-name-too-long':
      return 'That business name is a bit long — keep it under 80 characters.';
    case 'business-email-invalid':
      return 'That email address does not look right. Try again.';
    case 'business-email-too-long':
      return 'That email address is too long.';
    case 'business-category-required':
      return 'Please add a one-line description of what you do.';
    case 'business-category-too-long':
      return 'Keep the description under 120 characters.';
    case 'email-already-registered':
      return 'An account already exists for this email. Sign in instead.';
    case 'rate-limited':
      return 'Too many signups from this network — wait a few minutes and try again.';
    case 'stripe-not-configured':
      return 'Billing is temporarily unavailable. Try again in a moment.';
    case 'stripe-checkout-failed':
      return detail
        ? `Stripe could not start checkout: ${detail}`
        : 'Could not start checkout — please try again. If this keeps happening, get in touch.';
    case 'invalid-body':
      return 'Something went wrong with the form. Refresh and try again.';
    default:
      return code
        ? `Something went wrong (${code}). Try again, or get in touch if it keeps happening.`
        : 'Something went wrong. Try again.';
  }
}

function SignUpForm() {
  const search = useSearchParams();
  const cancelled = search.get('cancelled') === '1';

  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [error, setError] = useState<string | null>(
    cancelled
      ? 'No problem — checkout was cancelled, no charge was made. Try again whenever you are ready.'
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    let response: Response;
    try {
      response = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessEmail: businessEmail.trim(),
          businessCategory: businessCategory.trim(),
        }),
      });
    } catch {
      setError('We could not reach our servers. Check your connection and try again.');
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      setError(describeError(body.error, body.detail));
      setSubmitting(false);
      return;
    }

    const { checkoutUrl } = (await response.json()) as { checkoutUrl?: string };
    if (!checkoutUrl) {
      setError('We could not start checkout — please try again in a moment.');
      setSubmitting(false);
      return;
    }
    // Browser navigation to the hosted Stripe Checkout page.
    window.location.assign(checkoutUrl);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Start your subscription'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Get your business <em className="font-extrabold not-italic text-rust">live in Webnua</em>.
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">
            Three quick details, then you&rsquo;ll head over to Stripe to start your subscription.
            We&rsquo;ll email you a sign-in link as soon as payment is confirmed — no password to
            remember.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <Field id="business-name" label="Business name">
              <Input
                id="business-name"
                type="text"
                autoComplete="organization"
                placeholder="e.g. Voltline Electrical"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                maxLength={80}
              />
            </Field>

            <Field id="business-email" label="Business email">
              <Input
                id="business-email"
                type="email"
                autoComplete="email"
                placeholder="you@yourbusiness.com"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                required
                maxLength={200}
              />
            </Field>

            <Field
              id="business-category"
              label="What does your business do?"
              hint="One line · we use this to set the right defaults."
            >
              <Input
                id="business-category"
                type="text"
                placeholder="e.g. Residential electrician in Perth"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                required
                maxLength={120}
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Starting checkout…' : 'Continue to checkout →'}
            </Button>

            <p className="text-center text-[12px] leading-[1.5] text-ink-quiet">
              By continuing you agree to Webnua&rsquo;s subscription terms. Cancel any time.
            </p>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-[13px] text-ink-quiet">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-rust hover:text-rust-deep">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  // useSearchParams requires Suspense at the page boundary on the App Router.
  // The fallback renders the form without query-param-driven state — fine for
  // the initial paint, the real `?cancelled=1` framing shows once Suspense
  // resolves.
  return (
    <Suspense fallback={<div className="text-[12px] text-ink-quiet">Loading…</div>}>
      <SignUpForm />
    </Suspense>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint ? (
          <span className="font-mono text-[10px] tracking-[0.08em] text-ink-quiet">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink"
    >
      {children}
    </label>
  );
}
