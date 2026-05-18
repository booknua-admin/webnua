'use client';

// =============================================================================
// NewTicketForm — the ticket submit form behind /tickets/new.
//
// Reached two ways:
//   1. The client inbox "+ New ticket" CTA + funnel-detail "Request a
//      change" CTAs (a plain new ticket).
//   2. A `<CapabilityGate mode="request">` request-change affordance in the
//      page editor — arrives with ?from=request-change and field context in
//      the query (design doc §1.3 / §3.3 Lane C). The form prefills the
//      category and shows a context banner.
//
// Stub layer: submitting logs the draft and routes back to the inbox — real
// ticket creation lands with the backend pass.
// =============================================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ChipSelector, type ChipOption } from '@/components/shared/ChipSelector';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { TicketsHero } from '@/components/shared/tickets/TicketsHero';
import {
  BuilderField,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';
import { Button } from '@/components/ui/button';
import { CAPABILITY_LABEL, type Capability } from '@/lib/auth/capabilities';
import {
  CATEGORY_LABEL,
  URGENCY_LABEL,
  type TicketCategory,
  type TicketUrgency,
} from '@/lib/tickets/types';

const DESCRIPTION_MAX = 2000;

// `website-approval` is system-generated (Lane B submissions) — not a
// category a user picks when opening a ticket by hand.
const CATEGORY_OPTIONS: ChipOption<TicketCategory>[] = (
  ['website', 'marketing', 'campaigns', 'reviews', 'billing', 'other'] as const
).map((id) => ({ id, label: CATEGORY_LABEL[id] }));

const URGENCY_OPTIONS: ChipOption<TicketUrgency>[] = (
  ['none', 'soon', 'rush'] as const
).map((id) => ({ id, label: URGENCY_LABEL[id] }));

function isCategory(value: string | null): value is TicketCategory {
  return !!value && CATEGORY_OPTIONS.some((o) => o.id === value);
}

export function NewTicketForm() {
  const router = useRouter();
  const params = useSearchParams();

  const fromRequestChange = params.get('from') === 'request-change';
  const requestField = params.get('field');
  const requestCap = params.get('cap') as Capability | null;

  const initialCategory = useMemo<TicketCategory>(() => {
    const param = params.get('category');
    return isCategory(param) ? param : 'website';
  }, [params]);

  const [category, setCategory] = useState<TicketCategory>(initialCategory);
  const [urgency, setUrgency] = useState<TicketUrgency>('soon');
  const [title, setTitle] = useState(
    fromRequestChange ? 'Change request from the page editor' : '',
  );
  const [description, setDescription] = useState('');

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const draft = {
      category,
      urgency,
      title: title.trim(),
      description: description.trim(),
      context: fromRequestChange
        ? {
            source: 'page-editor',
            field: requestField,
            page: params.get('page'),
            section: params.get('section'),
            capability: requestCap,
          }
        : null,
    };
    // Stub: real ticket creation wires up with the backend pass.
    console.log('[stub] ticket submitted', draft);
    router.push('/tickets');
  };

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Home', 'Tickets']} current="New" />
        }
      />
      <div className="px-10 py-10">
        <div className="mx-auto flex max-w-[720px] flex-col gap-[18px]">
          <TicketsHero
            tag="New ticket · Webnua queue"
            title={
              <>
                Submit a <em>ticket</em>.
              </>
            }
            subtitle={
              <>
                Anything you want Webnua to handle — website changes, campaign
                tweaks, billing questions. <strong>Tickets are tracked
                end-to-end</strong>, so nothing slips. Typical reply: under 4
                hours on business days.
              </>
            }
          />

          {fromRequestChange ? (
            <div className="rounded-xl border border-rust/30 bg-rust-soft/60 px-5 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                {'// From the page editor'}
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-soft">
                You&apos;re requesting a change Webnua will make for you
                {requestCap ? (
                  <>
                    {' '}
                    — your access doesn&apos;t include{' '}
                    <strong className="font-semibold text-ink">
                      {CAPABILITY_LABEL[requestCap]}
                    </strong>
                  </>
                ) : null}
                . Describe what you&apos;d like below.
              </p>
              {requestField ? (
                <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  Field · <span className="text-ink-soft">{requestField}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-rule bg-card p-7">
            <BuilderField label="Category">
              <ChipSelector
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={setCategory}
              />
            </BuilderField>

            <BuilderField
              label="How soon do you need this?"
              helper="No pressure — Webnua confirms the timeline either way."
            >
              <ChipSelector
                options={URGENCY_OPTIONS}
                value={urgency}
                onChange={setUrgency}
              />
            </BuilderField>

            <BuilderField
              label={
                <>
                  Ticket title <span className="text-rust">*</span>
                </>
              }
              helper="A short summary — this is what Webnua sees in the inbox first."
            >
              <BuilderInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New 'Areas we serve' page with a suburb list"
                maxLength={140}
              />
            </BuilderField>

            <BuilderField
              label={
                <>
                  Describe what you&apos;d like <span className="text-rust">*</span>
                </>
              }
              hint={`${description.length} / ${DESCRIPTION_MAX}`}
              helper="Don't worry about being technical — Webnua figures out the details."
            >
              <BuilderTextarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, DESCRIPTION_MAX))
                }
                rows={6}
                placeholder="What would you like changed, added, or fixed?"
              />
            </BuilderField>

            <div className="mt-5 grid grid-cols-3 gap-2.5 rounded-xl bg-paper-2 px-5 py-4">
              {[
                'Webnua sees it',
                'You get a plan + timeline',
                'We build it',
              ].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-bold text-paper">
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-[1.35] text-ink-soft">
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button variant="secondary" asChild>
                <Link href="/tickets">Cancel</Link>
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                Submit ticket →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
