'use client';

// =============================================================================
// GuaranteeRevealCard — the "N qualified leads/month, or we work free" card.
// Rendered twice in the flow: the first (tease) figure after trade + area,
// and the bigger (final) figure after the business brief.
//
// The minimum-ad-spend condition is shown OPENLY beside the number — a hidden
// condition on a headline promise reads as bait-and-switch. Stated plainly it
// adds credibility: this is a real system with real inputs.
// =============================================================================

import { Eyebrow } from '@/components/ui/eyebrow';
import { formatMoney } from '@/lib/signup/offer';
import type { GuaranteeEstimate } from '@/lib/signup/guarantee';

type GuaranteeRevealCardProps = {
  estimate: GuaranteeEstimate;
  variant: 'tease' | 'final';
  area: string;
};

function GuaranteeRevealCard({
  estimate,
  variant,
  area,
}: GuaranteeRevealCardProps) {
  const isFinal = variant === 'final';

  return (
    <div className="overflow-hidden rounded-2xl border border-ink bg-ink text-paper">
      <div className="px-9 pt-9 pb-8">
        <Eyebrow tone="rust">
          {isFinal ? '// Your final guarantee' : '// Your guarantee'}
        </Eyebrow>

        <p className="mt-4 text-[15px] leading-[1.5] text-paper/75">
          {isFinal ? (
            <>
              We&apos;ve sharpened your numbers. Using this exact lead system,
              we can guarantee you
            </>
          ) : (
            <>
              Based on what&apos;s working for {area}, we can guarantee you
            </>
          )}
        </p>

        <div className="mt-3 flex items-end gap-3">
          <span className="text-[84px] leading-[0.9] font-extrabold tracking-[-0.04em] text-rust-light">
            {estimate.leads}
          </span>
          <span className="mb-2 text-[18px] font-bold leading-[1.2] tracking-[-0.02em]">
            qualified leads
            <br />
            <span className="text-paper/65">every month</span>
          </span>
        </div>

        <p className="mt-5 text-[17px] font-bold leading-[1.35] tracking-[-0.01em]">
          <span className="text-rust-light">— or we work for free</span> until
          you get them.
        </p>
      </div>

      <div className="border-t border-paper/12 bg-paper/[0.04] px-9 py-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/55">
          {'// How the guarantee works'}
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[13px] leading-[1.5] text-paper/80">
          <li>
            <span className="text-good">✓</span>{' '}
            <strong className="font-bold text-paper">Qualified</strong> = a lead
            our automations nurture until they book a call or buy.
          </li>
          <li>
            <span className="text-good">✓</span> Recommended ad spend:{' '}
            <strong className="font-bold text-paper">
              {formatMoney(estimate.adSpendMin)}–
              {formatMoney(estimate.adSpendMax)}/mo
            </strong>{' '}
            — paid to the ad platform, not to us.
          </li>
          <li>
            <span className="text-good">✓</span> Miss the number while spending
            it? We keep working free until you hit it.
          </li>
        </ul>
      </div>
    </div>
  );
}

export { GuaranteeRevealCard };
