'use client';

// =============================================================================
// /sign-up — Pattern B: free signup with email verification.
//
// The form captures three fields, POSTs to /api/sign-up, then swaps to a
// "check your email" success state. No payment, no Stripe Checkout
// redirect — that moves to the dashboard's "Publish to go live" CTA, after
// the customer has verified + run the wizard + seen what their site looks
// like.
//
// What we capture:
//   - business name (clients.name)
//   - business email (clients.primary_contact_email + auth.users.email)
//   - business category / trade — one-liner (clients.industry)
//
// What the API does (per /api/sign-up/route.ts):
//   1. Rate-limits + disposable-domain checks
//   2. Refuses duplicate email
//   3. Creates pending_verification workspace + unconfirmed auth user
//   4. Generates magic link + emails it via Resend
//
// Mobile responsiveness: the auth layout centres + caps width
// (`max-w-md`); Inputs are h-10 with 14px placeholders; Button defaults to
// h-10 (h-11 with `size="lg"`) — touch targets above the 44px floor.
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
 *  carries an upstream message — surfaced for rate-limit errors so the
 *  user sees the retry timer. */
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
    case 'disposable-email':
      return 'Please use your real business email address — disposable email services are not accepted.';
    case 'email-already-registered':
      return 'An account already exists for this email. Sign in instead.';
    case 'rate-limited-attempt':
    case 'rate-limited-success':
      return detail ?? 'Too many signups from this network. Please wait and try again.';
    case 'provision-failed':
      return detail
        ? `Could not create your workspace: ${detail}`
        : 'Could not create your workspace — please try again.';
    case 'invalid-body':
      return 'Something went wrong with the form. Refresh and try again.';
    default:
      return code
        ? `Something went wrong (${code}). Try again, or get in touch if it keeps happening.`
        : 'Something went wrong. Try again.';
  }
}

type SuccessState = {
  email: string;
  /** Whether Resend actually sent (or 'skipped' in dev / 'failed' if a
   *  Resend hiccup). Shown subtly so the user knows whether to refresh
   *  their inbox. */
  outcome: 'sent' | 'skipped' | 'failed';
};

function SignUpForm() {
  const search = useSearchParams();
  const cancelled = search.get('cancelled') === '1';

  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [error, setError] = useState<string | null>(
    cancelled
      ? "Cancelled. Want to try again? Fill in the form below."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

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

    const body = (await response.json()) as {
      ok: boolean;
      emailOutcome: 'sent' | 'failed' | 'skipped';
    };
    setSuccess({
      email: businessEmail.trim(),
      outcome: body.emailOutcome ?? 'sent',
    });
    setSubmitting(false);
  };

  if (success) {
    return <CheckYourEmail email={success.email} outcome={success.outcome} />;
  }

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Start free'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Get your business{' '}
            <em className="font-extrabold not-italic text-rust">live in Webnua</em>.
          </CardTitle>
          <CardDescription className="text-sm leading-[1.55] text-ink-quiet">
            Three quick details and we&rsquo;ll email you a sign-in link.{' '}
            <strong className="font-semibold text-ink">No payment yet</strong> — you&rsquo;ll
            build a preview of your site first, then pay once you&rsquo;re ready to go live.
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

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Creating your workspace…' : 'Start free — email me a link →'}
            </Button>

            <p className="text-center text-[12px] leading-[1.5] text-ink-quiet">
              No card needed. You only pay when you click <strong>Publish to go live</strong>{' '}
              from your dashboard.
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

function CheckYourEmail({ email, outcome }: SuccessState) {
  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Check your email'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Workspace <em className="font-extrabold not-italic text-rust">created</em>.
          </CardTitle>
          <CardDescription className="text-sm leading-[1.55] text-ink-quiet">
            We&rsquo;ve emailed a sign-in link to{' '}
            <strong className="font-semibold text-ink">{email}</strong>. Click the link to
            confirm your email and start building. The link is good for one hour.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border border-dashed border-rule bg-paper-2 px-4 py-3 text-[13px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            <strong>Can&rsquo;t find it?</strong> Check your spam folder. The email comes from{' '}
            <strong>welcome@mail.webnua.com</strong>.
          </div>

          {outcome === 'failed' ? (
            <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
              We had trouble sending the email. Wait a minute, then try signing in below — the
              standard sign-in flow will send a fresh link.
            </p>
          ) : null}
          {outcome === 'skipped' ? (
            <p className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-xs text-ink-quiet">
              Note for development: RESEND_API_KEY is not configured, so the email did not
              actually send. Sign in below with a fresh email request.
            </p>
          ) : null}

          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/login">Open the sign-in page →</Link>
          </Button>
        </CardContent>
      </Card>

      <p className="text-center font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-quiet/70">
        &copy; Webnua &middot; Perth
      </p>
    </div>
  );
}

export default function SignUpPage() {
  // useSearchParams requires Suspense at the page boundary on the App Router.
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
