'use client';

// =============================================================================
// PlanEditorCard — operator editor for one billing plan (Cluster 9 · Session 2).
//
// Mounted on /settings/plans (agency mode). Edits a plan's identity (name,
// description, price, currency, cycle) and its policy bundle — the seat limit,
// capability floor, and integration defaults the plan supplies as Layer 2.5 of
// the policy resolution stack.
//
// Local draft state with a "store info from a previous render" re-sync so an
// external change (another tab, an add/delete elsewhere) refreshes the draft
// without clobbering an in-progress edit. Save writes through upsertPlan.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABEL,
  type Capability,
} from '@/lib/auth/capabilities';
import { removePlan, upsertPlan } from '@/lib/billing/plan-catalog-stub';
import {
  BILLING_CYCLE_LABEL,
  type BillingCycle,
  type Plan,
} from '@/lib/billing/types';

const CYCLES: BillingCycle[] = ['monthly', 'yearly'];

const FIELD_LABEL =
  'mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet';

export function PlanEditorCard({ plan }: { plan: Plan }) {
  const [draft, setDraft] = useState<Plan>(plan);
  const [priceText, setPriceText] = useState(String(plan.price));
  const seatSeed = plan.policy.defaultSeatLimit ?? null;
  const [uncapped, setUncapped] = useState(seatSeed === null);
  const [seatText, setSeatText] = useState(
    seatSeed === null ? '' : String(seatSeed),
  );

  // Re-sync the draft when the stored plan changes from outside this card.
  const planJson = JSON.stringify(plan);
  const [syncedJson, setSyncedJson] = useState(planJson);
  if (syncedJson !== planJson) {
    setSyncedJson(planJson);
    setDraft(plan);
    setPriceText(String(plan.price));
    const s = plan.policy.defaultSeatLimit ?? null;
    setUncapped(s === null);
    setSeatText(s === null ? '' : String(s));
  }

  const caps = draft.policy.defaultClientCapabilities ?? [];
  const shared = draft.policy.integrationDefaults?.sharedProviders ?? {};

  const trimmedName = draft.name.trim();
  const price = Number.parseFloat(priceText);
  const priceValid = Number.isFinite(price) && price >= 0;
  const seatParsed = Number.parseInt(seatText, 10);
  const seatLimit: number | null = uncapped
    ? null
    : Number.isFinite(seatParsed) && seatParsed > 0
      ? seatParsed
      : null;
  const seatValid = uncapped || seatLimit !== null;
  const valid = trimmedName.length > 0 && priceValid && seatValid;

  const next: Plan = {
    ...draft,
    name: trimmedName,
    price: priceValid ? price : draft.price,
    policy: {
      ...draft.policy,
      defaultSeatLimit: seatLimit,
      defaultClientCapabilities: caps,
      integrationDefaults: { sharedProviders: shared },
    },
  };
  const dirty = JSON.stringify(next) !== planJson;

  function toggleCapability(cap: Capability, on: boolean) {
    setDraft((d) => {
      const current = d.policy.defaultClientCapabilities ?? [];
      const nextCaps = on
        ? [...current, cap]
        : current.filter((c) => c !== cap);
      return {
        ...d,
        policy: { ...d.policy, defaultClientCapabilities: nextCaps },
      };
    });
  }

  function toggleProvider(id: string, on: boolean) {
    setDraft((d) => ({
      ...d,
      policy: {
        ...d.policy,
        integrationDefaults: {
          sharedProviders: {
            ...(d.policy.integrationDefaults?.sharedProviders ?? {}),
            [id]: on,
          },
        },
      },
    }));
  }

  function handleSave() {
    if (!valid || !dirty) return;
    upsertPlan(next);
  }

  function handleDelete() {
    if (
      window.confirm(
        `Delete the "${plan.name}" plan? Clients on it revert to agency defaults.`,
      )
    ) {
      removePlan(plan.id);
    }
  }

  return (
    <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className={FIELD_LABEL}>Plan name</label>
          <Input
            className="h-9 bg-card"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            {plan.id}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="-my-1 h-auto shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn hover:bg-warn/10"
        >
          Delete plan
        </Button>
      </div>

      <div className="mb-4">
        <label className={FIELD_LABEL}>Description</label>
        <Textarea
          className="min-h-16 bg-card"
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className={FIELD_LABEL}>Price</label>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            className="h-9 w-28 bg-card"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Currency</label>
          <Input
            className="h-9 w-24 bg-card uppercase"
            value={draft.currency}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                currency: e.target.value.toUpperCase(),
              }))
            }
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Billing cycle</label>
          <Select
            value={draft.billingCycle}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, billingCycle: v as BillingCycle }))
            }
          >
            <SelectTrigger size="sm" className="w-36 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLES.map((cycle) => (
                <SelectItem key={cycle} value={cycle}>
                  {BILLING_CYCLE_LABEL[cycle]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 border-t border-paper-2 pt-4">
        <label className={FIELD_LABEL}>Seat limit</label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            className="h-9 w-24 bg-card"
            value={uncapped ? '' : seatText}
            disabled={uncapped}
            placeholder="—"
            onChange={(e) => setSeatText(e.target.value)}
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
        </div>
        {!seatValid ? (
          <p className="mt-2 font-sans text-[12px] text-warn">
            Enter a number of 1 or more, or tick &ldquo;No limit&rdquo;.
          </p>
        ) : null}
      </div>

      <div className="mb-4 border-t border-paper-2 pt-4">
        <label className={FIELD_LABEL}>Capability floor</label>
        <p className="mb-2.5 font-sans text-[12px] leading-[1.5] text-ink-quiet">
          The capabilities every user on this plan gets by default. Per-user
          grants still apply on top.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {ALL_CAPABILITIES.map((cap) => (
            <Switch
              key={cap}
              label={CAPABILITY_LABEL[cap]}
              checked={caps.includes(cap)}
              onCheckedChange={(on) => toggleCapability(cap, on)}
            />
          ))}
        </div>
      </div>

      <div className="mb-4 border-t border-paper-2 pt-4">
        <label className={FIELD_LABEL}>Integration defaults</label>
        <p className="mb-2.5 font-sans text-[12px] leading-[1.5] text-ink-quiet">
          Providers the agency supplies shared keys for on this plan. Off means
          each sub-account connects its own.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {INTEGRATION_PROVIDERS.map((provider) => (
            <Switch
              key={provider.id}
              label={provider.name}
              checked={shared[provider.id] ?? false}
              onCheckedChange={(on) => toggleProvider(provider.id, on)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-paper-2 pt-4">
        <Button
          size="sm"
          className="h-9"
          disabled={!valid || !dirty}
          onClick={handleSave}
        >
          Save plan
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {!valid
            ? '// Fix the highlighted fields'
            : dirty
              ? '// Unsaved changes'
              : '// Saved'}
        </span>
      </div>
    </div>
  );
}
