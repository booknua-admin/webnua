import Link from 'next/link';

import { cn } from '@/lib/utils';
import {
  LeadClientPill,
  LeadSourcePill,
  LeadStatusPill,
  LeadUrgencyPill,
} from '@/components/shared/leads/pills';
import type {
  LeadClientTone,
  LeadSourceKind,
  LeadStatus,
  LeadUrgency,
} from '@/lib/leads/types';

type ClientLeadRowProps = {
  variant: 'client';
  initial: string;
  name: string;
  suburb: string;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  urgency?: LeadUrgency;
  age: string;
  /** Has unseen customer activity — renders the left rust rail + faint
   *  rust bg AND the small rust dot next to the lead's name. Clears once
   *  the operator opens the lead detail. */
  unread: boolean;
  href: string;
  sourceKind: LeadSourceKind;
};

type AdminLeadRowProps = {
  variant: 'admin';
  initial: string;
  name: string;
  clientName: string;
  clientService: string;
  clientTone: LeadClientTone;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  age: string;
  meta: string;
  metaTone: 'good' | 'rust' | 'quiet';
  /** Has unseen customer activity — renders the left rust rail + faint
   *  rust bg AND the small rust dot next to the lead's name. Clears once
   *  the operator opens the lead detail. */
  unread: boolean;
  href: string;
  sourceKind: LeadSourceKind;
};

type LeadRowProps = ClientLeadRowProps | AdminLeadRowProps;

const ADMIN_TONE_BG: Record<LeadClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]',
  neatworks: 'bg-info',
  flowline: 'bg-[#2d4a6a]',
  generic: 'bg-ink',
};

const ADMIN_META_TONE: Record<AdminLeadRowProps['metaTone'], string> = {
  good: 'text-good',
  rust: 'text-rust',
  quiet: 'text-ink-quiet',
};

// =============================================================================
// LeadRow — responsive across mobile + desktop:
//   - Mobile (<md): stacked card. Avatar + name + age along the top, then
//     preview, then status / source pills + meta along the bottom.
//   - Desktop (≥md): the existing fixed-pixel grid (admin 7-col, client 6-col).
// Both branches render from the same props; the parent list never sees the
// difference. Attention treatment (rust left rail + tinted bg) survives both.
// =============================================================================

function attentionClass(unread: boolean, base = ''): string {
  return cn(
    base,
    unread
      ? 'border-l-[3px] border-l-rust bg-rust/[0.04] hover:bg-rust/[0.07]'
      : 'hover:bg-paper-2',
  );
}

