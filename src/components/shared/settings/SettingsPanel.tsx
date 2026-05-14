import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SettingsPanelProps = {
  children: React.ReactNode;
  className?: string;
};

function SettingsPanel({ children, className }: SettingsPanelProps) {
  return (
    <Card data-slot="settings-panel" className={cn('py-7', className)}>
      <CardContent className="px-8">{children}</CardContent>
    </Card>
  );
}

export { SettingsPanel };
