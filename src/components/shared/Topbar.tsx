import { cn } from '@/lib/utils';

type TopbarProps = {
  breadcrumb: React.ReactNode;
  middle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

function Topbar({ breadcrumb, middle, actions, className }: TopbarProps) {
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
      {middle ? (
        <div className="flex flex-1 items-center justify-center">{middle}</div>
      ) : (
        <div className="flex-1" />
      )}
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
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
