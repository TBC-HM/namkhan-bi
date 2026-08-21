// app/h/[property_id]/revenue/reservations/page.tsx
// PBS 2026-08-21 · Reservations subtab under Revenue > Demand & Pace.
// Renders the same "Bookings & cancellations · feed" container used on the
// Revenue HoD page (BookingActivity server component · reads
// public.fn_pulse_recent_activity for up to 200 unified booking + cancellation
// events, sortable columns).

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const DEMAND_TABS: DashboardTab[] = [
  { key: 'demand',        label: 'Demand',        href: '/h/260955/revenue/demand'        },
  { key: 'pace',          label: 'Pace',          href: '/h/260955/revenue/pace'          },
  { key: 'pickup',        label: 'Pickup',        href: '/h/260955/revenue/pickup'        },
  { key: 'reservations',  label: 'Reservations',  href: '/h/260955/revenue/reservations', active: true },
  { key: 'cancellations', label: 'Cancellations', href: '/h/260955/revenue/cancellations' },
];

function scopeTabs(tabs: DashboardTab[], pid: number): DashboardTab[] {
  if (pid === 260955) return tabs;
  return tabs.map(t => ({ ...t, href: t.href?.replace('/h/260955/', `/h/${pid}/`) }));
}

export default async function TenantRevenueReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property_id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  return (
    <DashboardPage
      title="Revenue · Reservations"
      subtitle={`property_id=${pid} · bookings + cancellations feed · last 200 events`}
      tabs={scopeTabs(DEMAND_TABS, pid)}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <BookingActivity propertyId={pid} searchParams={sp} />
      </div>
    </DashboardPage>
  );
}
