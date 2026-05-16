'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSettingsNav } from '@/lib/nav/use-settings-nav';
import { cn } from '@/lib/utils';

type SettingsNavProps = {
  className?: string;
};

function SettingsNav({ className }: SettingsNavProps) {
  const pathname = usePathname();
  const items = useSettingsNav();

  return (
    <nav data-slot="settings-nav" className={cn('flex flex-col gap-0.5', className)}>
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-slot="settings-nav-item"
            data-active={active || undefined}
            className={cn(
              'flex items-center gap-2.5 rounded px-4 py-2.5 text-sm font-semibold text-ink-quiet transition-colors',
              'hover:bg-paper-2 hover:text-ink',
              'data-[active=true]:bg-ink data-[active=true]:text-paper data-[active=true]:hover:bg-ink data-[active=true]:hover:text-paper',
            )}
          >
            <span aria-hidden className="w-4 shrink-0 text-center font-mono text-[13px]">
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export { SettingsNav };
