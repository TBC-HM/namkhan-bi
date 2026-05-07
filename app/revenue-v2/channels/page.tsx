// app/revenue-v2/channels/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ChannelRow {
  channel_name: string;
  room_nights: number | null;
  revenue_usd: number | null;
  adr_usd: number | null;
  commission_pct: number | null;
  net_revenue_usd: number | null;
  revenue_share_pct: number | null;
  cancellation_rate_pct: number | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('mv_channel_economics')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(50);

  const rows: ChannelRow[] = data ?? [];

  // Aggregate KPI totals
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalNetRevenue = rows.reduce((s, r) => s + (r.net_revenue_usd ?? 0), 0);
  const blendedADR = totalNights > 0 ? totalRevenue / totalNights : null;
  const commissionLoad =
    totalRevenue > 0
      ? ((totalRevenue - totalNetRevenue) / totalRevenue) * 100
      : null;

  const fmt = (n: number | null, prefix = '') =>
    n != null ? `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
  const fmtPct = (n: number | null) => (n != null ? `${n.toFixed(1)}%` : '—');

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Channels" title="Channel Economics" />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-4 py-2">
          Data unavailable: {error.message}
        </p>
      )}

      {/* KPI Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox label="Total Revenue" value={fmt(totalRevenue, '$')} />
        <KpiBox label="Net Revenue" value={fmt(totalNetRevenue, '$')} />
        <KpiBox label="Blended ADR" value={fmt(blendedADR, '$')} />
        <KpiBox label="Commission Load" value={fmtPct(commissionLoad)} />
      </div>

      {/* Channel Mix Table */}
      <DataTable
        columns={[
          { key: 'channel_name', header: 'Channel' },
          {
            key: 'room_nights',
            header: 'Room Nights',
            render: (v: unknown) => fmt(v as number | null),
          },
          {
            key: 'revenue_usd',
            header: 'Revenue (USD)',
            render: (v: unknown) => fmt(v as number | null, '$'),
          },
          {
            key: 'adr_usd',
            header: 'ADR',
            render: (v: unknown) => fmt(v as number | null, '$'),
          },
          {
            key: 'commission_pct',
            header: 'Commission',
            render: (v: unknown) => fmtPct(v as number | null),
          },
          {
            key: 'net_revenue_usd',
            header: 'Net Revenue',
            render: (v: unknown) => fmt(v as number | null, '$'),
          },
          {
            key: 'revenue_share_pct',
            header: 'Mix %',
            render: (v: unknown) => fmtPct(v as number | null),
          },
          {
            key: 'cancellation_rate_pct',
            header: 'Cancel Rate',
            render: (v: unknown) => fmtPct(v as number | null),
          },
        ]}
        rows={rows}
      />

      {rows.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No channel data available — mv_channel_economics may need a refresh.
        </p>
      )}
    </main>
  );
}
