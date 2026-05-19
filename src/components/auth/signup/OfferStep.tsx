'use client';

// =============================================================================
// OfferStep — the close. The offer stack: free build, pay-when-live, flat
// monthly price, the setup fee waived behind a session-honest countdown. The
// price never appears without the guarantee beside it.
//
// On expiry the offer does NOT vanish (that would kill the lead) — it lapses
// to "offer expired — claim anyway?" and the CTA still works.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import type { GuaranteeEstimate } from '@/lib/signup/guarantee';
import {
  CURRENCY,
  MONTHLY_PRICE,
  SETUP_FEE,
  COUNTDOWN_SECONDS,
  formatMoney,
} from '@/lib/signup/offer';
import { useCountdown, formatCountdown } from '@/lib/signup/use-countdown';

type OfferStepProps = {
  estimate: GuaranteeEstimate;
  onClaim: () => Promise<void>;
};

function OfferStep({ estimate, onClaim }: OfferStepProps) {
  const { remaining, expired } = useCountdown(COUNTDOWN_SECONDS);
  const [submitting, setSubmitting] = useState(false);

  const handleClaim = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onClaim();
    // Parent advances to the confirmation screen.
  };

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-6 text-center">
        <Eyebrow tone="rust">{'// Make it real'}</Eyebrow>
        <h2 className="mt-3 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
          {estimate.leads} qualified leads a month —{' '}
          <span className="text-rust">or we work free</span> until you get
          them.
        </h2>
      </div>

      {/* Countdown banner */}
      <div
        className={`flex items-center justify-between rounded-t-2xl px-6 py-3 text-[13px] font-bold ${
          expired
            ? 'bg-ink text-paper'
            : 'bg-rust text-paper'
        }`}
      >
        <span>
          {expired
            ? 'Offer expired — claim anyway?'
            : `${formatMoney(SETUP_FEE)} setup fee waived`}
        </span>
        <span className="font-mono text-[15px] tracking-[0.04em]">
          {expired ? '0:00' : formatCountdown(remaining)}
        </span>
      </div>

      <div className="rounded-b-2xl border border-t-0 border-rule bg-card px-7 py-7">
        <ul className="flex flex-col gap-3.5">
          <OfferRow
            label="We build your whole lead system"
            value="FREE"
            valueTone="good"
            sub="Pages, funnel, lead capture, follow-up automations."
          />
          <OfferRow
            label="You see it live before you pay a cent"
            value="€0 upfront"
            valueTone="good"
            sub="No payment until your system is built and live."
          />
          <OfferRow
            label="Setup fee"
            value={
              <span>
                <span className="text-ink-quiet line-through">
                  {formatMoney(SETUP_FEE)}
                </span>{' '}
                <span className="text-good">{CURRENCY}0</span>
              </span>
            }
            sub={
              expired
                ? "Timer's up — but it's still on us if you claim now."
                : 'Waived while the timer above is running.'
            }
          />
          <OfferRow
            label="Then, once it's live"
            value={
              <span>
                {formatMoney(MONTHLY_PRICE)}
                <span className="text-[13px] font-bold text-ink-quiet">
                  /mo
                </span>
              </span>
            }
            sub={`That's about ${CURRENCY}${Math.round(
              MONTHLY_PRICE / estimate.leads,
            )} per guaranteed lead. One won job pays for months.`}
          />
        </ul>

        <div className="mt-6 rounded-xl border border-rust/25 bg-rust-soft px-4 py-3.5">
          <p className="text-[13px] leading-[1.5] text-ink">
            <strong className="font-bold">The guarantee:</strong> hit the
            recommended ad spend and if you don&apos;t get your{' '}
            {estimate.leads} qualified leads, we keep working free until you
            do. The risk is ours.
          </p>
        </div>

        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={submitting}
          onClick={handleClaim}
        >
          {submitting ? 'Claiming…' : 'Claim my lead system →'}
        </Button>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet/70">
          No card needed today · a Webnua specialist takes it from here
        </p>
      </div>
    </div>
  );
}

function OfferRow({
  label,
  value,
  sub,
  valueTone,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  valueTone?: 'good';
}) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-paper-2 pb-3.5 last:border-b-0 last:pb-0">
      <div>
        <p className="text-[14px] font-bold tracking-[-0.01em] text-ink">
          {label}
        </p>
        <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-quiet">
          {sub}
        </p>
      </div>
      <span
        className={`shrink-0 text-[17px] font-extrabold tracking-[-0.02em] ${
          valueTone === 'good' ? 'text-good' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </li>
  );
}

export { OfferStep };
