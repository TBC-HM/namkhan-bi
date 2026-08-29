// app/revenue/pricing/calendar/page.tsx
// Room-level booking calendar — Cloudbeds-style grid.
// The canonical property-scoped URL is /h/[property_id]/revenue/pricing/calendar.
// This legacy path renders the same component when ?pid= is provided (set by
// the /h/ wrapper's server component) or falls through to an empty-property state.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { REVENUE_SUBPAGES } from '../../_subpages';
import RoomCalendarSurface from './_components/RoomCalendarSurface';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { pid?: string };
}

export default function RoomCalendarPage({ searchParams }: Props) {
  const propertyId = Number(searchParams?.pid ?? '0') || 0;

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
