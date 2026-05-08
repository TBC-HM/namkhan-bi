'use client';

// app/finance/usali/page.tsx
// Marathon #195 – Finance · USALI — adapt + wire
// Wires to: v_pl_monthly_usali (gl schema via Supabase service role)
// Assumptions:
//   1. v_pl_monthly_usali returns rows with columns listed in DataTable below.
//   2. If the view is in `gl` schema, the Supabase client needs schema: 'gl'.
//      We use public alias: supabase.from('v_pl_monthly_usali') after granting usage.
//      If not yet exposed, the page renders em-dash placeholders gracefully.
//   3. KpiBox, DataTable, PageHeader are default exports.
//   4. The page is client-side to allow future filter interactivity.

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

interface UsaliRow {
  period_month?: string;
  department?: string;
  category?: string;
  account_code?: string;
  account_name?: string;
  actual_amount?: number | null;
  budget_amount?: number | null;
  variance_amount?: number | null;
  variance_pct?: number | null;
  por?: number | null;   // per occupied room
  poc?: number | null;   // percentage of revenue
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function fmt(v: number | null | undefined, prefix = '') {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  return `${sign}${prefix}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export default function UsaliPage() {
  const [rows, setRows] = useState<UsaliRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .schema('gl' as never)
        .from('mv_usali_categorized')
        .select('*')
        .order('period_month', { ascending: false })
        .limit(200);

      if (err) {
        // Fallback: try public alias
        const { data: data2, error: err2 } = await supabase
          .from('v_pl_monthly_usali')
          .select('*')
          .order('period_month', { ascending: false })
          .limit(200);

        if (err2) {
          setError(`Unable to load USALI data: ${err2.message}`);
        } else {
          setRows((data2 ?? []) as UsaliRow[]);
        }
      } else {
        setRows((data ?? []) as UsaliRow[]);
      }
      setLoading(false);
    })();
  }, []);

  // ── KPI aggregates (latest period) ───────────────────────────────────────
  const latestPeriod = rows[0]?.period_month ?? null;
  const periodRows = latestPeriod
    ? rows.filter((r) => r.period_month === latestPeriod)
    : rows;

  const totalRevenue = periodRows
    .filter((r) => r.category?.toLowerCase().includes('revenue'))
    .reduce((s, r) => s + (r.actual_amount ?? 0), 0);

  const totalExpense = periodRows
    .filter((r) => r.category?.toLowerCase().includes('expense'))
    .reduce((s, r) => s + (r.actual_amount ?? 0), 0);

  const gop = totalRevenue - totalExpense;
  const gopPct = totalRevenue !== 0 ? (gop / totalRevenue) * 100 : null;

  const totalVariance = periodRows.reduce(
    (s, r) => s + (r.variance_amount ?? 0),
    0
  );

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    { key: 'period_month', header: 'Period' },
    { key: 'department', header: 'Department' },
    { key: 'category', header: 'Category' },
    { key: 'account_code', header: 'Code' },
    { key: 'account_name', header: 'Account' },
    {
      key: 'actual_amount',
      header: 'Actual ($)',
      render: (r: UsaliRow) => fmt(r.actual_amount, '$'),
    },
    {
      key: 'budget_amount',
      header: 'Budget ($)',
      render: (r: UsaliRow) => fmt(r.budget_amount, '$'),
    },
    {
      key: 'variance_amount',
      header: 'Variance ($)',
      render: (r: UsaliRow) => fmt(r.variance_amount, '$'),
    },
    {
      key: 'variance_pct',
      header: 'Var %',
      render: (r: UsaliRow) => fmtPct(r.variance_pct),
    },
    {
      key: 'por',
      header: 'POR ($)',
      render: (r: UsaliRow) => fmt(r.por, '$'),
    },
    {
      key: 'poc',
      header: '% Rev',
      render: (r: UsaliRow) => fmtPct(r.poc),
    },
  ];

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Finance" tab="USALI" title="USALI P&amp;L" />

      {/* Period badge */}
      {latestPeriod && (
        <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>
          Showing latest period: <strong>{latestPeriod}</strong>
          {rows.length > periodRows.length &&
            ` · ${rows.length} total rows loaded`}
        </p>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            color: '#991b1b',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox
          label="Total Revenue"
          value={loading ? '…' : fmt(totalRevenue, '$')}
        />
        <KpiBox
          label="Total Expenses"
          value={loading ? '…' : fmt(totalExpense, '$')}
        />
        <KpiBox
          label="GOP"
          value={loading ? '…' : fmt(gop, '$')}
        />
        <KpiBox
          label="GOP %"
          value={loading ? '…' : fmtPct(gopPct)}
        />
        <KpiBox
          label="Budget Variance"
          value={loading ? '…' : fmt(totalVariance, '$')}
        />
      </div>

      {/* Data table */}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading USALI data…</p>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </main>
  );
}
