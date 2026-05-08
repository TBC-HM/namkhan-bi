// app/finance/forecast/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ForecastRow {
  forecast_month: string;        // YYYY-MM or YYYY-MM-DD
  revenue_forecast: number | null;
  cost_forecast: number | null;
  gop_forecast: number | null;
  revenue_actual: number | null;
  gop_actual: number | null;
  variance_pct: number | null;
  occupancy_pct: number | null;
  adr_forecast: number | null;
  revpar_forecast: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const usd = (v: number | null | undefined): string =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const pct = (v: number | null | undefined): string =>
  v == null ? '—' : `${v >= 0 ? '' : '\u2212'}${Math.abs(v).toFixed(1)}%`;

const fmt = (v: string | number | null | undefined): string =>
  v == null ? '—' : String(v);

// Colour a variance: red if negative, green if positive
const varianceLabel = (v: number | null | undefined): string => {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '\u2212'; // true minus U+2212
  return `${sign}${Math.abs(v).toFixed(1)}%`;
};

// Sum a numeric column across all rows
const sum = (rows: ForecastRow[], key: keyof ForecastRow): number =>
  rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

// Average a numeric column (skipping nulls)
const avg = (rows: ForecastRow[], key: keyof ForecastRow): number => {
  const valid = rows.filter((r) => r[key] != null);
  if (!valid.length) return 0;
  return valid.reduce((acc, r) => acc + (Number(r[key]) || 0), 0) / valid.length;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ForecastPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .schema('gl' as never)
    .from('v_forecast_12m')
    .select('*')
    .order('forecast_month', { ascending: true })
    .limit(12);

  const rows: ForecastRow[] = (data as ForecastRow[] | null) ?? [];

  // ── KPI summary values ────────────────────────────────────────────────────
  const totalRevForecast = sum(rows, 'revenue_forecast');
  const totalGopForecast = sum(rows, 'gop_forecast');
  const totalRevActual   = sum(rows, 'revenue_actual');
  const avgVariance      = avg(rows, 'variance_pct');
  const avgOcc           = avg(rows, 'occupancy_pct');
  const avgAdr           = avg(rows, 'adr_forecast');
  const avgRevpar        = avg(rows, 'revpar_forecast');

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    { key: 'forecast_month',   header: 'Month'          },
    { key: 'revenue_forecast', header: 'Rev Forecast'   },
    { key: 'revenue_actual',   header: 'Rev Actual'     },
    { key: 'cost_forecast',    header: 'Cost Forecast'  },
    { key: 'gop_forecast',     header: 'GOP Forecast'   },
    { key: 'gop_actual',       header: 'GOP Actual'     },
    { key: 'variance_pct',     header: 'Var %'          },
    { key: 'occupancy_pct',    header: 'OCC %'          },
    { key: 'adr_forecast',     header: 'ADR'            },
    { key: 'revpar_forecast',  header: 'RevPAR'         },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    forecast_month:   fmt(r.forecast_month?.slice(0, 7)),
    revenue_forecast: usd(r.revenue_forecast),
    revenue_actual:   r.revenue_actual != null ? usd(r.revenue_actual) : '—',
    cost_forecast:    usd(r.cost_forecast),
    gop_forecast:     usd(r.gop_forecast),
    gop_actual:       r.gop_actual != null ? usd(r.gop_actual) : '—',
    variance_pct:     varianceLabel(r.variance_pct),
    occupancy_pct:    pct(r.occupancy_pct),
    adr_forecast:     usd(r.adr_forecast),
    revpar_forecast:  usd(r.revpar_forecast),
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Finance" tab="Forecast" title="12-Month Forecast" />

      {error && (
        <div
          role="alert"
          style={{
            background: '#fff1f0',
            border: '1px solid #ffa39e',
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 24,
            color: '#cf1322',
            fontSize: 13,
          }}
        >
          ⚠️ Data unavailable: {error.message}
        </div>
      )}

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Rev Forecast (12 m)" value={usd(totalRevForecast)}   />
        <KpiBox label="Rev Actual (YTD)"    value={usd(totalRevActual)}     />
        <KpiBox label="GOP Forecast (12 m)" value={usd(totalGopForecast)}   />
        <KpiBox label="Avg Variance"        value={pct(avgVariance)}        />
        <KpiBox label="Avg Occupancy"       value={pct(avgOcc)}             />
        <KpiBox label="ADR Forecast"        value={usd(avgAdr)}             />
        <KpiBox label="RevPAR Forecast"     value={usd(avgRevpar)}          />
      </div>

      {/* ── Monthly Detail Table ──────────────────────────────────────────── */}
      <section>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#6b7280',
            marginBottom: 12,
          }}
        >
          Monthly Breakdown
        </h2>
        <DataTable columns={columns} rows={displayRows.length ? displayRows : []} />

        {!rows.length && !error && (
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
            No forecast data returned from <code>gl.v_forecast_12m</code>. Verify the view is populated.
          </p>
        )}
      </section>
    </main>
  );
}
