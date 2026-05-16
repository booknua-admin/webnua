'use client';

// =============================================================================
// /settings/seats — agency-level policy surface (Cluster 8 · Session 3).
// Sets the `defaultSeatLimit` policy key (Layer 2): the seat limit a brand-new
// sub-account inherits. Per-sub-account overrides live on /settings/access in
// sub-account mode (the seat limit there resolves through this default —
// Session 4 wires that path).
//
// Reads/writes the agency policy store directly — this IS the Layer-2 surface.
// =============================================================================

import { useState } from 'react';

import { setAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import { useAgencyPolicy } from '@/lib/agency/use-policy';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

export default function DefaultSeatLimitPage() {
  const currentLimit = useAgencyPolicy('defaultSeatLimit');

  const [uncapped, setUncapped] = useState(currentLimit === null);
  const [limitText, setLimitText] = useState(
    currentLimit === null ? '' : String(currentLimit),
  );

  // Re-sync the draft when the stored value changes from outside this
  // component (hydration, or another tab) — React's "store info from a
  // previous render" pattern, preferred over an effect.
  const [syncedLimit, setSyncedLimit] = useState(currentLimit);
  if (syncedLimit !== currentLimit) {
    setSyncedLimit(currentLimit);
    setUncapped(currentLimit === null);
    setLimitText(currentLimit === null ? '' : String(currentLimit));
  }

  const parsed = Number.parseInt(limitText, 10);
  const draftLimit = uncapped
    ? null
    : Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  const draftInvalid = !uncapped && draftLimit === null;
  const dirty = draftLimit !== currentLimit;

  function handleSave() {
    if (draftInvalid) return;
    setAgencyPolicy('defaultSeatLimit', draftLimit);
  }

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Settings']} current="Default seat limit" />
        }
      />
      <SettingsShell
        eyebrow="Agency · Webnua Perth"
        title={
          <>
            Default <em>seat limit</em>.
          </>
        }
        subtitle={
          <>
            <strong>The seat limit a new sub-account inherits.</strong> It caps
            how many users a client business can have. Override it per client
            from Access in sub-account mode.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsPanel>
          <div className="mb-6">
            <WorkspaceContextBanner hideReturnButton />
          </div>

          <SettingsSection
            heading={
              <>
                Default <em>maximum users</em>
              </>
            }
            description={
              <>
                Applied to every new sub-account at onboarding. Existing clients
                with a per-account override are unaffected — this only sets the
                inherited baseline.
              </>
            }
          >
            <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
              <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                Maximum users per sub-account
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className="h-9 w-24 bg-card"
                  value={uncapped ? '' : limitText}
                  disabled={uncapped}
                  placeholder="—"
                  onChange={(e) => setLimitText(e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2 font-sans text-[13px] text-ink-soft">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-rust"
                    checked={uncapped}
                    onChange={(e) => setUncapped(e.target.checked)}
                  />
                  No limit
                </label>
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!dirty || draftInvalid}
                  onClick={handleSave}
                >
                  Save default
                </Button>
              </div>
              {draftInvalid ? (
                <p className="mt-2 font-sans text-[12px] text-warn">
                  Enter a number of 1 or more, or tick &ldquo;No limit&rdquo;.
                </p>
              ) : (
                <p className="mt-2 font-sans text-[12px] leading-[1.5] text-ink-quiet">
                  {currentLimit === null
                    ? 'New sub-accounts are uncapped by default.'
                    : `New sub-accounts inherit a ${currentLimit}-user limit.`}{' '}
                  Both existing users and pending invites count toward a
                  client&rsquo;s limit.
                </p>
              )}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
