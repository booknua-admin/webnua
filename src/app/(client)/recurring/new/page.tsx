'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChipSelector } from '@/components/shared/ChipSelector';
import { ConflictModal } from '@/components/shared/bookings/ConflictModal';
import { CustomerPicker } from '@/components/shared/bookings/CustomerPicker';
import { FrequencyGrid } from '@/components/shared/bookings/FrequencyGrid';
import { RecurringPreviewList } from '@/components/shared/bookings/RecurringPreviewList';
import { RecurringSummaryBar } from '@/components/shared/bookings/RecurringSummaryBar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Input } from '@/components/ui/input';
import { useUser } from '@/lib/auth/user-stub';
import {
  checkRecurringConflicts,
  computeOccurrences,
  useCreateRecurringSchedule,
} from '@/lib/bookings/queries';
import type { RecurringConflict, RecurringOccurrence } from '@/lib/bookings/queries';
import { recurringSetup } from '@/lib/bookings/recurring-setup';
import type {
  RecurringDayOption,
  RecurringFrequencyOption,
} from '@/lib/bookings/recurring-setup';
import type { ConflictModalData } from '@/lib/bookings/conflict-modal';
import { formatDayLabel, formatShortDate, formatTimeRange } from '@/lib/bookings/time';
import { useClientId } from '@/lib/clients/queries';
import type { SelectedCustomer } from '@/lib/customers/queries';
import { normalizeError } from '@/lib/errors';

const SERVICE_OPTIONS = [
  { id: 'standard', label: 'Standard' },
  { id: 'quick', label: 'Quick visit' },
  { id: 'quote', label: 'Quote required' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'one_off', label: 'One-off' },
  { id: 'custom', label: 'Custom' },
];

const DURATION_OPTIONS = [
  { id: '60', label: '1 hr' },
  { id: '90', label: '1.5 hr' },
  { id: '120', label: '2 hr' },
  { id: '180', label: '3 hr' },
];

const DAY_NUMBER: Record<RecurringDayOption['id'], number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DAY_PLURAL: Record<RecurringDayOption['id'], string> = {
  sun: 'Sundays',
  mon: 'Mondays',
  tue: 'Tuesdays',
  wed: 'Wednesdays',
  thu: 'Thursdays',
  fri: 'Fridays',
  sat: 'Saturdays',
};

const VISITS_PER_YEAR: Record<RecurringFrequencyOption['id'], number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 13,
};

const PREVIEW_COUNT = 4;
const BOOKING_WINDOW = 10;

function ordinalVisit(index: number): string {
  if (index === 0) return 'first booking';
  const n = index + 1;
  const suffix =
    n % 10 === 1 && n !== 11
      ? 'st'
      : n % 10 === 2 && n !== 12
        ? 'nd'
        : n % 10 === 3 && n !== 13
          ? 'rd'
          : 'th';
  return `${n}${suffix} visit`;
}

