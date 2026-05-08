// app/revenue/channels/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Attempt to load channel breakdown from reporting schema
  const { data: channelRows } = await supabase
    .from('v_channel_revenue')
    .select('*')
    .limit(100);

  // Fallback: pull from reservations if view unavailable
  const { data: fallbackRows } = !channelRows?.length
    ? await supabase
        .from('reservations')
        .select('channel, revenue, room_nights, arrival_date')
        .order('arrival_date', { ascending: false })
        .limit(100)
    : { data: null };

  const rows: Record<string, unknown>[] = channelRows?.length
    ? channelRows
    : (fallbackRows ?? []);

  // Aggregate KPIs from rows
  const totalRevenue = rows.reduce(
    (sum, r) => sum + (Number(r.revenue) || 0),
    0
  );
  const totalRoomNights = rows.reduce(
    (sum, r) => sum + (Number(r.room_nights) || 0),
    0
  );
  const uniqueChannels = new Set(rows.map((r) => r.channel)).size;

  const fmtUSD = (v: number) =>
    v > 0 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  return (
    <main style={{ padding: 24 }}>
      <PageHeader pillar="Revenue" tab="Channels" title="Channel Mix" />

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Revenue" value={fmtUSD(totalRevenue)} />
        <KpiBox label="Room Nights" value={totalRoomNights > 0 ? totalRoomNights.toLocaleString() : '—'} />
        <KpiBox label="Active Channels" value={uniqueChannels > 0 ? String(uniqueChannels) : '—'} />
      </div>

      {/* Channel breakdown table */}
      <DataTable
        columns={[
          { key: 'channel', header: 'Channel' },
          { key: 'revenue', header: 'Revenue (USD)' },
          { key: 'room_nights', header: 'Room Nights' },
          { key: 'adr', header: 'ADR' },
          { key: 'share_pct', header: 'Share %' },
        ]}
        rows={rows.map((r) => ({
          channel: r.channel ?? '—',
          revenue: r.revenue != null ? fmtUSD(Number(r.revenue)) : '—',
          room_nights: r.room_nights ?? '—',
          adr: r.adr != null ? fmtUSD(Number(r.adr)) : '—',
          share_pct:
            r.share_pct != null
              ? `${Number(r.share_pct).toFixed(1)}%`
              : totalRevenue > 0 && r.revenue != null
              ? `${((Number(r.revenue) / totalRevenue) * 100).toFixed(1)}%`
              : '—',
        }))}
      />

      {rows.length === 0 && (
        <p style={{ color: '#888', marginTop: 16, fontSize: 14 }}>
          No channel data available — confirm <code>v_channel_revenue</code> or{' '}
          <code>reservations</code> table is populated and accessible.
        </p>
      )}
    </main>
  );
}
