import { cn } from '@/lib/utils';

type SkeletonProps = {
  className?: string;
};

/**
 * Shimmer loading placeholder — the structural stand-in any surface renders
 * while its query is in flight. Paper-2 base with a soft sweep (the
 * `shimmer` keyframes live in globals.css; reduced-motion users get a
 * static block). Webnua-authored — palette tokens, not shadcn roles.
 *
 * Size it at the call site (`h-4 w-40`, `h-9 w-72`, …). For a full
 * page-level loading state, compose via `shared/PageSkeleton` instead of
 * hand-rolling a stack of these per page.
 */
function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-paper-2',
        "after:absolute after:inset-0 after:translate-x-[-100%] after:bg-gradient-to-r after:from-transparent after:via-white/55 after:to-transparent after:content-[''] motion-safe:after:animate-[shimmer_1.6s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

export { Skeleton };
