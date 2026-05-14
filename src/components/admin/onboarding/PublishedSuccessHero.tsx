import { cn } from '@/lib/utils';

type PublishedSuccessHeroProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  url: string;
  scheme?: string;
  className?: string;
};

function PublishedSuccessHero({
  title,
  description,
  url,
  scheme = 'https://',
  className,
}: PublishedSuccessHeroProps) {
  return (
    <div
      data-slot="success-wrap"
      className={cn(
        'mb-7 rounded-[14px] border border-rule bg-card px-8 pb-8 pt-12 text-center',
        className,
      )}
    >
      <div
        data-slot="success-icon"
        className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-good-soft font-sans text-[48px] font-black text-good"
      >
        ✓
      </div>
      <h1 className="mb-3 font-sans text-[36px] font-extrabold tracking-[-0.035em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {title}
      </h1>
      <p className="mx-auto mb-7 max-w-[580px] font-sans text-[17px] leading-[1.55] text-ink-quiet">
        {description}
      </p>
      <div
        data-slot="success-url-row"
        className="inline-flex items-center gap-3 rounded-[10px] border border-rule bg-paper px-5 py-3.5 font-mono text-[14px] text-ink"
      >
        <span>
          <span className="text-ink-quiet">{scheme}</span>
          {url}
        </span>
        <span className="text-rule">·</span>
        <span className="font-bold text-good">● LIVE</span>
        <span className="cursor-pointer rounded-md bg-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-paper">
          Copy link
        </span>
        <span className="cursor-pointer rounded-md bg-rust px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-paper">
          Open ↗
        </span>
      </div>
    </div>
  );
}

export { PublishedSuccessHero };