function LeadRow(props: LeadRowProps) {
  if (props.variant === 'client') {
    return (
      <Link
        href={props.href}
        data-slot="lead-row"
        data-variant="client"
        data-attention={props.unread || undefined}
        className={cn(
          'group block border-b border-ink/6 transition-colors last:border-b-0',
          attentionClass(props.unread),
        )}
      >
        {/* Mobile — stacked card */}
        <div
          className={cn(
            'flex flex-col gap-2.5 px-4 py-3.5 md:hidden',
            props.unread && 'pl-[13px]',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 font-sans text-sm font-extrabold text-ink">
              {props.initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                {props.unread ? (
                  <span
                    aria-label="Unread"
                    className="inline-block size-[7px] shrink-0 rounded-full bg-rust"
                  />
                ) : null}
                <span className="truncate">{props.name}</span>
              </div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-ink/55">
                {props.suburb}
              </div>
            </div>
            <div className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
              {props.age}
            </div>
          </div>
          <p className="line-clamp-2 text-[13px] text-ink-quiet">{props.preview}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <LeadStatusPill status={props.status} label={props.statusLabel} />
            {props.urgency ? <LeadUrgencyPill urgency={props.urgency} /> : null}
            <LeadSourcePill source={props.sourceKind} />
          </div>
        </div>

        {/* Desktop — existing grid */}
        <div
          className={cn(
            'hidden items-center gap-4 px-[22px] py-[18px] md:grid md:grid-cols-[44px_1fr_auto_auto_auto_70px]',
            props.unread && 'md:pl-[19px]',
          )}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-paper-2 font-sans text-sm font-extrabold text-ink">
            {props.initial}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 truncate text-[14px] font-semibold text-ink">
              {props.unread ? (
                <span
                  title="Unread"
                  aria-label="Unread"
                  className="inline-block size-[7px] shrink-0 rounded-full bg-rust"
                />
              ) : null}
              <span className="truncate">{props.name}</span>
            </div>
            <div className="truncate text-[13px] text-ink-quiet">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink/55">
                {props.suburb} ·
              </span>{' '}
              {props.preview}
            </div>
          </div>
          <LeadStatusPill status={props.status} label={props.statusLabel} />
          {props.urgency ? <LeadUrgencyPill urgency={props.urgency} /> : <div />}
          <LeadSourcePill source={props.sourceKind} />
          <div className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
            {props.age}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={props.href}
      data-slot="lead-row"
      data-variant="admin"
      data-attention={props.unread || undefined}
      className={cn(
        'group block border-b border-ink/6 transition-colors last:border-b-0',
        attentionClass(props.unread),
      )}
    >
      {/* Mobile — stacked card */}
      <div
        className={cn(
          'flex flex-col gap-2.5 px-4 py-3.5 md:hidden',
          props.unread && 'pl-[13px]',
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full font-sans text-[13px] font-extrabold text-paper',
              ADMIN_TONE_BG[props.clientTone],
            )}
          >
            {props.initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              {props.unread ? (
                <span
                  aria-label="Unread"
                  className="inline-block size-[7px] shrink-0 rounded-full bg-rust"
                />
              ) : null}
              <span className="truncate">{props.name}</span>
            </div>
            <LeadClientPill
              name={props.clientName}
              service={props.clientService}
              tone={props.clientTone}
            />
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
              {props.age}
            </div>
            <div
              className={cn(
                'mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em]',
                ADMIN_META_TONE[props.metaTone],
              )}
            >
              {props.meta}
            </div>
          </div>
        </div>
        <p className="line-clamp-2 text-[13px] text-ink-quiet">{props.preview}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <LeadStatusPill status={props.status} label={props.statusLabel} />
          <LeadSourcePill source={props.sourceKind} />
        </div>
      </div>

      {/* Desktop — existing 7-col grid */}
      <div
        className={cn(
          'hidden items-center gap-3 px-[18px] py-4 md:grid md:grid-cols-[36px_180px_1fr_110px_80px_80px_100px]',
          props.unread && 'md:pl-[15px]',
        )}
      >
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full font-sans text-[13px] font-extrabold text-paper',
            ADMIN_TONE_BG[props.clientTone],
          )}
        >
          {props.initial}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 truncate text-[14px] font-semibold text-ink">
            {props.unread ? (
              <span
                title="Unread"
                aria-label="Unread"
                className="inline-block size-[7px] shrink-0 rounded-full bg-rust"
              />
            ) : null}
            <span className="truncate">{props.name}</span>
          </div>
          <LeadClientPill
            name={props.clientName}
            service={props.clientService}
            tone={props.clientTone}
          />
        </div>
        <div className="min-w-0 truncate text-[13px] text-ink-quiet">
          {props.preview}
        </div>
        <LeadStatusPill status={props.status} label={props.statusLabel} />
        <LeadSourcePill source={props.sourceKind} />
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
          {props.age}
        </div>
        <div
          className={cn(
            'text-right font-mono text-[11px] font-bold uppercase tracking-[0.06em]',
            ADMIN_META_TONE[props.metaTone],
          )}
        >
          {props.meta}
        </div>
      </div>
    </Link>
  );
}

export { LeadRow };
export type { LeadRowProps, ClientLeadRowProps, AdminLeadRowProps };
