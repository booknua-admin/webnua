'use client';

// =============================================================================
// PreviewReveal — the dopamine hit. A themed mockup of the prospect's own lead
// system, in a browser frame, using their business name, trade, area and brand
// colours. Purpose-built for the marketing reveal (not the editor's section
// previews — those are capability-gated, registry-driven editor chrome; this
// is a tuned, dependency-free marketing artefact).
// =============================================================================

import { Eyebrow } from '@/components/ui/eyebrow';
import { tradeLabel } from '@/lib/signup/guarantee';
import type { GuaranteeEstimate } from '@/lib/signup/guarantee';
import type { SignupBrief } from '@/lib/signup/types';

type PreviewRevealProps = {
  brief: SignupBrief;
  estimate: GuaranteeEstimate;
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || 'yourbusiness'
  );
}

function PreviewReveal({ brief, estimate }: PreviewRevealProps) {
  const accent = brief.brandColors[0] ?? '#d24317';
  const accent2 = brief.brandColors[1] ?? accent;
  const business = brief.businessName.trim() || 'Your Business';
  const trade = tradeLabel(brief.trade);
  const area = brief.serviceArea.trim() || 'your area';
  const service = brief.mainService.trim() || `Fast, reliable ${trade.toLowerCase()} work`;

  return (
    <div>
      <div className="mb-5 text-center">
        <Eyebrow tone="rust">{'// Your lead system — built'}</Eyebrow>
        <h2 className="mt-3 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
          Here&apos;s what we built for{' '}
          <span className="text-rust">{business}</span>.
        </h2>
        <p className="mt-2 text-[15px] leading-[1.5] text-ink-quiet">
          A real customer-getting page — yours to launch this week.
        </p>
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-xl border border-ink/15 bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-rule bg-paper-2 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rule" />
          <span className="h-2.5 w-2.5 rounded-full bg-rule" />
          <span className="h-2.5 w-2.5 rounded-full bg-rule" />
          <span className="ml-3 rounded bg-card px-3 py-1 font-mono text-[10px] text-ink-quiet">
            {slugify(business)}.com
          </span>
        </div>

        {/* Mock nav */}
        <div className="flex items-center justify-between px-6 py-3.5">
          <span
            className="text-[15px] font-extrabold tracking-[-0.02em]"
            style={{ color: accent }}
          >
            {business}
          </span>
          <span
            className="rounded-md px-3 py-1.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            Call now
          </span>
        </div>

        {/* Hero */}
        <div
          className="px-6 py-9 text-center"
          style={{
            background: `linear-gradient(160deg, ${accent}14, ${accent2}0a)`,
          }}
        >
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            {trade} · {area}
          </p>
          <p className="mx-auto mt-2.5 max-w-[460px] text-[26px] leading-[1.12] font-extrabold tracking-[-0.03em] text-ink">
            Need {trade.toLowerCase()} work in {area}? Get a fast quote today.
          </p>
          <p className="mx-auto mt-2.5 max-w-[380px] text-[13px] leading-[1.5] text-ink-mid">
            {service}
          </p>
          <span
            className="mt-4 inline-block rounded-lg px-5 py-2.5 text-[13px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            Get my free quote →
          </span>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-3 border-t border-rule">
          {['Fully licensed', '5-star rated', 'Same-week service'].map(
            (label) => (
              <div
                key={label}
                className="border-r border-rule px-3 py-3.5 text-center last:border-r-0"
              >
                <p
                  className="text-[15px] font-extrabold"
                  style={{ color: accent }}
                >
                  ✓
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-ink-mid">
                  {label}
                </p>
              </div>
            ),
          )}
        </div>

        {/* Capture strip */}
        <div className="border-t border-rule bg-paper-2 px-6 py-5">
          <p className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Lead capture + automatic follow-up'}
          </p>
          <div className="mx-auto mt-3 flex max-w-[420px] items-center gap-2">
            <span className="flex-1 rounded-md border border-rule bg-card px-3 py-2 text-left text-[11px] text-ink-quiet">
              Name &amp; phone…
            </span>
            <span
              className="rounded-md px-3.5 py-2 text-[11px] font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              Send
            </span>
          </div>
          <p className="mt-2.5 text-center text-[11px] text-ink-quiet">
            Every enquiry is nurtured by automation until they book — that&apos;s
            how we get you{' '}
            <strong className="font-bold text-ink">
              {estimate.leads} qualified leads a month
            </strong>
            .
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-[13px] leading-[1.5] text-ink-quiet">
        This is a preview. Your real system — pages, funnel, follow-up
        automations — is built and managed for you by the Webnua team.
      </p>
    </div>
  );
}

export { PreviewReveal };