export default function ClientRecurringNewPage() {
  const r = recurringSetup;
  const router = useRouter();
  const user = useUser();
  const { data: clientId } = useClientId(user?.clientId ?? null);
  const createRecurring = useCreateRecurringSchedule();

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequencyOption['id']>(
    r.defaultFrequencyId,
  );
  const [dayId, setDayId] = useState<RecurringDayOption['id']>(r.defaultDayId);
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState('120');
  const [service, setService] = useState('standard');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RecurringConflict[] | null>(null);

  const durationMinutes = Number(duration);
  const parsedPrice = price.trim() ? Number(price) : null;
  const priceValue =
    parsedPrice != null && Number.isFinite(parsedPrice) ? parsedPrice : null;

  const previewOccurrences = computeOccurrences({
    dayOfWeek: DAY_NUMBER[dayId],
    frequency,
    startTime,
    durationMinutes,
    count: PREVIEW_COUNT,
  });

  const previewRows = previewOccurrences.map((o, i) => ({
    date: formatShortDate(o.startsAt),
    time: formatTimeRange(o.startsAt, o.endsAt),
    visit: ordinalVisit(i),
    price: priceValue != null ? `$${priceValue}` : '—',
  }));

  const visitsPerYear = VISITS_PER_YEAR[frequency];
  const yearlyTotal =
    priceValue != null
      ? `$${(priceValue * visitsPerYear).toLocaleString()} / year recurring revenue`
      : 'Add a price to project yearly revenue';

  const canSave =
    clientId != null &&
    customer != null &&
    title.trim().length > 0 &&
    !checking &&
    !createRecurring.isPending;

  function commit(occurrences: RecurringOccurrence[]) {
    if (!clientId || !customer) return;
    createRecurring.mutate(
      {
        clientId,
        customer,
        frequency,
        dayOfWeek: DAY_NUMBER[dayId],
        startTime,
        durationMinutes,
        serviceType: service,
        title: title.trim(),
        price: priceValue,
        occurrences,
      },
      { onSuccess: () => router.push('/calendar') },
    );
  }

  async function handleSave() {
    if (!clientId || !customer || !canSave) return;
    setCheckError(null);
    setChecking(true);
    try {
      const occurrences = computeOccurrences({
        dayOfWeek: DAY_NUMBER[dayId],
        frequency,
        startTime,
        durationMinutes,
        count: BOOKING_WINDOW,
      });
      const found = await checkRecurringConflicts({ clientId, occurrences });
      if (found.length === 0) {
        commit(occurrences);
      } else {
        setConflicts(found);
      }
    } catch (error) {
      setCheckError(normalizeError(error).message);
    } finally {
      setChecking(false);
    }
  }

  function handleConflictConfirm(optionId: string) {
    if (optionId === 'cancel') {
      setConflicts(null);
      return;
    }
    // skip — book every occurrence that did not clash.
    const occurrences = computeOccurrences({
      dayOfWeek: DAY_NUMBER[dayId],
      frequency,
      startTime,
      durationMinutes,
      count: BOOKING_WINDOW,
    });
    const clashIndexes = new Set((conflicts ?? []).map((c) => c.index));
    commit(occurrences.filter((_, i) => !clashIndexes.has(i)));
  }

  const conflictData = conflicts ? buildConflictData(conflicts) : null;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="New recurring" />
        }
      />
      <div className="px-10 py-10">
        <PageHeader
          eyebrow={r.hero.eyebrow}
          title={r.hero.title}
          subtitle={r.hero.subtitle}
        />

        <div className="mb-4.5 rounded-[12px] border border-rule bg-card px-8 py-7">
          <RecurringSection heading="Customer">
            {clientId == null ? (
              <p className="text-[13px] text-ink-quiet">
                Loading your account…
              </p>
            ) : (
              <CustomerPicker
                clientId={clientId}
                value={customer}
                onChange={setCustomer}
              />
            )}
          </RecurringSection>

          <RecurringSection heading="Frequency">
            <FrequencyGrid
              className="grid-cols-3"
              options={r.frequencies}
              defaultId={r.defaultFrequencyId}
              onChange={setFrequency}
            />
          </RecurringSection>

          <RecurringSection heading="Day of week">
            <ChipSelector
              options={r.days}
              value={dayId}
              onChange={setDayId}
              variant="mono"
            />
          </RecurringSection>

          <RecurringSection heading="Time">
            <div className="grid grid-cols-2 gap-3.5">
              <LabeledField label="Start">
                <Input
                  type="time"
                  className="bg-paper"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Duration">
                <ChipSelector
                  options={DURATION_OPTIONS}
                  value={duration}
                  onChange={setDuration}
                  variant="mono"
                />
              </LabeledField>
            </div>
          </RecurringSection>

          <RecurringSection heading="Job type + details">
            <div className="mb-3">
              <ChipSelector
                options={SERVICE_OPTIONS}
                value={service}
                onChange={setService}
                variant="pill"
                layout="wrap"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <LabeledField label="Job title">
                <Input
                  className="bg-paper"
                  placeholder="e.g. Fortnightly clean · 3-bed"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Price per visit">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="bg-paper"
                  placeholder="e.g. 180"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </LabeledField>
            </div>
          </RecurringSection>

          <RecurringSection
            heading={
              <>
                <strong>Next {PREVIEW_COUNT} bookings</strong> · preview
              </>
            }
          >
            <RecurringPreviewList
              heading={
                <>
                  Will be added to your calendar ·{' '}
                  <strong>customer auto-confirmed for each</strong>
                </>
              }
              rows={previewRows}
            />
          </RecurringSection>
        </div>

        {checkError ? (
          <p className="mb-3 text-center text-[13px] font-semibold text-warn">
            {checkError}
          </p>
        ) : createRecurring.error ? (
          <p className="mb-3 text-center text-[13px] font-semibold text-warn">
            {normalizeError(createRecurring.error).message}
          </p>
        ) : null}

        <RecurringSummaryBar
          summary={
            <strong>
              {frequencyName(r.frequencies, frequency)} · {DAY_PLURAL[dayId]} ·{' '}
              {startTime}
            </strong>
          }
          summaryDetail={`${visitsPerYear} visits per year`}
          totalLabel={yearlyTotal}
          ctaLabel={
            checking
              ? 'Checking conflicts…'
              : createRecurring.isPending
                ? 'Saving…'
                : 'Save + check conflicts →'
          }
          onCta={canSave ? handleSave : undefined}
          className="mb-4.5"
        />

        {conflictData ? (
          <ConflictModal
            open
            onOpenChange={(next) => {
              if (!next) setConflicts(null);
            }}
            data={conflictData}
            onConfirm={handleConflictConfirm}
            confirmPending={createRecurring.isPending}
          />
        ) : null}

        <p className="mx-auto max-w-[720px] text-center text-[13px] leading-[1.5] text-ink-quiet [&_strong]:text-ink">
          {r.note}
        </p>
      </div>
    </>
  );
}

