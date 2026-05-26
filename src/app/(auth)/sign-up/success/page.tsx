// =============================================================================
// /sign-up/success — the landing page Stripe Checkout redirects to after a
// successful subscription start.
//
// We CANNOT directly sign the user in here — the workspace is provisioned
// asynchronously by the Stripe webhook (`customer.subscription.created` →
// `provisionSignupWorkspace`) which can land seconds to minutes after this
// page renders. Instead this is a wait-and-check-your-email holding page:
// the magic-link email lands when the webhook completes.
//
// The session_id query param Stripe passes is intentionally ignored — we
// don't need to reconcile from it; the subscription event is authoritative.
// Stripe's signature on the webhook is the proof of payment, not this page.
// =============================================================================

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';

export default function SignUpSuccessPage() {
  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <img src="/webnua-logo.png" alt="Webnua" width={160} height={40} className="h-10 w-auto" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Payment received'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            You&rsquo;re <em className="font-extrabold not-italic text-rust">in</em>.
          </CardTitle>
          <CardDescription className="text-sm leading-[1.55] text-ink-quiet">
            We&rsquo;re setting up your workspace right now. Watch your inbox for a sign-in link
            from Webnua — it usually arrives within a minute. Click the link to log in for the
            first time; no password needed.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border border-dashed border-rule bg-paper-2 px-4 py-3 text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            Can&rsquo;t find the email? <strong>Check your spam folder.</strong> If it still
            hasn&rsquo;t arrived after a few minutes, try signing in below — we&rsquo;ll send a
            fresh link.
          </div>

          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/login">Open the sign-in page →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
