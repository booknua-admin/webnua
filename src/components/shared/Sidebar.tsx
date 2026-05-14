import { cn } from '@/lib/utils';

type SidebarProps = React.ComponentProps<'aside'>;

function Sidebar({ className, children, ...props }: SidebarProps) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'sticky top-0 flex h-svh flex-col gap-0 overflow-y-auto bg-ink py-7 text-paper',
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export { Sidebar };