function frequencyName(
  options: RecurringFrequencyOption[],
  id: RecurringFrequencyOption['id'],
): string {
  return options.find((o) => o.id === id)?.name ?? id;
}

function buildConflictData(conflicts: RecurringConflict[]): ConflictModalData {
  const n = conflicts.length;
  const first = conflicts[0]!;
  return {
    tag: `// SCHEDULING CONFLICT · ${n} OF ${BOOKING_WINDOW} VISITS`,
    title: (
      <>
        {n === 1 ? 'One visit' : `${n} visits`} <em>overlap</em>
      </>
    ),
    subtitle: (
      <>
        Your recurring booking clashes with{' '}
        {n === 1 ? 'an existing job' : 'existing jobs'} — the first is on{' '}
        <strong>{formatDayLabel(first.occurrence.startsAt)}</strong>.
      </>
    ),
    attempted: {
      tag: '// WANT TO BOOK',
      time: `${formatDayLabel(first.occurrence.startsAt)} · ${formatTimeRange(
        first.occurrence.startsAt,
        first.occurrence.endsAt,
      )}`,
      detail: 'New recurring visit',
    },
    existing: {
      tag: '// ALREADY BOOKED',
      time: `${formatDayLabel(first.against.startsAt)} · ${formatTimeRange(
        first.against.startsAt,
        first.against.endsAt,
      )}`,
      detail: `${first.against.title} · ${first.against.customer}`,
    },
    explainer: (
      <>
        <strong>
          {BOOKING_WINDOW - n} of {BOOKING_WINDOW} visits
        </strong>{' '}
        have no conflict and will be booked. Choose what to do with the{' '}
        {n === 1 ? 'one that overlaps' : `${n} that overlap`}:
      </>
    ),
    options: [
      {
        id: 'skip',
        num: '1',
        title: `Skip the ${n} conflicting visit${n === 1 ? '' : 's'}`,
        sub: 'Book every other visit now; the clashing slots are left out.',
        recommended: true,
      },
      {
        id: 'cancel',
        num: '2',
        title: "Don't set up recurring",
        sub: 'Nothing is booked. Adjust the day or time and try again.',
      },
    ],
    defaultOptionId: 'skip',
    saveLabel: `Save recurring (skip ${n}) →`,
  };
}

function RecurringSection({
  heading,
  children,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5.5 last:mb-0">
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet [&_strong]:text-ink">
        {'// '}
        {heading}
      </div>
      {children}
    </section>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </label>
      {children}
    </div>
  );
}
