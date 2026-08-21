// app/h/[property_id]/revenue/reservations/page.tsx
// PBS 2026-08-21 · Reservations subtab under Revenue > Demand & Pace.
// Renders the "Bookings & cancellations · feed" container (BookingActivity
// server component · reads public.fn_pulse_recent_activity for up to 200
// unified booking + cancellation events, sortable columns).
//
// v2 fix: pass REVENUE_SUBPAGES as the TOP strip so the page shows
// Briefing / Overview / Demand & Pace / Performance / Market & Control /
// Rate Desk / Forecast — and the Demand sub-strip
// (Demand / Pace / Pickup / Reservations / Cancellations) auto-renders
// via lib/nav-subgroups (members includes /revenue/reservations).

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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

  // Same pattern as bare /revenue/demand: build top strip from REVENUE_SUBPAGES.
  // Reservations lives under the "Demand & Pace" parent → mark that active.
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/demand'),
  }));

  return (
    <DashboardPage
      title="Revenue · Reservations"
      subtitle={`property_id=${pid} · bookings + cancellations feed · last 200 events`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <BookingActivity propertyId={pid} searchParams={sp} />
      </div>
    </DashboardPage>
  );
}
