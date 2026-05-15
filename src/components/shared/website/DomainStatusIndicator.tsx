// =============================================================================
// DomainStatusIndicator — Session 8. A small status pill for a website's
// primary domain + SSL state. UI ONLY — actual DNS / certificate work is a
// backend concern (design doc §8: domain management is V2, one default
// subdomain per workspace V1).
//
// SSL status drives the dot colour:
//   live    → good — domain resolves, certificate valid
//   pending → warn — provisioning / propagating
//   error   → warn-red — misconfigured, needs attention
// =============================================================================

import type { WebsiteDomain } from '@/lib/website/types';

const SSL_META: Record<
  WebsiteDomain['sslStatus'],
  { dot: string; label: string; tone: string }
> = {
  live: {
    dot: 'bg-good',
    label: 'Secure · SSL live',
    tone: 'text-good',
  },
  pending: {
    dot: 'bg-warn animate-pulse',
    label: 'SSL provisioning',
    tone: 'text-warn',
  },
  error: {
    dot: 'bg-warn',
    label: 'SSL error · needs attention',
    tone: 'text-warn',
  },
};

export type DomainStatusIndicatorProps = {
  domain: WebsiteDomain;
  className?: string;
};

export function DomainStatusIndicator({
  domain,
  className,
}: DomainStatusIndicatorProps) {
  const meta = SSL_META[domain.sslStatus];
  return (
    <div
      data-slot="domain-status-indicator"
      className={`inline-flex items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2 ${className ?? ''}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${meta.dot}`} />
      <span className="font-mono text-[11px] font-bold tracking-[0.04em] text-ink">
        {domain.primary}
      </span>
      <span className="text-rule">·</span>
      <span
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${meta.tone}`}
      >
        {meta.label}
      </span>
      {domain.aliases.length > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          + {domain.aliases.length}{' '}
          {domain.aliases.length === 1 ? 'alias' : 'aliases'}
        </span>
      ) : null}
    </div>
  );
}
