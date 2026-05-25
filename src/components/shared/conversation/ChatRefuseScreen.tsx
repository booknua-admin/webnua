'use client';

// =============================================================================
// ChatRefuseScreen — terminal screen mounted by the conversational onboarding
// shell when the extract step classified the customer's business as a
// restaurant or an ecommerce store. Both are outside Webnua's "service
// businesses that need leads" scope; we redirect to hello@webnua.com for a
// manual build at the same monthly price.
//
// The screen replaces the chat scroller (we don't keep typing/composer UI
// up — the conversation cannot continue). It mounts a friendly message
// + a prominent mailto: link + a quiet sign-out button so an operator
// walking the customer through can hand off cleanly.
//
// Design intent: a refused customer should not feel rejected — they should
// feel pointed at the right help. The Webnua framing is positive ("we focus
// on service businesses that need leads — for X, the right shape needs
// different tools") rather than apologetic.
// =============================================================================

import type { ReactNode } from 'react';

import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';
import type { RefuseReason } from '@/lib/onboarding/conversation-types';

export type ChatRefuseScreenProps = {
  refuseReason: RefuseReason;
  /** Optional bottom-right sign-out / "I'll come back" action. */
  onSignOut?: () => void;
  /** Operator-friendly tag at the top-left, e.g. "// Webnua". */
  tag?: ReactNode;
};

const HELLO_EMAIL = 'hello@webnua.com';

type CopyBundle = {
  /** Short eyebrow tag — same chrome the bot uses for "Heads up". */
  eyebrow: string;
  /** Display heading. */
  heading: ReactNode;
  /** Body paragraph(s). */
  body: ReactNode;
  /** Subject preload for the mailto: link. */
  mailSubject: string;
};

const COPY: Record<RefuseReason, CopyBundle> = {
  restaurant: {
    eyebrow: 'Webnua is for service businesses that need leads',
    heading: (
      <>
        Restaurants and food venues need <em>different tools</em>.
      </>
    ),
    body: (
      <>
        Webnua is built for service businesses that need a lead-capture site
        and a booking funnel — trades, professional services, personal
        services. Restaurants need menu management, table booking, and POS
        integrations, all of which sit outside what we ship today.
        <br />
        <br />
        <strong>If you would still like a Webnua site built</strong>,{' '}
        email <a className="font-mono text-rust underline" href={`mailto:${HELLO_EMAIL}?subject=${encodeURIComponent('Manual site build — restaurant')}`}>{HELLO_EMAIL}</a>{' '}
        and we will handle it manually at the same monthly price.
      </>
    ),
    mailSubject: 'Manual site build — restaurant',
  },
  ecom: {
    eyebrow: 'Webnua is for service businesses that need leads',
    heading: (
      <>
        Online stores need <em>different tools</em>.
      </>
    ),
    body: (
      <>
        Webnua is built for service businesses that need a lead-capture site
        and a booking funnel — trades, professional services, personal
        services. Ecommerce stores need product catalogues, cart, payments,
        and fulfilment, all of which sit outside what we ship today.
        <br />
        <br />
        <strong>If you would still like a Webnua site built</strong>,{' '}
        email <a className="font-mono text-rust underline" href={`mailto:${HELLO_EMAIL}?subject=${encodeURIComponent('Manual site build — online store')}`}>{HELLO_EMAIL}</a>{' '}
        and we will handle it manually at the same monthly price.
      </>
    ),
    mailSubject: 'Manual site build — online store',
  },
};

export function ChatRefuseScreen({
  refuseReason,
  onSignOut,
  tag,
}: ChatRefuseScreenProps) {
  const copy = COPY[refuseReason];
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[680px] flex-col px-5 pb-12 pt-8 md:pt-16">
      <header className="mb-10 flex items-center justify-between">
        <BrandMark className="text-ink" />
        {tag ? <div className="ml-auto">{tag}</div> : null}
      </header>

      <div className="flex flex-1 flex-col rounded-2xl border border-rule bg-card px-6 py-8 md:px-10 md:py-12">
        <Eyebrow tone="rust" bullet>
          {copy.eyebrow}
        </Eyebrow>
        <h1 className="mt-3 text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink md:text-[32px]">
          {copy.heading}
        </h1>
        <p className="mt-4 text-[15px] leading-[1.55] text-ink-soft md:text-[16px]">{copy.body}</p>

        <div className="mt-8">
          <a
            href={`mailto:${HELLO_EMAIL}?subject=${encodeURIComponent(copy.mailSubject)}`}
            className="inline-flex h-12 items-center rounded-md bg-rust px-6 text-[14px] font-bold uppercase tracking-[0.02em] text-paper hover:bg-rust-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2"
          >
            Email {HELLO_EMAIL}
          </a>
        </div>

        <div className="mt-auto pt-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Why we stopped here'}
          </p>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-mid">
            Webnua&apos;s site builder + funnel are tuned for service businesses
            where every conversion is a lead. Pointing them at the wrong shape
            of business would produce a site that does not work for you.
            Better that we are honest about it up front than try to retrofit
            something we cannot do well.
          </p>
        </div>
      </div>

      {onSignOut ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet underline-offset-4 hover:text-ink hover:underline"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
