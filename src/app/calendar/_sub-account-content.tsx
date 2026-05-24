'use client';

import { useMemo, useState } from 'react';

import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarMonthGrid } from '@/components/shared/calendar/CalendarMonthGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useAdminCalendar } from '@/lib/bookings/queries';
import { shiftAnchor, todayIso } from '@/lib/calendar/anchor';
import type { CalendarView } from '@/lib/calendar/types';
import { normalizeError } from '@/lib/errors';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

/**
 * Operator-in-sub-account calendar — drilled into one client.
 *
 * Same single-business shape the client sees (`_client-content.tsx`):
 * just the grid + toolbar, no per-client legend or today-panel cross-
 * client framing. Fed by the operator's accessible-bookings query and
 * filtered to the active client. Operator capabilities (add booking,
 * etc.) apply via role, not row shape.
 */
function SubAccountCalendarContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const [view, setView] = useState<CalendarView>('week');
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const { data, error } = useAdminCalendar(view, anchorIso);

  const inFilter = (slug?: string) =>
    slug != null && slug === activeClientId;

  // Narrow the bookings + today-panel jobs to the active client. The
  // CalendarLegend + colour-keyed cross-client framing isn't rendered —
  // single business doesn't need a per-client colour legend.
  const filtered = useMemo(() => {
    if (!data) return null;
    if (data.mode === 'grid') {
      return {
        ...data,
        week: {
          ...data.week,
          days: data.week.days.map((d) => ({
            ...d,
            bookings: d.bookings.filter((b) => inFilter(b.clientSlug)),
          })),
        },
      };
    }
    return {
      ...data,
      month: {
        ...data.month,
        weeks: data.month.weeks.map((wk) =>
          wk.map((d) => ({
            ...d,
            bookings: d.bookings.filter((b) => inFilter(b.clientSlug)),
          })),
        ),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeClientId]);

  const clientName = activeClient?.name ?? 'this client';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={[clientName]} current="Calendar" />
        }
      />
      <div className="flex flex-col gap-3.5 px-4 py-6 md:px-10 md:py-10">
        <PageHeader
          eyebrow={`// ${clientName.toUpperCase()} · CALENDAR`}
          title={
            <>
              This <em>week</em>.
            </>
          }
          subtitle={
            <>
              Every booking on <strong>{clientName}&rsquo;s</strong> calendar.
            </>
          }
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" className="h-9" asChild>
            <a href="/recurring/new">+ Recurring</a>
          </Button>
          <AddBookingButton />
        </div>
        {!filtered ? (
          <CalendarNotice>
            {error
              ? `// ${normalizeError(error).message}`
              : '// Loading calendar…'}
          </CalendarNotice>
        ) : (
          <>
            <CalendarToolbar
              periodLabel={
                filtered.mode === 'grid'
                  ? filtered.week.periodLabel
                  : filtered.month.periodLabel
              }
              view={view}
              onViewChange={setView}
              onPrev={() => setAnchorIso((iso) => shiftAnchor(iso, view, -1))}
              onNext={() => setAnchorIso((iso) => shiftAnchor(iso, view, 1))}
              onToday={() => setAnchorIso(todayIso())}
            />
            {filtered.mode === 'grid' ? (
              <CalendarGrid week={filtered.week} />
            ) : (
              <CalendarMonthGrid
                month={filtered.month}
                onSelectDay={(iso) => {
                  setView('day');
                  setAnchorIso(iso);
                }}
              />
            )}
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

export { SubAccountCalendarContent };
