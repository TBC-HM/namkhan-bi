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
  adults?: number;
  children?: number;
  nights?: number;
  status?: string;
  channel?: string;
  special_requests?: string;
  vip_flag?: boolean;
  nationality?: string;
  balance_due?: number | string;
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

  const rows: ArrivalRow[] = data ?? [];

  // KPI aggregates derived client-side from the view rows
  const totalArrivals = rows.length;
  const vipCount = rows.filter((r) => r.vip_flag).length;
  const totalGuests = rows.reduce(
    (sum, r) => sum + (r.adults ?? 1) + (r.children ?? 0),
    0
  );
  const withSpecialRequests = rows.filter(
    (r) => r.special_requests && r.special_requests.trim() !== ''
  ).length;

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Guest" tab="Pre-Arrival" title="Pre-Arrival — Next 7 Days" />

      {error && (
        <p style={{ color: 'red', marginBottom: 16 }}>
          ⚠ Data load error: {error.message}
        </p>
      )}

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Arrivals (7d)" value={totalArrivals} />
        <KpiBox label="Total Guests" value={totalGuests} />
        <KpiBox label="VIP Arrivals" value={vipCount} />
        <KpiBox label="Special Requests" value={withSpecialRequests} />
      </div>

      {/* Arrivals Table */}
      <DataTable
        columns={[
          { key: 'arrival_date',    header: 'Arrival' },
          { key: 'departure_date',  header: 'Departure' },
          { key: 'guest_name',      header: 'Guest' },
          { key: 'room_type',       header: 'Room Type' },
          { key: 'room_number',     header: 'Room #' },
          { key: 'adults',          header: 'Adults' },
          { key: 'children',        header: 'Children' },
          { key: 'nights',          header: 'Nights' },
          { key: 'channel',         header: 'Channel' },
          { key: 'nationality',     header: 'Nationality' },
          { key: 'status',          header: 'Status' },
          { key: 'special_requests', header: 'Special Requests' },
          { key: 'balance_due',     header: 'Balance Due' },
        ]}
        rows={rows.map((r) => ({
          ...r,
          guest_name:       r.guest_name       ?? '—',
          arrival_date:     r.arrival_date      ?? '—',
          departure_date:   r.departure_date    ?? '—',
          room_type:        r.room_type         ?? '—',
          room_number:      r.room_number       ?? '—',
          adults:           r.adults            ?? '—',
          children:         r.children          ?? '—',
          nights:           r.nights            ?? '—',
          status:           r.status            ?? '—',
          channel:          r.channel           ?? '—',
          nationality:      r.nationality       ?? '—',
          special_requests: r.special_requests  ?? '—',
          balance_due:
            r.balance_due != null
              ? `$${Number(r.balance_due).toFixed(2)}`
              : '—',
        }))}
      />
    </main>
  );
}
