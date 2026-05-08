// app/sales/bookings/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface BookingRow {
  booking_id?: string | number;
  reservation_date?: string;
  guest_name?: string;
  room_type?: string;
  channel?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  adr?: number | string;
  total_revenue?: number | string;
  currency?: string;
  status?: string;
  source?: string;
  [key: string]: unknown;
}

function fmt(val: unknown, prefix = ''): string {
  if (val === null || val === undefined || val === '') return '—';
  return `${prefix}${val}`;
}

function fmtNum(val: unknown, prefix = ''): string {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function BookingsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_bookings_recent')
    .select('*')
    .limit(100)
    .schema('sales' as never);

  const rows: BookingRow[] = (data as BookingRow[] | null) ?? [];

  // KPI aggregations
  const totalBookings = rows.length;

  const totalRevenue = rows.reduce((sum, r) => {
    const v = Number(r.total_revenue);
    return isNaN(v) ? sum : sum + v;
  }, 0);

  const avgAdr = rows.length > 0
    ? rows.reduce((sum, r) => {
        const v = Number(r.adr);
        return isNaN(v) ? sum : sum + v;
      }, 0) / rows.filter(r => !isNaN(Number(r.adr))).length
    : 0;

  const avgNights = rows.length > 0
    ? rows.reduce((sum, r) => {
        const v = Number(r.nights);
        return isNaN(v) ? sum : sum + v;
      }, 0) / rows.filter(r => !isNaN(Number(r.nights))).length
    : 0;

  const columns: { key: string; header: string }[] = [
    { key: 'booking_id',       header: 'Booking ID' },
    { key: 'reservation_date', header: 'Reserved' },
    { key: 'guest_name',       header: 'Guest' },
    { key: 'room_type',        header: 'Room Type' },
    { key: 'channel',          header: 'Channel' },
    { key: 'check_in',         header: 'Check-in' },
    { key: 'check_out',        header: 'Check-out' },
    { key: 'nights',           header: 'Nights' },
    { key: 'adr',              header: 'ADR' },
    { key: 'total_revenue',    header: 'Total Revenue' },
    { key: 'status',           header: 'Status' },
    { key: 'source',           header: 'Source' },
  ];

  // Normalise rows for DataTable display
  const displayRows = rows.map((r) => ({
    ...r,
    booking_id:       fmt(r.booking_id),
    reservation_date: fmt(r.reservation_date),
    guest_name:       fmt(r.guest_name),
    room_type:        fmt(r.room_type),
    channel:          fmt(r.channel),
    check_in:         fmt(r.check_in),
    check_out:        fmt(r.check_out),
    nights:           fmtNum(r.nights),
    adr:              fmtNum(r.adr, '$'),
    total_revenue:    fmtNum(r.total_revenue, '$'),
    status:           fmt(r.status),
    source:           fmt(r.source),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Sales" tab="Bookings" title="Bookings" />

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#b91c1c',
            fontSize: 14,
          }}
        >
          ⚠️ Could not load booking data — {error.message}
        </div>
      )}

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Total Bookings"
          value={totalBookings > 0 ? String(totalBookings) : '—'}
        />
        <KpiBox
          label="Total Revenue"
          value={totalRevenue > 0 ? fmtNum(totalRevenue, '$') : '—'}
        />
        <KpiBox
          label="Avg ADR"
          value={avgAdr > 0 ? fmtNum(avgAdr, '$') : '—'}
        />
        <KpiBox
          label="Avg Nights"
          value={avgNights > 0 ? avgNights.toFixed(1) : '—'}
        />
      </div>

      {/* Bookings Table */}
      <DataTable columns={columns} rows={displayRows} />
    </main>
  );
}
