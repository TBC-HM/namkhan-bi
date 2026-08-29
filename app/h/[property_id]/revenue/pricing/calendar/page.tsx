// app/h/[property_id]/revenue/pricing/calendar/page.tsx
// Canonical property-scoped room booking calendar (Cloudbeds-style grid).
// Each property gets its own room inventory and booking data via the API route.

import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import RoomCalendarSurface from '@/app/revenue/pricing/calendar/_components/RoomCalendarSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRoomCalendarPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();

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
        <RoomCalendarSurface propertyId={propertyId} />
      </Panel>
    </Page>
  );
}
