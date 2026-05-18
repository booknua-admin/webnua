'use client';

import { NotificationBell } from '@/components/client/notifications/NotificationBell';
import { GlobalSearchInput } from '@/components/shared/search/GlobalSearchInput';
import { useRole } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

type TopbarProps = {
  breadcrumb: React.ReactNode;
  middle?: React.ReactNode;
  /** Explicit global-search field, rendered centred. Mutually exclusive with
   *  `middle` (a page using the step-tracker would not also carry search).
   *  Operators get one auto-rendered here anyway — pass this only to seed a
   *  non-default value (e.g. `/search` seeding the current query). */
  search?: React.ReactNode;
  /** Opt a page out of the operator global-search auto-render — set it on
   *  pages that already carry their own in-body search (e.g. the admin leads
   *  and tickets inboxes) so the chrome doesn't show two search affordances. */
  hideSearch?: boolean;
  actions?: React.ReactNode;
  className?: string;
};

function Topbar({
  breadcrumb,
  middle,
  search,
  hideSearch,
  actions,
  className,
}: TopbarProps) {
  const { role, hydrated } = useRole();
  // The notification bell is a client-role fixture — every client page that
  // mounts a Topbar gets it for free; operators never see it.
  const showBell = hydrated && role === 'client';
  // Global search is the operator-role mirror of the bell: every operator
  // page that mounts a Topbar gets the search field for free. Explicit
  // `middle`/`search` win; `hideSearch` opts a page out.
  const autoSearch =
    hydrated && role === 'admin' && !hideSearch ? <GlobalSearchInput /> : null;
  const centre = middle ?? search ?? autoSearch;
  return (
    <div
      data-slot="topbar"
      className={cn(
        'sticky top-0 z-10 flex h-[68px] items-center gap-6 border-b border-rule bg-paper px-10',
        className,
      )}
    >
      <div className="flex min-w-0 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {breadcrumb}
      </div>
      {centre ? (
        <div className="flex flex-1 items-center justify-center">{centre}</div>
      ) : (
        <div className="flex-1" />
      )}
      {showBell || actions ? (
        <div className="flex items-center gap-3">
          {showBell ? <NotificationBell /> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

type TopbarBreadcrumbProps = {
  trail?: string[];
  current: string;
};

function TopbarBreadcrumb({ trail = [], current }: TopbarBreadcrumbProps) {
  return (
    <>
      {trail.map((segment) => (
        <span key={segment} className="flex items-center">
          <span className="text-ink-quiet">{segment}</span>
          <span className="mx-2 text-rule">/</span>
        </span>
      ))}
      <strong className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
        {current}
      </strong>
    </>
  );
}

export { Topbar, TopbarBreadcrumb };
