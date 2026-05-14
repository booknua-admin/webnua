import { PreviewPanelBar } from '@/components/shared/builder/PreviewPanelBar';
import type { FunnelPreviewState } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type FunnelLandingPreviewProps = {
  state: FunnelPreviewState;
  /** If the funnel has nothing to render yet, the skeleton fills the canvas. */
  skeleton?: { title: string; description: string };
  className?: string;
};

function FunnelLandingPreview({
  state,
  skeleton,
  className,
}: FunnelLandingPreviewProps) {
  const hasContent =
    state.eyebrow ||
    state.headline ||
    state.sub ||
    state.offerCard ||
    state.cta ||
    state.trust ||
    state.jobs;

  return (
    <div data-slot="funnel-landing-preview" className={className}>
      <PreviewPanelBar domain={state.domain} />
      <div
        data-slot="live-preview"
        className="relative min-h-[600px] bg-paper px-9 pb-12 pt-8"
      >
        {skeleton && !hasContent ? (
          <PreviewSkeleton {...skeleton} />
        ) : (
          <FunnelPreviewPage state={state} />
        )}
      </div>
    </div>
  );
}

function PreviewSkeleton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      data-slot="preview-state-skeleton"
      className="flex flex-col items-center justify-center px-6 py-20 text-center text-ink-quiet"
    >
      <div className="mb-4.5 font-mono text-[48px] text-rule">{'{ }'}</div>
      <h3 className="mb-2 font-sans text-[18px] font-bold text-ink-soft">
        {title}
      </h3>
      <p className="max-w-[280px] font-sans text-[14px] leading-[1.5] text-ink-quiet">
        {description}
      </p>
    </div>
  );
}

function FunnelPreviewPage({ state }: { state: FunnelPreviewState }) {
  return (
    <div data-slot="vp-page" className="bg-paper text-ink">
      {/* Header */}
      <div
        data-slot="vp-header"
        className="mb-7 flex items-center justify-between border-b border-rule pb-5.5"
      >
        <div className="font-sans text-[24px] font-extrabold tracking-[-0.025em] text-ink [&_em]:font-medium [&_em]:not-italic [&_em]:text-rust">
          {state.header.logo}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 font-sans text-[13px] font-bold text-paper">
          {state.header.phone}
        </div>
      </div>

      {/* Eyebrow */}
      {state.eyebrow ? (
        <div
          data-slot="vp-eyebrow"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-good before:size-1.5 before:rounded-full before:bg-good before:content-['']"
        >
          {state.eyebrow.text}
        </div>
      ) : null}

      {/* Headline */}
      {state.headline ? (
        <div
          data-slot="vp-h1"
          className="mb-4 max-w-[580px] font-sans text-[38px] leading-[1.02] font-extrabold tracking-[-0.035em] text-ink [&_em]:font-bold [&_em]:not-italic [&_em]:text-rust"
        >
          {state.headline.text}
        </div>
      ) : null}

      {/* Sub-headline */}
      {state.sub ? (
        <div
          data-slot="vp-sub"
          className="mb-5.5 max-w-[540px] font-sans text-[15px] leading-[1.55] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink"
        >
          {state.sub.text}
        </div>
      ) : null}

      {/* Offer card */}
      {state.offerCard ? (
        <div
          data-slot="vp-offer-card"
          className="mb-4.5 flex max-w-[420px] items-center gap-4.5 rounded-xl border-2 border-ink bg-card px-5.5 py-4.5"
        >
          <div
            data-slot="vp-offer-num"
            className="shrink-0 font-sans text-[38px] leading-none font-black tracking-[-0.035em] text-ink [&_em]:not-italic [&_em]:text-rust"
          >
            {state.offerCard.num}
          </div>
          <div>
            <div className="mb-1 font-sans text-[15px] font-bold leading-[1.2] text-ink">
              {state.offerCard.headline}
            </div>
            <div className="font-sans text-[12px] leading-[1.4] text-ink-quiet">
              {state.offerCard.sub}
            </div>
          </div>
        </div>
      ) : null}

      {/* CTA row */}
      {state.cta ? (
        <div data-slot="vp-cta-row" className="mb-6 flex gap-2.5">
          <div className="rounded-lg bg-ink px-6 py-[13px] font-sans text-[14px] font-bold text-paper">
            {state.cta.primary}
          </div>
          <div className="rounded-lg border border-rule bg-card px-6 py-[13px] font-sans text-[14px] font-bold text-ink">
            {state.cta.secondary}
          </div>
        </div>
      ) : null}

      {/* Trust row */}
      {state.trust ? (
        <div
          data-slot="vp-trust-row"
          className="grid grid-cols-4 gap-4.5 border-t border-rule py-4.5"
        >
          {state.trust.items.map((item, idx) => (
            <div key={idx}>
              <div className="font-sans text-[20px] leading-none font-black tracking-[-0.025em] text-ink">
                {item.num}
              </div>
              <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Jobs grid */}
      {state.jobs ? (
        <div
          data-slot="vp-jobs-section"
          className="mt-6 border-t border-rule pt-5.5"
        >
          <div
            data-slot="vp-jobs-title"
            className={cn(
              'mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust',
            )}
          >
            {state.jobs.title}
          </div>
          <div
            data-slot="vp-jobs-list"
            className="grid grid-cols-2 gap-x-3 gap-y-2"
          >
            {state.jobs.rows.map((row, idx) => (
              <div
                key={idx}
                className="flex items-baseline justify-between border-b border-dotted border-rule py-1.5 pr-3 font-sans text-[13px] text-ink"
              >
                <span>{row.name}</span>
                <span className="font-extrabold tracking-[-0.01em] text-rust">
                  {row.price}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { FunnelLandingPreview };
