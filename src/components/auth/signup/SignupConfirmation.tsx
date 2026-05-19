'use client';

// =============================================================================
// SignupConfirmation — the close-out. Sets the follow-up expectation, restates
// the guarantee, names a human. No account is created (lead-capture model) —
// the Webnua team picks the prospect up and builds.
// =============================================================================

import Link from 'next/link';

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import type { GuaranteeEstimate } from '@/lib/signup/guarantee';
import type { ContactDetails, SignupBrief } from '@/lib/signup/types';

type SignupConfirmationProps = {
  brief: SignupBrief;
  contact: ContactDetails;
  estimate: GuaranteeEstimate;
};

function SignupConfirmation({
  brief,
  contact,
  estimate,
}: SignupConfirmationProps) {
  const firstName = contact.name.trim().split(/\s+/)[0] || 'there';
  const business = brief.businessName.trim() || 'your business';

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <BrandMark size="default" />
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-good/15 text-[28px] text-good"
        >
          ✓
        </span>
      </div>

      <div className="rounded-2xl border border-rule bg-card px-8 py-9 text-center">
        <Eyebrow tone="rust">{'// You\'re in'}</Eyebrow>
        <h2 className="mt-3 text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
          You&apos;re in, {firstName}.
        </h2>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-quiet">
          We&apos;re building {business} a lead system guaranteed to bring{' '}
          <strong className="font-bold text-ink">
            {estimate.leads} qualified leads a month
          </strong>{' '}
          — and you don&apos;t pay a cent until it&apos;s live.
        </p>

        <ol className="mt-7 flex flex-col gap-3 text-left">
          <NextStep
            n={1}
            title="A Webnua specialist calls you"
            body={`Within one business day, on ${contact.phone || 'your number'}. We confirm the details and the guarantee.`}
          />
          <NextStep
            n={2}
            title="We build your system — free"
            body="Pages, funnel, lead capture and follow-up automations. You review it before anything goes live."
          />
          <NextStep
            n={3}
            title="It goes live — and the leads start"
            body={`Only then does the ${'€'}347/month begin. Miss the guarantee and we work free until you hit it.`}
          />
        </ol>

        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet/70">
          Confirmation sent to {contact.email}
        </p>
      </div>

      <div className="mt-5 text-center">
        <Button variant="ghost" asChild>
          <Link href="/login">Already a customer? Sign in →</Link>
        </Button>
      </div>
    </div>
  );
}

function NextStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-rule bg-paper px-4 py-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-rust-light">
        {n}
      </span>
      <div>
        <p className="text-[14px] font-bold tracking-[-0.01em] text-ink">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-quiet">
          {body}
        </p>
      </div>
    </li>
  );
}

export { SignupConfirmation };
