// app/revenue-v2/channels/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ChannelRow {
  channel_name?: string;
  channel_code?: string;
  room_nights?: number;
  revenue_usd?: number;
  revenue_lak?: number;
  adr_usd?: number;
  commission_pct?: number;
  net_revenue_usd?: number;
  contribution_pct?: number;
  bookings?: number;
  cancellations?: number;
  cancellation_rate?: number;
  period_label?: string;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('mv_channel_economics')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(50);

  const rows: ChannelRow[] = data ?? [];

  // Aggregate KPIs
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalNet = rows.reduce((s, r) => s + (r.net_revenue_usd ?? 0), 0);
  const totalBookings = rows.reduce((s, r) => s + (r.bookings ?? 0), 0);

  const avgAdr =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.adr_usd ?? 0), 0) / rows.filter((r) => r.adr_usd != null).length
      : null;

  const fmt = (n: number | null | undefined, prefix = '$') =>
    n == null ? '—' : `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const fmtPct = (n: number | null | undefined) =>
    n == null ? '—' : `${(n * 100).toFixed(1)}%`;

  const columns = [
    { key: 'channel_name', header: 'Channel' },
    { key: 'room_nights', header: 'Room Nights' },
    { key: 'bookings', header: 'Bookings' },
    { key: 'adr_usd', header: 'ADR (USD)' },
    { key: 'revenue_usd', header: 'Revenue (USD)' },
    { key: 'commission_pct', header: 'Commission' },
    { key: 'net_revenue_usd', header: 'Net Revenue' },
    { key: 'contribution_pct', header: 'Contribution' },
    { key: 'cancellation_rate', header: 'Cancel Rate' },
  ];

  const tableRows = rows.map((r) => ({
    channel_name: r.channel_name ?? r.channel_code ?? '—',
    room_nights: r.room_nights ?? '—',
    bookings: r.bookings ?? '—',
    adr_usd: r.adr_usd != null ? `$${r.adr_usd.toFixed(0)}` : '—',
    revenue_usd: r.revenue_usd != null ? `$${r.revenue_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
    commission_pct: r.commission_pct != null ? fmtPct(r.commission_pct) : '—',
    net_revenue_usd: r.net_revenue_usd != null ? `$${r.net_revenue_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
    contribution_pct: r.contribution_pct != null ? fmtPct(r.contribution_pct) : '—',
    cancellation_rate: r.cancellation_rate != null ? fmtPct(r.cancellation_rate) : '—',
  }));

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Channels" title="Channel Economics" />

      {rows.length === 0 && (
        <p style={{ color: '#888', marginBottom: 16 }}>
          No data yet — mv_channel_economics is empty or still building.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Revenue" value={fmt(totalRevenue)} />
        <KpiBox label="Net Revenue" value={fmt(totalNet)} />
        <KpiBox label="Avg ADR" value={fmt(avgAdr)} />
        <KpiBox label="Total Room Nights" value={totalNights > 0 ? totalNights.toLocaleString() : '—'} />
        <KpiBox label="Total Bookings" value={totalBookings > 0 ? totalBookings.toLocaleString() : '—'} />
        <KpiBox label="Channels" value={rows.length > 0 ? String(rows.length) : '—'} />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
