// app/finance/forecast/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ForecastRow {
  period_label: string;
  revenue_forecast: number | null;
  revenue_actual: number | null;
  variance_pct: number | null;
  adr_forecast: number | null;
  adr_actual: number | null;
  occ_forecast: number | null;
  occ_actual: number | null;
  revpar_forecast: number | null;
  revpar_actual: number | null;
}

interface KpiSnapshot {
  metric: string;
  value: number | null;
  period: string | null;
}

function fmt(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '\u2014';
  return `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function fmtVariance(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export default async function ForecastPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: attempt finance.v_finance_forecast
  const { data: forecastData } = await supabase
    .from('finance.v_finance_forecast' as string)
    .select('*')
    .order('period_label', { ascending: false })
    .limit(24);

  const rows: ForecastRow[] = (forecastData ?? []) as ForecastRow[];

  // Fallback KPI context from cockpit_kpi_snapshots
  const { data: kpiData } = await supabase
    .from('cockpit_kpi_snapshots')
    .select('metric, value, period')
    .in('metric', ['revenue_forecast', 'revenue_actual', 'occ_forecast', 'occ_actual', 'adr_forecast', 'adr_actual'])
    .order('period', { ascending: false })
    .limit(12);

  const kpis: KpiSnapshot[] = (kpiData ?? []) as KpiSnapshot[];

  const getKpi = (metric: string): number | null =>
    kpis.find((k) => k.metric === metric)?.value ?? null;

  // Derive summary KPIs — prefer forecast rows, fall back to kpi_snapshots
  const latestRow = rows[0] ?? null;

  const revForecast = latestRow?.revenue_forecast ?? getKpi('revenue_forecast');
  const revActual   = latestRow?.revenue_actual   ?? getKpi('revenue_actual');
  const occForecast = latestRow?.occ_forecast     ?? getKpi('occ_forecast');
  const occActual   = latestRow?.occ_actual       ?? getKpi('occ_actual');
  const adrForecast = latestRow?.adr_forecast     ?? getKpi('adr_forecast');
  const adrActual   = latestRow?.adr_actual       ?? getKpi('adr_actual');

  const revenueVariance =
    revForecast != null && revActual != null && revForecast !== 0
      ? ((revActual - revForecast) / revForecast) * 100
      : null;

  const tableColumns = [
    { key: 'period_label',      header: 'Period'            },
    { key: 'revenue_forecast',  header: 'Rev Forecast ($)'  },
    { key: 'revenue_actual',    header: 'Rev Actual ($)'    },
    { key: 'variance_pct',      header: 'Rev Var %'         },
    { key: 'occ_forecast',      header: 'OCC Fcst %'        },
    { key: 'occ_actual',        header: 'OCC Act %'         },
    { key: 'adr_forecast',      header: 'ADR Fcst ($)'      },
    { key: 'adr_actual',        header: 'ADR Act ($)'       },
    { key: 'revpar_forecast',   header: 'RevPAR Fcst ($)'   },
    { key: 'revpar_actual',     header: 'RevPAR Act ($)'    },
  ];

  const tableRows = rows.map((r) => ({
    period_label:     r.period_label ?? '\u2014',
    revenue_forecast: fmt(r.revenue_forecast, '$'),
    revenue_actual:   fmt(r.revenue_actual, '$'),
    variance_pct:     fmtVariance(r.variance_pct),
    occ_forecast:     fmtPct(r.occ_forecast),
    occ_actual:       fmtPct(r.occ_actual),
    adr_forecast:     fmt(r.adr_forecast, '$'),
    adr_actual:       fmt(r.adr_actual, '$'),
    revpar_forecast:  fmt(r.revpar_forecast, '$'),
    revpar_actual:    fmt(r.revpar_actual, '$'),
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Finance" tab="Forecast" title="Revenue Forecast vs Actual" />

      {/* KPI summary strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Rev Forecast"   value={fmt(revForecast, '$')}          />
        <KpiBox label="Rev Actual"     value={fmt(revActual, '$')}             />
        <KpiBox label="Rev Variance"   value={fmtVariance(revenueVariance)}   />
        <KpiBox label="OCC Forecast"   value={fmtPct(occForecast)}            />
        <KpiBox label="OCC Actual"     value={fmtPct(occActual)}              />
        <KpiBox label="ADR Forecast"   value={fmt(adrForecast, '$')}          />
        <KpiBox label="ADR Actual"     value={fmt(adrActual, '$')}            />
      </div>

      {/* Detail table */}
      {tableRows.length > 0 ? (
        <DataTable columns={tableColumns} rows={tableRows} />
      ) : (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 16 }}>
          No forecast data available. Wire <code>finance.v_finance_forecast</code> to populate this table.
        </p>
      )}
    </main>
  );
}
