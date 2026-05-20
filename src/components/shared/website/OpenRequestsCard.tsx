'use client';

// =============================================================================
// OpenRequestsCard — ink-bg "Open requests" panel on the `/website` hub.
// Shows the client's open website-category tickets (filtered to `website`
// or `website-approval` categories) with the most-recently-replied one
// surfaced as the action prompt + a primary "+ Request a change" CTA.
// =============================================================================

import Link from 'next/link';

import { useClientTicketsInbox } from '@/lib/tickets/queries';
import { inkHeroSurface } from '@/lib/ink-hero';

const WEBSITE_TICKET_CATEGORIES = ['website', 'website-approval'] as const;

export function OpenRequestsCard() {
  const inboxQuery = useClientTicketsInbox();
  const rows = inboxQuery.data ?? [];
  const open = rows.filter(
    (r) =>
      r.status !== 'done' &&
      (WEBSITE_TICKET_CATEGORIES as readonly string[]).includes(r.category),
  );
  const awaitingReply = open.find((r) => r.awaiting === 'client') ?? open[0];

  return (
    <div className={inkHeroSurface('flex flex-col gap-4')}>
      <div>
        <h2 className="text-[15px] font-extrabold tracking-[-0.015em] [&_em]:not-italic [&_em]:text-rust-light">
          Open <em>requests</em>
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-paper/75 [&_strong]:font-bold [&_strong]:text-paper">
          Changes you&rsquo;ve asked Webnua to make. Craig handles these directly.{' '}
          <Link
            href="/tickets"
            className="text-rust-light underline-offset-2 hover:underline"
          >
            View all tickets →
          </Link>
        </p>
      </div>

      {awaitingReply ? (
        <Link
          href={awaitingReply.href}
          className="block rounded-md border border-paper/15 bg-paper/[0.06] px-4 py-3 transition-colors hover:bg-paper/[0.1]"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
            {awaitingReply.awaiting === 'client'
              ? '// AWAITING YOUR REPLY'
              : '// OPEN REQUEST'}
          </p>
          <p className="mt-1 text-[13.5px] font-bold text-paper">
            {awaitingReply.title}
          </p>
          <p className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60">
            <span>{awaitingReply.age}</span>
            <span className="text-rust-light">TAP TO ANSWER →</span>
          </p>
        </Link>
      ) : (
        <div className="rounded-md border border-paper/10 bg-paper/[0.04] px-4 py-5 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/55">
            {'// ALL CAUGHT UP'}
          </p>
          <p className="mt-1 text-[12.5px] text-paper/70">
            No open website requests right now.
          </p>
        </div>
      )}

      <Link
        href="/tickets/new?from=request-change&category=website"
        className="mt-auto inline-flex h-10 items-center justify-center rounded-md bg-rust text-[13px] font-bold text-paper transition-colors hover:bg-rust-deep"
      >
        + Request a change
      </Link>
    </div>
  );
}
