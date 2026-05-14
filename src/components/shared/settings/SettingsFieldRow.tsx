import { cn } from '@/lib/utils';

type SettingsFieldRowProps = {
  label: string;
  sub?: string;
  value: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

function SettingsFieldRow({ label, sub, value, action, className }: SettingsFieldRowProps) {
  return (
    <div
      data-slot="settings-field-row"
      className={cn(
        'grid grid-cols-[220px_1fr] items-center gap-6 border-b border-dotted border-rule-soft py-3.5 last:border-b-0 last:pb-0',
        className,
      )}
    >
      <div data-slot="settings-field-label" className="text-[13px] font-semibold text-ink">
        {label}
        {sub ? (
          <span className="mt-0.5 block text-[11px] font-medium leading-[1.4] text-ink-quiet">
            {sub}
          </span>
        ) : null}
      </div>
      <div
        data-slot="settings-field-value"
        className="flex items-center gap-2.5 text-[14px] font-semibold text-ink [&_.mono]:font-mono"
      >
        <span className="flex-1">{value}</span>
        {action ? (
          <span data-slot="settings-field-action" className="shrink-0">
            {action}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { SettingsFieldRow };
