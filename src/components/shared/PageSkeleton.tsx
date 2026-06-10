import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type PageSkeletonProps = {
  /** Stat tiles in the top row (0 hides the row). Default 4 — the platform's
   *  standard `grid-cols-4` stat rhythm. */
  statCount?: number;
  /** Render the ink hero band placeholder above the stat row (dashboards
   *  whose loaded state opens with an ink hero — the hub, the client home). */
  hero?: boolean;
  className?: string;
};

/**
 * Structural loading state for a whole page body — mirrors the platform's
 * standard page anatomy (PageHeader block → stat row → content cards) so the
 * loaded surface lands without layout shift. Replaces the mono
 * "// Loading…" notice pattern on page-level query waits.
 *
 * Per-widget loading states stay per-widget; this is only for the
 * "nothing on the page has data yet" moment.
 */
function PageSkeleton({ statCount = 4, hero = false, className }: PageSkeletonProps) {
  return (
    <div
      data-slot="page-skeleton"
      className={cn('flex flex-col gap-7 animate-in fade-in-0 duration-300', className)}
    >
      {/* PageHeader gist — eyebrow / title / subtitle */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-full max-w-[420px]" />
        <Skeleton className="h-4 w-full max-w-[560px]" />
      </div>

      {hero ? <Skeleton className="h-[180px] w-full rounded-2xl bg-paper-3" /> : null}

      {statCount > 0 ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {Array.from({ length: statCount }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-rule bg-card px-5 py-5"
            >
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      ) : null}

      {/* Main content card — list-row gist */}
      <div className="flex flex-col gap-5 rounded-xl border border-rule bg-card px-6 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-20" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-full max-w-[280px]" />
              <Skeleton className="h-3 w-full max-w-[180px]" />
            </div>
            <Skeleton className="hidden h-3 w-16 md:block" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl border border-rule bg-card px-6 py-6"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full max-w-[320px]" />
            <Skeleton className="h-3 w-full max-w-[260px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { PageSkeleton };
export type { PageSkeletonProps };
