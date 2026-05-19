'use client';

import { useMemo, useState } from 'react';

import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarMonthGrid } from '@/components/shared/calendar/CalendarMonthGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { useAdminCalendar } from '@/lib/bookings/queries';
import { shiftAnchor, todayIso } from '@/lib/calendar/anchor';
import { adminCalendar } from '@/lib/calendar/admin-calendar';
import type { CalendarView } from '@/lib/calendar/types';
import { normalizeError } from '@/lib/errors';
import { useIsAgencyMode, useWorkspace } from '@/lib/workspace/workspace-stub';

function AdminCalendarContent() {
  const { hero } = adminCalendar;
  const [view, setView] = useState<CalendarView>('week');
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const { data, error } = useAdminCalendar(view, anchorIso);

  // Workspace context: agency mode → cross-client grid + the multi-select
  // filter; sub-account mode → the calendar scopes to the picked client.
  const isAgency = useIsAgencyMode();
  const { activeClientId } = useWorkspace();
  const effectiveClients = useMemo(
    () => (isAgency || !activeClientId ? selectedClients : [activeClientId]),
    [isAgency, activeClientId, selectedClients],
  );

  const inFilter = (slug?: string) =>
    effectiveClients.length === 0 ||
    (slug != null && effectiveClients.includes(slug));

  // Per-client booking counts across the current view — shown in the dropdown.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (data?.mode === 'grid') {
      for (const day of data.week.days) {
        for (const b of day.bookings) {
          if (b.clientSlug) {
            counts[b.clientSlug] = (counts[b.clientSlug] ?? 0) + 1;
          }
        }
      }
    } else if (data?.mode === 'month') {
      for (const wk of data.month.weeks) {
        for (const day of wk) {
          for (const b of day.bookings) {
            counts[b.clientSlug] = (counts[b.clientSlug] ?? 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [data]);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Calendar" />
        }
      />
      <div className="flex flex-col gap-3.5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />
        {!data ? (
          <CalendarNotice>
            {error ? `// ${normalizeError(error).message}` : '// Loading calendar…'}
          </CalendarNotice>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isAgency ? (
                <ClientMultiSelect
                  label="// CLIENT"
                  value={selectedClients}
                  onChange={setSelectedClients}
                  counts={clientCounts}
                />
              ) : (
                <WorkspaceContextBanner />
              )}
              <AddBookingButton />
            </div>
            <CalendarToolbar
              periodLabel={
                data.mode === 'grid'
                  ? data.week.periodLabel
                  : data.month.periodLabel
              }
              view={view}
              onViewChange={setView}
              onPrev={() => setAnchorIso((iso) => shiftAnchor(iso, view, -1))}
              onNext={() => setAnchorIso((iso) => shiftAnchor(iso, view, 1))}
              onToday={() => setAnchorIso(todayIso())}
            />
            <CalendarLegend items={data.legend} meta={data.legendMeta} />
            {data.mode === 'grid' ? (
              <CalendarGrid
                week={{
                  ...data.week,
                  days: data.week.days.map((d) => ({
                    ...d,
                    bookings: d.bookings.filter((b) => inFilter(b.clientSlug)),
                  })),
                }}
              />
            ) : (
              <CalendarMonthGrid
                month={{
                  ...data.month,
                  weeks: data.month.weeks.map((wk) =>
                    wk.map((d) => ({
                      ...d,
                      bookings: d.bookings.filter((b) =>
                        inFilter(b.clientSlug),
                      ),
                    })),
                  ),
                }}
                onSelectDay={(iso) => {
                  setView('day');
                  setAnchorIso(iso);
                }}
              />
            )}
            <CalendarTodayPanel
              panel={{
                ...data.today,
                jobs: data.today.jobs.filter((j) => inFilter(j.clientSlug)),
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

function CalendarNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-ink/8 bg-card px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { AdminCalendarContent };
