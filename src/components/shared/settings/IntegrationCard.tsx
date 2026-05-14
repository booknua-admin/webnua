import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IntegrationStatus = 'connected' | 'warning' | 'missing' | 'partial';

type IntegrationLogoTone = 'gbp' | 'meta' | 'ga' | 'gads' | 'stripe' | 'generic';

type IntegrationAction = {
  label: string;
  href?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
};

type IntegrationCardProps = {
  name: string;
  description: React.ReactNode;
  status: IntegrationStatus;
  statusLabel?: string;
  logo: { initial: string; tone?: IntegrationLogoTone };
  meta?: React.ReactNode;
  action: IntegrationAction;
  className?: string;
};

const logoToneClass: Record<IntegrationLogoTone, string> = {
  gbp: 'bg-[#4285F4] text-white',
  meta: 'bg-[#1877F2] text-white',
  ga: 'bg-[#E37400] text-white',
  gads: 'bg-[#34A853] text-white',
  stripe: 'bg-[#635BFF] text-white',
  generic: 'bg-ink text-rust-light',
};

const statusPillClass: Record<IntegrationStatus, string> = {
  connected: 'bg-good/12 text-good',
  warning: 'bg-warn/12 text-warn',
  missing: 'bg-ink/[0.06] text-ink-quiet',
  partial: 'bg-rust/12 text-rust',
};

const cardEdgeClass: Record<IntegrationStatus, string> = {
  connected: 'border-good/20 bg-gradient-to-r from-good/[0.04] from-0% to-paper to-30%',
  warning: 'border-warn/30 bg-gradient-to-r from-warn/[0.05] from-0% to-paper to-30%',
  missing: 'border-ink/10 bg-paper',
  partial: 'border-rust/25 bg-gradient-to-r from-rust/[0.04] from-0% to-paper to-30%',
};

const defaultStatusLabel: Record<IntegrationStatus, string> = {
  connected: 'Connected',
  warning: 'Needs reauth',
  missing: 'Not connected',
  partial: 'Partially connected',
};

function IntegrationCard({
  name,
  description,
  status,
  statusLabel,
  logo,
  meta,
  action,
  className,
}: IntegrationCardProps) {
  const tone = logo.tone ?? 'generic';
  const buttonVariant =
    action.variant ??
    (status === 'missing' ? 'default' : status === 'warning' ? 'destructive' : 'outline');

  return (
    <div
      data-slot="integration-card"
      data-status={status}
      className={cn(
        'grid grid-cols-[56px_1fr_auto] items-center gap-4 rounded-xl border px-[22px] py-[18px] transition-colors hover:border-ink/20',
        cardEdgeClass[status],
        className,
      )}
    >
      <div
        data-slot="integration-card-logo"
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold',
          logoToneClass[tone],
        )}
      >
        {logo.initial}
      </div>

      <div data-slot="integration-card-info" className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
          {name}
          <span
            data-slot="integration-card-status"
            className={cn(
              'inline-flex items-center rounded-full px-[7px] py-[2px] font-mono text-[9px] font-semibold tracking-[0.08em] uppercase',
              statusPillClass[status],
            )}
          >
            {statusLabel ?? defaultStatusLabel[status]}
          </span>
        </div>
        <div className="text-[13px] leading-[1.45] text-ink/60 [&_strong]:font-semibold [&_strong]:text-ink">
          {description}
        </div>
        {meta ? (
          <div
            data-slot="integration-card-meta"
            className={cn(
              'mt-1 font-mono text-[11px] tracking-[0.05em] uppercase',
              status === 'warning' ? 'text-warn' : 'text-ink/45',
              '[&_strong]:text-good',
              status === 'warning' && '[&_strong]:text-warn',
            )}
          >
            {meta}
          </div>
        ) : null}
      </div>

      <div data-slot="integration-card-actions" className="shrink-0">
        {action.href ? (
          <Button asChild variant={buttonVariant} size="sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant={buttonVariant} size="sm">
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export { IntegrationCard };
export type { IntegrationStatus, IntegrationLogoTone, IntegrationCardProps, IntegrationAction };
