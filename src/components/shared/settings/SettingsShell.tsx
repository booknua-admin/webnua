import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsContextBanner } from '@/components/shared/settings/SettingsContextBanner';
import { SettingsNav } from '@/components/shared/settings/SettingsNav';
import { cn } from '@/lib/utils';

type SettingsShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function SettingsShell({
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: SettingsShellProps) {
  return (
    <div data-slot="settings-shell" className={cn('flex flex-col gap-7 px-10 py-10', className)}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <SettingsContextBanner />
      <div data-slot="settings-layout" className="grid grid-cols-[220px_1fr] items-start gap-7">
        <SettingsNav />
        <div data-slot="settings-content" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export { SettingsShell };
