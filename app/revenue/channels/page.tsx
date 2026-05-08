// app/revenue/channels/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChannelRow {
  channel_name: string;
  room_nights: number | null;
  revenue_usd: number | null;
  adr_usd: number | null;
  commission_usd: number | null;
  commission_pct: number | null;
  net_revenue_usd: number | null;
  net_adr_usd: number | null;
  contribution_pct: number | null;
  period_label: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = {
  usd: (v: number | null) =>
    v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  pct: (v: number | null) =>
    v == null ? '—' : `${v.toFixed(1)}%`,
  int: (v: number | null) =>
    v == null ? '—' : v.toLocaleString('en-US'),
  neg: (v: number | null) =>
    v == null ? '—' : v < 0 ? `\u2212${Math.abs(v).toFixed(1)}%` : `${v.toFixed(1)}%`,
};

// Sum a numeric field across rows
function sumField(rows: ChannelRow[], key: keyof ChannelRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
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

  if (error) {
    console.error('[revenue/channels] supabase error:', error.message);
  }

  const rows: ChannelRow[] = (data as ChannelRow[]) ?? [];

  // Aggregate KPIs
  const totalRevenue   = sumField(rows, 'revenue_usd');
  const totalNetRev    = sumField(rows, 'net_revenue_usd');
  const totalRoomNights = sumField(rows, 'room_nights');
  const totalCommission = sumField(rows, 'commission_usd');
  const blendedADR     = totalRoomNights > 0 ? totalRevenue / totalRoomNights : null;
  const blendedNetADR  = totalRoomNights > 0 ? totalNetRev / totalRoomNights  : null;
  const commissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : null;

  const periodLabel = rows[0]?.period_label ?? null;

  // Table column definitions
  const columns: { key: keyof ChannelRow | string; header: string }[] = [
    { key: 'channel_name',     header: 'Channel'         },
    { key: 'room_nights',      header: 'Room Nights'     },
    { key: 'revenue_usd',      header: 'Gross Revenue'   },
    { key: 'adr_usd',          header: 'ADR'             },
    { key: 'commission_usd',   header: 'Commission'      },
    { key: 'commission_pct',   header: 'Commission %'    },
    { key: 'net_revenue_usd',  header: 'Net Revenue'     },
    { key: 'net_adr_usd',      header: 'Net ADR'         },
    { key: 'contribution_pct', header: 'Mix %'           },
  ];

  // Format rows for DataTable (all values → display strings)
  const tableRows = rows.map((r) => ({
    channel_name:     r.channel_name ?? '—',
    room_nights:      fmt.int(r.room_nights),
    revenue_usd:      fmt.usd(r.revenue_usd),
    adr_usd:          fmt.usd(r.adr_usd),
    commission_usd:   fmt.usd(r.commission_usd),
    commission_pct:   fmt.pct(r.commission_pct),
    net_revenue_usd:  fmt.usd(r.net_revenue_usd),
    net_adr_usd:      fmt.usd(r.net_adr_usd),
    contribution_pct: fmt.pct(r.contribution_pct),
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader
        pillar="Revenue"
        tab="Channels"
        title={periodLabel ? `Channel Economics — ${periodLabel}` : 'Channel Economics'}
      />

      {/* KPI ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Gross Revenue"     value={fmt.usd(totalRevenue)}   />
        <KpiBox label="Net Revenue"       value={fmt.usd(totalNetRev)}    />
        <KpiBox label="Room Nights"       value={fmt.int(totalRoomNights)}/>
        <KpiBox label="Blended ADR"       value={fmt.usd(blendedADR)}     />
        <KpiBox label="Net ADR"           value={fmt.usd(blendedNetADR)}  />
        <KpiBox label="Avg Commission"    value={fmt.pct(commissionRate)} />
      </div>

      {/* Channel breakdown table */}
      {rows.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          No channel data available
          {error ? ` — ${error.message}` : ' for this period'}.
        </p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
