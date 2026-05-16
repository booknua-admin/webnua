'use client';

// =============================================================================
// DEV ONLY — agency policy resolution matrix. Off-nav. Lives under app/dev/
// per the convention that dev pages are stub-era only and get gated/wiped
// when real auth lands.
//
// Verifies the three-layer resolver (lib/agency/) in isolation: every policy
// key resolved for agency mode + each sub-account, with the source flag
// (agency vs override). Per sub-account cell, a toggle sets/clears a test
// override so both resolver paths are exercised without real UI.
// =============================================================================

import { useEffect, useReducer } from 'react';

import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { Button } from '@/components/ui/button';
import { adminClients } from '@/lib/nav/admin-clients';
import { getAgencyPolicy, subscribeAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import {
  clearOverride,
  setOverride,
  subscribeOverrides,
} from '@/lib/agency/override-stub';
import { resolvePolicy } from '@/lib/agency/resolver';
import {
  LIVE_POLICY_KEYS,
  POLICY_KEYS,
  POLICY_KEY_LABEL,
  type PolicyKey,
} from '@/lib/agency/types';

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SourceBadge({ source }: { source: 'agency' | 'override' }) {
  const isOverride = source === 'override';
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
        isOverride
          ? 'bg-rust-soft text-rust'
          : 'bg-paper-2 text-ink-quiet'
      }`}
    >
      {source}
    </span>
  );
}

export default function AgencyPolicyDevMatrix() {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const offPolicy = subscribeAgencyPolicy(force);
    const offOverrides = subscribeOverrides(force);
    return () => {
      offPolicy();
      offOverrides();
    };
  }, []);

  return (
    <div className="min-h-svh bg-paper px-10 py-10">
      <DevRoleSwitcher />
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// DEV · AGENCY POLICY RESOLUTION'}
          </p>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Policy <em className="font-extrabold not-italic text-rust">resolver</em> matrix
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-relaxed text-ink-mid">
            Every policy key resolved per workspace context. The{' '}
            <strong className="font-bold text-ink">Agency</strong> column is
            Layer 2; each client column is Layer 3 (inherits the agency value
            unless overridden). The per-cell toggle sets a test override
            mirroring the agency value — proving the source flips to{' '}
            <strong className="font-bold text-ink">override</strong>{' '}
            independent of the value itself.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-rule bg-card">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-paper-2">
                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                  Policy key
                </th>
                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                  Agency
                </th>
                {adminClients.map((client) => (
                  <th
                    key={client.id}
                    className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet"
                  >
                    {client.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POLICY_KEYS.map((key) => (
                <PolicyRow key={key} policyKey={key} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
          {'// '}
          {LIVE_POLICY_KEYS.length} of {POLICY_KEYS.length} keys are wired to UI
          in Cluster 8 — the rest are typed + resolver-ready, surfaced later.
        </p>
      </div>
    </div>
  );
}

function PolicyRow({ policyKey }: { policyKey: PolicyKey }) {
  const isLive = LIVE_POLICY_KEYS.includes(policyKey);
  const agency = resolvePolicy(policyKey, null);

  return (
    <tr className="border-b border-paper-2 last:border-b-0 align-top">
      <td className="px-4 py-3">
        <div className="text-[13px] font-bold text-ink">
          {POLICY_KEY_LABEL[policyKey]}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-quiet">
          {policyKey} · {isLive ? 'wired' : 'deferred'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="mb-1 break-words font-mono text-[11px] text-ink-soft">
          {formatValue(agency.effectiveValue)}
        </div>
        <SourceBadge source={agency.source} />
      </td>
      {adminClients.map((client) => {
        const resolved = resolvePolicy(policyKey, client.id);
        const overridden = resolved.source === 'override';
        return (
          <td key={client.id} className="px-4 py-3">
            <div className="mb-1 break-words font-mono text-[11px] text-ink-soft">
              {formatValue(resolved.effectiveValue)}
            </div>
            <div className="flex items-center gap-2">
              <SourceBadge source={resolved.source} />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  if (overridden) {
                    clearOverride(client.id, policyKey);
                  } else {
                    setOverride(
                      client.id,
                      policyKey,
                      getAgencyPolicy(policyKey),
                    );
                  }
                }}
              >
                {overridden ? 'Clear' : 'Override'}
              </Button>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
