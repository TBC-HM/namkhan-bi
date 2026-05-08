'use client';

// app/finance/forecast/page.tsx
// Marathon #195 — Finance · Forecast
// Wired to: gl.v_forecast_12m (12-month rolling budget vs actuals vs forecast)
// Assumption: view columns include forecast_month, revenue_budget, revenue_forecast,
//   revenue_actual, expense_budget, expense_forecast, expense_actual,
//   gop_budget, gop_forecast, gop_actual (all numeric / null-safe).

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastRow {
  forecast_month: string;        // e.g. "2025-06"
  revenue_budget: number | null;
  revenue_forecast: number | null;
  revenue_actual: number | null;
  expense_budget: number | null;
  expense_forecast: number | null;
  expense_actual: number | null;
  gop_budget: number | null;
  gop_forecast: number | null;
  gop_actual: number | null;
  occupancy_forecast: number | null; // optional — null-safe
  adr_forecast: number | null;       // optional — null-safe
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(val: number | null | undefined): string {
  if (val == null) return '—';
  const abs = Math.abs(val);
  const formatted =
    abs >= 1_000_000
      ? `$${(val / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
      ? `$${(val / 1_000).toFixed(0)}K`
      : `$${val.toFixed(0)}`;
  return val < 0 ? formatted.replace('$', '$−') : formatted;
}

function pct(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val.toFixed(1)}%`;
}

function variance(actual: number | null, budget: number | null): string {
  if (actual == null || budget == null || budget === 0) return '—';
  const v = ((actual - budget) / Math.abs(budget)) * 100;
  return v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`;
}

function latestNonNull<K extends keyof ForecastRow>(
  rows: ForecastRow[],
  key: K
): ForecastRow[K] | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][key] != null) return rows[i][key];
  }
  return null;
}

// ─── Supabase client (client-side, public anon key) ──────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    void supabase
      .schema('gl')
      .from('v_forecast_12m')
      .select('*')
      .order('forecast_month', { ascending: true })
      .limit(12)
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message);
        } else {
          setRows((data as ForecastRow[]) ?? []);
        }
        setLoading(false);
      });
  }, []);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────────
  const totalRevForecast = rows.reduce(
    (s, r) => s + (r.revenue_forecast ?? 0),
    0
  );
  const totalRevBudget = rows.reduce(
    (s, r) => s + (r.revenue_budget ?? 0),
    0
  );
  const totalGopForecast = rows.reduce(
    (s, r) => s + (r.gop_forecast ?? 0),
    0
  );
  const totalGopBudget = rows.reduce(
    (s, r) => s + (r.gop_budget ?? 0),
    0
  );
  const latestOcc = latestNonNull(rows, 'occupancy_forecast');
  const latestAdr = latestNonNull(rows, 'adr_forecast');

  const revVar = variance(totalRevForecast, totalRevBudget);
  const gopVar = variance(totalGopForecast, totalGopBudget);

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'forecast_month',    header: 'Month'           },
    { key: 'revenue_budget',    header: 'Rev Budget'      },
    { key: 'revenue_forecast',  header: 'Rev Forecast'    },
    { key: 'revenue_actual',    header: 'Rev Actual'      },
    { key: 'expense_budget',    header: 'Exp Budget'      },
    { key: 'expense_forecast',  header: 'Exp Forecast'    },
    { key: 'gop_budget',        header: 'GOP Budget'      },
    { key: 'gop_forecast',      header: 'GOP Forecast'    },
    { key: 'gop_actual',        header: 'GOP Actual'      },
    { key: 'occupancy_forecast', header: 'OCC Fcst'       },
    { key: 'adr_forecast',      header: 'ADR Fcst'        },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    forecast_month:    r.forecast_month ?? '—',
    revenue_budget:    usd(r.revenue_budget),
    revenue_forecast:  usd(r.revenue_forecast),
    revenue_actual:    usd(r.revenue_actual),
    expense_budget:    usd(r.expense_budget),
    expense_forecast:  usd(r.expense_forecast),
    gop_budget:        usd(r.gop_budget),
    gop_forecast:      usd(r.gop_forecast),
    gop_actual:        usd(r.gop_actual),
    occupancy_forecast: pct(r.occupancy_forecast),
    adr_forecast:      r.adr_forecast != null ? usd(r.adr_forecast) : '—',
  }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader pillar="Finance" tab="Forecast" title="12-Month Forecast" />

      {/* Error banner */}
      {fetchError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          ⚠️ Could not load forecast data: {fetchError}
        </div>
      )}

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiBox
          label="12M Rev Forecast"
          value={loading ? '…' : usd(totalRevForecast)}
          subLabel={`vs budget ${revVar}`}
        />
        <KpiBox
          label="12M GOP Forecast"
          value={loading ? '…' : usd(totalGopForecast)}
          subLabel={`vs budget ${gopVar}`}
        />
        <KpiBox
          label="Rev Budget (12M)"
          value={loading ? '…' : usd(totalRevBudget)}
        />
        <KpiBox
          label="GOP Budget (12M)"
          value={loading ? '…' : usd(totalGopBudget)}
        />
        <KpiBox
          label="Latest OCC Fcst"
          value={loading ? '…' : pct(latestOcc)}
        />
        <KpiBox
          label="Latest ADR Fcst"
          value={loading ? '…' : (latestAdr != null ? usd(latestAdr) : '—')}
        />
      </div>

      {/* 12-Month Detail Table */}
      <DataTable
        columns={columns}
        rows={loading ? [] : displayRows}
      />

      {!loading && rows.length === 0 && !fetchError && (
        <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>
          No forecast data available for the next 12 months.
        </p>
      )}
    </main>
  );
}
