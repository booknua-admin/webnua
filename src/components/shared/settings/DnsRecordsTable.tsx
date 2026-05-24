'use client';

// =============================================================================
// DnsRecordsTable — the rows the customer copies to their registrar.
//
// Phase 9. Each record has a copy-to-clipboard affordance on the value.
// =============================================================================

import { useState } from 'react';

import type { DnsRecordRequirement } from '@/lib/domains/types';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No-op — clipboard may be unavailable in iframes / older browsers.
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
      aria-label={`Copy ${label}`}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export function DnsRecordsTable({ records }: { records: DnsRecordRequirement[] }) {
  if (records.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
        {'// No DNS records returned yet — refresh in a moment.'}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-rule bg-paper">
      {/* Desktop header — same 5-col grid as desktop rows */}
      <div className="hidden gap-2 border-b border-rule bg-paper-2 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet md:grid md:grid-cols-[80px_1fr_2fr_60px_60px]">
        <span>Type</span>
        <span>Name</span>
        <span>Value</span>
        <span>TTL</span>
        <span className="text-right">Copy</span>
      </div>
      {records.map((record, index) => (
        <div
          key={`${record.type}-${record.name}-${index}`}
          className="border-b border-rule text-[13px] last:border-b-0"
        >
          {/* Mobile — stacked field/value pairs */}
          <div className="flex flex-col gap-1.5 px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-tight text-ink">
                {record.type}
              </span>
              <CopyButton
                value={record.value}
                label={`${record.type} record for ${record.name}`}
              />
            </div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
              Name
            </div>
            <div className="break-all font-mono text-[12px] text-ink">
              {record.name}
            </div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
              Value
            </div>
            <div className="break-all font-mono text-[12px] text-ink">
              {record.value}
            </div>
            <div className="font-mono text-[11px] text-ink-quiet">
              TTL {record.ttl ?? 3600}
            </div>
          </div>
          {/* Desktop — original grid */}
          <div className="hidden items-center gap-2 px-4 py-3 md:grid md:grid-cols-[80px_1fr_2fr_60px_60px]">
            <span className="font-mono font-bold uppercase tracking-tight text-ink">
              {record.type}
            </span>
            <span className="truncate font-mono text-ink">{record.name}</span>
            <span className="truncate font-mono text-ink" title={record.value}>
              {record.value}
            </span>
            <span className="font-mono text-ink-quiet">{record.ttl ?? 3600}</span>
            <div className="flex justify-end">
              <CopyButton
                value={record.value}
                label={`${record.type} record for ${record.name}`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
