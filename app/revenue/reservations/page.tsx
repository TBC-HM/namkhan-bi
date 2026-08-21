// app/revenue/reservations/page.tsx
// PBS 2026-08-21 · Reservations subtab under Revenue > Demand & Pace.
// Bare Namkhan URL redirects to property-scoped tenant page (URL LAW).
import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';

export default function RevenueReservationsRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/revenue/reservations`);
}
