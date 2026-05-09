// app/operations/events/page.tsx
// Operations · Events — month-view calendar of marketing.calendar_events.
//
// Models the screenshot at "Namkhan Bi repair.rtfd/Screenshot 2026-05-09 at
// 12.24.10.png": filter bar (event types · categories · holiday countries)
// + month grid 7×6 (Mon-first) + Add-event CTA. Today gets a brass tint.
//
// Source: marketing.calendar_events JOIN marketing.calendar_event_types.
// 82 rows in DB at ship time spanning 2026-01-01 → 2028-12-30.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { getEvents, getEventTypes, uniqueCountries } from './_data';
import EventsCalendar from './_components/EventsCalendar';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isValidYm(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}

export default async function EventsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const month = isValidYm(sp.month) ? sp.month : currentYm();

  // Pull a generous window — 12 months either side of the visible month so
  // the user can flip months without re-fetching. Cheap (≤ 200 rows total).
  const [y, m] = month.split('-').map(Number);
  const rangeStart = `${y - 1}-${String(m).padStart(2, '0')}-01`;
  const rangeEndDt = new Date(y + 1, m, 0); // last day of (y+1, m)
  const rangeEnd   = `${rangeEndDt.getFullYear()}-${String(rangeEndDt.getMonth() + 1).padStart(2, '0')}-${String(rangeEndDt.getDate()).padStart(2, '0')}`;

  const [events, eventTypes] = await Promise.all([
    getEvents(rangeStart, rangeEnd),
    getEventTypes(),
  ]);
  const countries = uniqueCountries(events);

  const totalInMonth = events.filter(e => {
    // overlaps the visible month
    const monthStart = `${month}-01`;
    const monthEndDt = new Date(y, m, 0);
    const monthEnd   = `${y}-${String(m).padStart(2,'0')}-${String(monthEndDt.getDate()).padStart(2,'0')}`;
    return e.date_start <= monthEnd && e.date_end >= monthStart;
  }).length;

  return (
    <Page
      eyebrow={`Operations · Events · ${totalInMonth} this month`}
      title={<>Events <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>schedule</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel
        title="Calendar"
        eyebrow={`source · marketing.calendar_events · ${events.length} rows in window`}
      >
        <EventsCalendar
          initialEvents={events}
          eventTypes={eventTypes}
          countries={countries}
          initialMonth={month}
        />
      </Panel>
    </Page>
  );
}
