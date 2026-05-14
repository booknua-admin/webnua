import { cn } from '@/lib/utils';

type SidebarSectionLabelProps = React.ComponentProps<'div'>;

function SidebarSectionLabel({
  className,
  children,
  ...props
}: SidebarSectionLabelProps) {
  return (
    <div
      data-slot="sidebar-section-label"
      className={cn(
        'mt-5 mb-2 px-[26px] font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/45',
        className,
      )}
      {...props}
    >
      {'// '}
      {children}
    </div>
  );
}

export { SidebarSectionLabel };
