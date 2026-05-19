'use client';

// =============================================================================
// SignupHookStep — the cold-traffic entry. The hook is the product given away
// before the ask: pick your trade, type your area, and the flow builds you a
// real lead system + a real guarantee. No "create account", no email yet.
// =============================================================================

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { TRADE_OPTIONS, type TradeId } from '@/lib/signup/guarantee';
import type { SignupBrief } from '@/lib/signup/types';

type SignupHookStepProps = {
  brief: SignupBrief;
  onChange: (patch: Partial<SignupBrief>) => void;
  onNext: () => void;
};

function SignupHookStep({ brief, onChange, onNext }: SignupHookStepProps) {
  const ready = !!brief.trade && brief.serviceArea.trim().length > 1;

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div className="mb-8 flex flex-col items-center gap-3 text-center text-ink">
        <BrandMark size="default" />
        <Eyebrow tone="rust">{'// Get more customers'}</Eyebrow>
      </div>

      <h1 className="text-center text-[42px] leading-[1.05] font-extrabold tracking-[-0.04em] text-ink">
        Watch your new lead system build itself —{' '}
        <span className="text-rust">for your business</span>, in 60 seconds.
      </h1>
      <p className="mt-4 text-center text-[16px] leading-[1.55] text-ink-quiet">
        No signup. No sales call. Tell us your trade and where you work, and
        we&apos;ll show you exactly how many customers we can guarantee you
        every month.
      </p>

      <div className="mt-9 rounded-2xl border border-rule bg-card px-7 py-7">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
          What do you do?
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {TRADE_OPTIONS.map((trade) => {
            const active = brief.trade === trade.id;
            return (
              <button
                key={trade.id}
                type="button"
                onClick={() => onChange({ trade: trade.id as TradeId })}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold tracking-[-0.01em] transition-colors ${
                  active
                    ? 'border-rust bg-rust text-paper'
                    : 'border-rule bg-paper text-ink-mid hover:border-rust'
                }`}
              >
                {trade.label}
              </button>
            );
          })}
        </div>

        <label
          htmlFor="signup-area"
          className="mt-6 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink"
        >
          Where do you work?
        </label>
        <Input
          id="signup-area"
          className="mt-3"
          placeholder="e.g. Perth, WA"
          value={brief.serviceArea}
          onChange={(e) => onChange({ serviceArea: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready) onNext();
          }}
        />

        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={!ready}
          onClick={onNext}
        >
          Build my lead system →
        </Button>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet/70">
          Free · takes about a minute
        </p>
      </div>
    </div>
  );
}

export { SignupHookStep };
