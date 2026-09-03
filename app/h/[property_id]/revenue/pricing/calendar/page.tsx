// app/h/[property_id]/revenue/pricing/calendar/page.tsx
// Property-scoped room booking calendar. Data fetched server-side to avoid
// the client-auth + PostgREST row-cap bugs that caused 0-data.

import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import RoomCalendarSurface from '@/app/revenue/pricing/calendar/_components/RoomCalendarSurface';
import { fetchRoomCalendar } from '@/app/revenue/pricing/calendar/_lib/roomCalendarData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
  searchParams?: { otb_from?: string };
}

export default async function PropertyRoomCalendarPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();

  const rawFrom = searchParams?.otb_from;
  const defaultFrom = (() => {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - 3); return d;
  })();
  const fromDate = rawFrom ? new Date(rawFrom + 'T00:00:00Z') : defaultFrom;
  const fromISO  = fromDate.toISOString().slice(0, 10);
  const toDate   = new Date(fromDate); toDate.setUTCDate(toDate.getUTCDate() + 27);
  const toISO    = toDate.toISOString().slice(0, 10);

  const base     = `/h/${propertyId}/revenue/pricing/calendar`;
  const prev28   = new Date(fromDate); prev28.setUTCDate(prev28.getUTCDate() - 28);
  const next28   = new Date(fromDate); next28.setUTCDate(next28.getUTCDate() + 28);
  const prevHref = `${base}?otb_from=${prev28.toISOString().slice(0, 10)}`;
  const nextHref = `${base}?otb_from=${next28.toISOString().slice(0, 10)}`;
  const todayHref= base;

  const { roomTypes, bookings, dailyKpi } = await fetchRoomCalendar(propertyId, fromISO, toISO);

  return (
    <Page
      eyebrow="Revenue · Pricing"
      title={<>Room <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>calendar</em></>}
      subPages={REVENUE_SUBPAGES}
    >
      <Panel
        title="Booking calendar"
        eyebrow="28-day rolling window · room-level · live from Cloudbeds"
      >
        <RoomCalendarSurface
          roomTypes={roomTypes}
          bookings={bookings}
          from={fromISO}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          dailyKpi={dailyKpi}
        />
      </Panel>
    </Page>
  );
}
