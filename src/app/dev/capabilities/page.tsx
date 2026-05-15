'use client';

// =============================================================================
// DEV ONLY — capability matrix for visual review of the cap layer in
// isolation. Off-nav. Lives under app/dev/ per the convention that dev
// pages are stub-era only and get gated/wiped when real auth ships.
//
// Renders every capability × every <CapabilityGate> mode against the
// currently-active stub user. Switch users via the DevRoleSwitcher in
// the bottom-right corner.
// =============================================================================

import { useState } from 'react';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { Button } from '@/components/ui/button';
import {
  ALL_CAPABILITIES,
  type Capability,
} from '@/lib/auth/capabilities';
import { CAP_EXPLAINER } from '@/lib/auth/explainers';
import { STUB_USERS, useUser } from '@/lib/auth/user-stub';

const MODES = ['hide', 'disable', 'request'] as const;
type Mode = (typeof MODES)[number];

function SyntheticControl({ label }: { label: string }) {
  return (
    <Button variant="secondary" size="sm" className="pointer-events-none">
      {label}
    </Button>
  );
}

export default function CapabilityDevMatrix() {
  const user = useUser();
  const [requestLog, setRequestLog] = useState<string[]>([]);

  const onRequestChange = (cap: Capability) => () => {
    const entry = `${new Date().toLocaleTimeString()} · request → ${cap}`;
    setRequestLog((prev) => [entry, ...prev].slice(0, 8));
  };

  return (
    <div className="min-h-svh bg-paper px-10 py-10">
      <DevRoleSwitcher />
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
              {'// DEV · CAPABILITY MATRIX'}
            </p>
            <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
              <em className="font-extrabold not-italic text-rust">
                {user?.displayName ?? 'no user'}
              </em>
              {user ? ` · ${user.role}` : ''}
            </h1>
            <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-ink-mid">
              Switch users with the dev pill at bottom-right. Each row is a
              capability; each column is a <code>{'<CapabilityGate>'}</code>{' '}
              mode. Cells render a synthetic control wrapped in the gate.
              Holding the cap → control renders unchanged. Lacking the cap →
              behaviour per mode.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// ACTIVE STUB USERS'}
            </p>
            {STUB_USERS.map((u) => (
              <p
                key={u.id}
                className={
                  u.id === user?.id
                    ? 'font-mono text-[11px] text-rust'
                    : 'font-mono text-[11px] text-ink-quiet'
                }
              >
                {u.displayName.toLowerCase()} · {u.capabilities.size} caps
              </p>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-rule bg-card">
          <div className="grid grid-cols-[200px_60px_1fr_1fr_1fr] items-center gap-3 border-b border-rule bg-paper-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            <span>capability</span>
            <span className="text-center">held</span>
            {MODES.map((m) => (
              <span key={m}>mode: {m}</span>
            ))}
          </div>

          {ALL_CAPABILITIES.map((cap) => {
            const held = user?.capabilities.has(cap) ?? false;
            const explainer = CAP_EXPLAINER[cap];
            return (
              <div
                key={cap}
                className="grid grid-cols-[200px_60px_1fr_1fr_1fr] items-center gap-3 border-b border-paper-2 px-5 py-4 last:border-b-0"
              >
                <div>
                  <p className="font-mono text-[12px] font-bold text-ink">
                    {cap}
                  </p>
                  {!explainer.requestLabel && (
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet">
                      no request label
                    </p>
                  )}
                </div>
                <div className="text-center">
                  {held ? (
                    <span className="font-mono text-[12px] font-bold text-good">
                      ✓
                    </span>
                  ) : (
                    <span className="font-mono text-[12px] text-ink-quiet">
                      ✗
                    </span>
                  )}
                </div>
                {MODES.map((mode) => (
                  <div key={mode}>
                    <CapabilityGate
                      capability={cap}
                      mode={mode}
                      onRequestChange={onRequestChange(cap)}
                    >
                      <SyntheticControl label={`Edit ${cap}`} />
                    </CapabilityGate>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-rule bg-card p-5">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// REQUEST-CHANGE CALLBACK LOG'}
          </p>
          {requestLog.length === 0 ? (
            <p className="text-[13px] text-ink-quiet">
              Click any request-mode affordance above to fire the stub
              callback.
            </p>
          ) : (
            <ul className="space-y-1">
              {requestLog.map((entry, i) => (
                <li
                  key={i}
                  className="font-mono text-[11px] text-ink-soft"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
