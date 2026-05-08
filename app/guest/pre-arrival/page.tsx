// app/guest/pre-arrival/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ArrivalRow {
  reservation_id?: string;
  guest_name?: string;
  arrival_date?: string;
  departure_date?: string;
  room_type?: string;
  room_number?: string | number;
  nights?: number;
  adults?: number;
  children?: number;
  status?: string;
  channel?: string;
  nationality?: string;
  special_requests?: string;
  balance_due?: number | null;
  checked_in?: boolean;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_arrivals_next7')
    .select('*')
    .order('arrival_date', { ascending: true })
    .limit(100);

  // eslint-disable-next-line no-console
  if (error) console.error('[pre-arrival] view error:', error.message);

  const rows: ArrivalRow[] = data ?? [];

  // KPI aggregates
  const totalArrivals = rows.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const arrivingToday = rows.filter((r) => r.arrival_date === todayStr).length;
  const totalGuests = rows.reduce((sum, r) => sum + (r.adults ?? 1) + (r.children ?? 0), 0);
  const balanceDueCount = rows.filter((r) => (r.balance_due ?? 0) > 0).length;

  const columns = [
    { key: 'arrival_date', header: 'Arrival' },
    { key: 'departure_date', header: 'Departure' },
    { key: 'guest_name', header: 'Guest' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'room_number', header: 'Room' },
    { key: 'nights', header: 'Nights' },
    { key: 'adults', header: 'Adults' },
    { key: 'children', header: 'Children' },
    { key: 'channel', header: 'Channel' },
    { key: 'nationality', header: 'Nationality' },
    { key: 'status', header: 'Status' },
    { key: 'balance_due', header: 'Balance Due' },
    { key: 'special_requests', header: 'Special Requests' },
  ];

  const tableRows = rows.map((r) => ({
    ...r,
    arrival_date: r.arrival_date ?? '—',
    departure_date: r.departure_date ?? '—',
    guest_name: r.guest_name ?? '—',
    room_type: r.room_type ?? '—',
    room_number: r.room_number ?? '—',
    nights: r.nights ?? '—',
    adults: r.adults ?? '—',
    children: r.children ?? '—',
    channel: r.channel ?? '—',
    nationality: r.nationality ?? '—',
    status: r.status ?? '—',
    balance_due:
      r.balance_due != null
        ? r.balance_due < 0
          ? `−$${Math.abs(r.balance_due).toFixed(2)}`
          : `$${r.balance_due.toFixed(2)}`
        : '—',
    special_requests: r.special_requests ?? '—',
  }));

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Guest" tab="Pre-Arrival" title="Pre-Arrival — Next 7 Days" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox label="Arrivals (7d)" value={String(totalArrivals)} />
        <KpiBox label="Arriving Today" value={String(arrivingToday)} />
        <KpiBox label="Total Guests" value={String(totalGuests)} />
        <KpiBox label="Balance Due" value={String(balanceDueCount)} unit="reservations" />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
