import { cn } from '@/lib/utils';

type HelpFaqItemProps = {
  question: string;
  answer?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

function HelpFaqItem({ question, answer, defaultOpen, className }: HelpFaqItemProps) {
  return (
    <details
      data-slot="help-faq-item"
      open={defaultOpen}
      className={cn(
        'group cursor-pointer border-b border-paper-2 px-5 py-4 last:border-b-0 hover:bg-card',
        className,
      )}
    >
      <summary
        data-slot="help-faq-q"
        className="flex list-none items-center justify-between text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden"
      >
        <span>{question}</span>
        <span
          aria-hidden
          className="font-mono text-[16px] font-semibold text-ink-quiet group-open:hidden"
        >
          +
        </span>
        <span
          aria-hidden
          className="hidden font-mono text-[16px] font-semibold text-ink-quiet group-open:inline"
        >
          −
        </span>
      </summary>
      {answer ? (
        <div className="mt-2.5 text-[13px] leading-[1.55] text-ink-quiet [&_strong]:text-ink">
          {answer}
        </div>
      ) : null}
    </details>
  );
}

export { HelpFaqItem };
