'use client';

import { useState } from 'react';

import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarMonthGrid } from '@/components/shared/calendar/CalendarMonthGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useAdminCalendar } from '@/lib/bookings/queries';
import { shiftAnchor, todayIso } from '@/lib/calendar/anchor';
import { adminCalendar } from '@/lib/calendar/admin-calendar';
import type { CalendarView } from '@/lib/calendar/types';
import { normalizeError } from '@/lib/errors';

/**
 * Operator agency-mode calendar — cross-client week / month grid.
 *
 * The sidebar `AdminClientPicker` is canonical for narrowing scope; the
 * in-page client multi-select was dropped (Phase 9b · Session 1). When an
 * operator drills into a client, the `/calendar` dispatcher hands off to
 * `_sub-account-content.tsx` instead.
 */
function AdminCalendarContent() {
  const { hero } = adminCalendar;
  const [view, setView] = useState<CalendarView>('week');
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const { data, error } = useAdminCalendar(view, anchorIso);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Calendar" />
        }
      />
      <div className="flex flex-col gap-3.5 px-4 py-6 md:px-10 md:py-10">
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
            <div className="flex flex-wrap items-center justify-end gap-3">
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
              <CalendarGrid week={data.week} />
            ) : (
              <CalendarMonthGrid
                month={data.month}
                onSelectDay={(iso) => {
                  setView('day');
                  setAnchorIso(iso);
                }}
              />
            )}
            <CalendarTodayPanel panel={data.today} />
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
