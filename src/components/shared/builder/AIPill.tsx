import { cn } from '@/lib/utils';

type AIPillProps = {
  children?: React.ReactNode;
  className?: string;
};

function AIPill({ children = 'AI-drafted', className }: AIPillProps) {
  return (
    <span
      data-slot="ai-pill"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-rust/12 px-2 py-[3px] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-rust before:content-['✦']",
        className,
      )}
    >
      {children}
    </span>
  );
}

export { AIPill };
