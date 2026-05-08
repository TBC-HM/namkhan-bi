// app/revenue/rateplans/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RatePlanRow {
  rate_plan_code:      string | null;
  rate_plan_name:      string | null;
  room_nights:         number | null;
  revenue_usd:         number | null;
  adr_usd:             number | null;
  occupancy_pct:       number | null;
  revpar_usd:          number | null;
  avg_los:             number | null;
  cancellation_pct:    number | null;
  period:              string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

function fmtDec(v: number | null | undefined, dp = 1): string {
  if (v == null) return '—';
  return v.toFixed(dp);
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------
function sum(rows: RatePlanRow[], key: keyof RatePlanRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function wavg(
  rows: RatePlanRow[],
  numeratorKey: keyof RatePlanRow,
  weightKey: keyof RatePlanRow,
): number | null {
  const totalWeight = sum(rows, weightKey);
  if (totalWeight === 0) return null;
  const weighted = rows.reduce(
    (acc, r) => acc + (Number(r[numeratorKey]) || 0) * (Number(r[weightKey]) || 0),
    0,
  );
  return weighted / totalWeight;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function RatePlansPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('v_rateplan_performance')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(100);

  const rows: RatePlanRow[] = data ?? [];

  if (error) {
    console.error('[RatePlansPage] Supabase error:', error.message);
  }

  // KPI roll-ups
  const totalRoomNights = sum(rows, 'room_nights');
  const totalRevenue    = sum(rows, 'revenue_usd');
  const blendedADR      = wavg(rows, 'adr_usd', 'room_nights');
  const blendedRevPAR   = wavg(rows, 'revpar_usd', 'room_nights');

  // Table columns
  const columns = [
    { key: 'rate_plan_code',   header: 'Code'         },
    { key: 'rate_plan_name',   header: 'Rate Plan'    },
    { key: 'period',           header: 'Period'       },
    { key: 'room_nights',      header: 'Room Nights'  },
    { key: 'revenue_usd',      header: 'Revenue (USD)'},
    { key: 'adr_usd',          header: 'ADR'          },
    { key: 'revpar_usd',       header: 'RevPAR'       },
    { key: 'occupancy_pct',    header: 'OCC %'        },
    { key: 'avg_los',          header: 'Avg LOS'      },
    { key: 'cancellation_pct', header: 'Canc %'       },
  ];

  // Formatted rows for DataTable
  const tableRows = rows.map((r) => ({
    rate_plan_code:   r.rate_plan_code   ?? '—',
    rate_plan_name:   r.rate_plan_name   ?? '—',
    period:           r.period           ?? '—',
    room_nights:      fmtNum(r.room_nights),
    revenue_usd:      fmtUSD(r.revenue_usd),
    adr_usd:          fmtUSD(r.adr_usd),
    revpar_usd:       fmtUSD(r.revpar_usd),
    occupancy_pct:    fmtPct(r.occupancy_pct),
    avg_los:          fmtDec(r.avg_los),
    cancellation_pct: fmtPct(r.cancellation_pct),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plans Performance" />

      {/* ── KPI summary strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
          marginTop: 16,
        }}
      >
        <KpiBox label="Total Room Nights"  value={fmtNum(totalRoomNights)} />
        <KpiBox label="Total Revenue"      value={fmtUSD(totalRevenue)}    />
        <KpiBox label="Blended ADR"        value={fmtUSD(blendedADR)}      />
        <KpiBox label="Blended RevPAR"     value={fmtUSD(blendedRevPAR)}   />
      </div>

      {/* ── Detail table ── */}
      {rows.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>
          {error
            ? `Data unavailable — ${error.message}`
            : 'No rate plan data found for the selected period.'}
        </p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
