// app/revenue-v2/rateplans/page.tsx
// Wired to public.v_rateplan_performance — ticket #107 slice
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface RateplanRow {
  rateplan_code: string | null;
  rateplan_name: string | null;
  channel: string | null;
  room_nights: number | null;
  revenue_usd: number | null;
  adr_usd: number | null;
  occupancy_pct: number | null;
  revpar_usd: number | null;
  avg_los: number | null;
  period_label: string | null;
}

function fmt(value: number | null, prefix = ''): string {
  if (value == null) return '—';
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

export default async function RateplansPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_rateplan_performance')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(100);

  const rows: RateplanRow[] = data ?? [];

  // Aggregate KPIs across all returned rows
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalRoomNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const blendedADR =
    totalRoomNights > 0 ? totalRevenue / totalRoomNights : null;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.length
      : null;

  const columns = [
    { key: 'rateplan_code',  header: 'Code'        },
    { key: 'rateplan_name',  header: 'Rate Plan'   },
    { key: 'channel',        header: 'Channel'     },
    { key: 'period_label',   header: 'Period'      },
    { key: 'room_nights',    header: 'Room Nights' },
    { key: 'revenue_usd',    header: 'Revenue (USD)' },
    { key: 'adr_usd',        header: 'ADR'         },
    { key: 'occupancy_pct',  header: 'OCC %'       },
    { key: 'revpar_usd',     header: 'RevPAR'      },
    { key: 'avg_los',        header: 'Avg LOS'     },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    rateplan_code:  r.rateplan_code  ?? '—',
    rateplan_name:  r.rateplan_name  ?? '—',
    channel:        r.channel        ?? '—',
    period_label:   r.period_label   ?? '—',
    room_nights:    r.room_nights    != null ? r.room_nights.toLocaleString('en-US') : '—',
    revenue_usd:    fmt(r.revenue_usd, '$'),
    adr_usd:        fmt(r.adr_usd,    '$'),
    occupancy_pct:  fmtPct(r.occupancy_pct),
    revpar_usd:     fmt(r.revpar_usd, '$'),
    avg_los:        r.avg_los != null ? r.avg_los.toFixed(1) : '—',
  }));

  return (
    <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plan Performance" />

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13 }}>
          ⚠️ Data load error: {error.message}
        </p>
      )}

      {/* KPI Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox
          label="Total Revenue"
          value={totalRevenue > 0 ? `$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
        />
        <KpiBox
          label="Total Room Nights"
          value={totalRoomNights > 0 ? totalRoomNights.toLocaleString('en-US') : '—'}
        />
        <KpiBox
          label="Blended ADR"
          value={fmt(blendedADR, '$')}
        />
        <KpiBox
          label="Avg OCC %"
          value={fmtPct(avgOcc)}
        />
      </div>

      {/* Detail Table */}
      <DataTable columns={columns} rows={displayRows} />

      <p style={{ fontSize: 11, color: '#9ca3af' }}>
        Source: public.v_rateplan_performance · Refreshes every 60 s · Showing top 100 by revenue
      </p>
    </main>
  );
}
