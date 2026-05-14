'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/nav/types';

type SidebarItemProps = NavItem & {
  className?: string;
};

function SidebarItem({ label, href, icon, badge, className }: SidebarItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      data-slot="sidebar-item"
      data-active={active || undefined}
      href={href}
      className={cn(
        'group flex items-center gap-3 px-[26px] py-2.5 text-sm font-medium text-paper/70 transition-colors',
        'hover:bg-paper/[0.04] hover:text-paper',
        'data-[active=true]:border-l-2 data-[active=true]:border-rust data-[active=true]:bg-paper/[0.06] data-[active=true]:pl-[24px] data-[active=true]:text-paper',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex w-4 shrink-0 justify-center text-base text-paper/55',
          'group-data-[active=true]:text-rust-light',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-[2px] font-mono text-[10px] font-bold tracking-[0.06em]',
            badge.tone === 'muted'
              ? 'bg-paper/10 text-paper/55'
              : 'bg-rust text-paper',
          )}
        >
          {badge.text}
        </span>
      ) : null}
    </Link>
  );
}

export { SidebarItem };
