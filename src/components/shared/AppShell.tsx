import { cn } from '@/lib/utils';

type AppShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function AppShell({ sidebar, children, className }: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        'grid min-h-svh w-full grid-cols-[280px_1fr] bg-paper',
        className,
      )}
    >
      {sidebar}
      <main className="flex min-w-0 flex-col">{children}</main>
    </div>
  );
}

export { AppShell };
