'use client';

// app/finance/pnl/page.tsx
// Marathon #195 — Finance · P&L adapt + wire
// Data source: gl.mv_usali_pl_monthly (allowlisted as v_pl_monthly_usali)
// Assumption: view columns match USALI structure — dept, subcat, revenue, cogs,
//             gross_profit, expenses, gop, budget_revenue, budget_gop, period_month
// Month filter via ?month=YYYY-MM URL param (see MonthDropdown.tsx for client picker)

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import MonthDropdown from './MonthDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1_000_000
    ? `$${(abs / 1_000_000).toFixed(2)}M`
    : abs >= 1_000
    ? `$${(abs / 1_000).toFixed(1)}k`
    : `$${abs.toFixed(0)}`;
  return n < 0 ? `−${s}` : s;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`;
}

function latestMonth(rows: PlRow[]): string {
  if (!rows.length) return '';
  return rows.reduce((a, b) =>
    (a.period_month ?? '') > (b.period_month ?? '') ? a : b
  ).period_month ?? '';
}

function priorPeriod(ym: string): string {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ── types ──────────────────────────────────────────────────────────────────────

interface PlRow {
  period_month: string | null;
  usali_department: string | null;
  usali_subcategory: string | null;
  revenue: number | null;
  cogs: number | null;
  gross_profit: number | null;
  total_expenses: number | null;
  gop: number | null;
  budget_revenue: number | null;
  budget_gop: number | null;
  gop_margin_pct: number | null;
}

// ── page ───────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PnlPage({ searchParams }: PageProps) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all rows — filter client-side by month
  const { data, error } = await supabase
    .from('v_pl_monthly_usali')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(500);

  const all: PlRow[] = (data as PlRow[] | null) ?? [];

  // Resolve target month
  const rawMonth = Array.isArray(searchParams?.month)
    ? searchParams!.month[0]
    : (searchParams?.month ?? '');
  const validMonthRe = /^2026-(0[1-9]|1[0-2])$/;
  const cur = validMonthRe.test(rawMonth ?? '') ? rawMonth! : latestMonth(all);
  const prior = priorPeriod(cur);

  const curRows  = all.filter(r => r.period_month === cur);
  const priorRows = all.filter(r => r.period_month === prior);

  // ── top-line KPIs ────────────────────────────────────────────────────────────
  const sum = (rows: PlRow[], field: keyof PlRow) =>
    rows.reduce((acc, r) => acc + ((r[field] as number | null) ?? 0), 0);

  const totalRev    = sum(curRows, 'revenue');
  const totalGop    = sum(curRows, 'gop');
  const totalBudRev = sum(curRows, 'budget_revenue');
  const totalBudGop = sum(curRows, 'budget_gop');
  const gopMargin   = totalRev ? (totalGop / totalRev) * 100 : null;
  const priorRev    = sum(priorRows, 'revenue');
  const revVsBud    = totalBudRev ? ((totalRev - totalBudRev) / totalBudRev) * 100 : null;
  const gopVsBud    = totalBudGop ? ((totalGop - totalBudGop) / totalBudGop) * 100 : null;

  // ── table rows ───────────────────────────────────────────────────────────────
  const tableRows = curRows.map(r => ({
    department:   r.usali_department  ?? '—',
    subcategory:  r.usali_subcategory ?? '—',
    revenue:      fmt$(r.revenue),
    cogs:         fmt$(r.cogs),
    gross_profit: fmt$(r.gross_profit),
    expenses:     fmt$(r.total_expenses),
    gop:          fmt$(r.gop),
    gop_margin:   fmtPct(r.gop_margin_pct),
    bud_revenue:  fmt$(r.budget_revenue),
    bud_gop:      fmt$(r.budget_gop),
  }));

  const columns = [
    { key: 'department',   header: 'Department'   },
    { key: 'subcategory',  header: 'Subcategory'  },
    { key: 'revenue',      header: 'Revenue'      },
    { key: 'cogs',         header: 'COGS'         },
    { key: 'gross_profit', header: 'Gross Profit' },
    { key: 'expenses',     header: 'Expenses'     },
    { key: 'gop',          header: 'GOP'          },
    { key: 'gop_margin',   header: 'GOP Margin'   },
    { key: 'bud_revenue',  header: 'Bud. Revenue' },
    { key: 'bud_gop',      header: 'Bud. GOP'     },
  ];

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--sans)' }}>
      <PageHeader pillar="Finance" tab="P&L" title="Profit & Loss" />

      {/* Month selector */}
      <div style={{ marginBottom: 20 }}>
        <MonthDropdown current={cur} />
      </div>

      {error && (
        <div style={{ color: 'var(--brass)', marginBottom: 16, fontSize: 'var(--t-sm)' }}>
          ⚠ Data load error — showing available data. ({String(error)})
        </div>
      )}

      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <KpiBox label="Total Revenue"   value={fmt$(totalRev)}   sub={`vs prior ${fmt$(priorRev)}`} />
        <KpiBox label="GOP"             value={fmt$(totalGop)}   />
        <KpiBox label="GOP Margin"      value={fmtPct(gopMargin)} />
        <KpiBox label="Rev vs Budget"   value={fmtPct(revVsBud)} />
        <KpiBox label="GOP vs Budget"   value={fmtPct(gopVsBud)} />
        <KpiBox label="Budget Revenue"  value={fmt$(totalBudRev)} />
        <KpiBox label="Budget GOP"      value={fmt$(totalBudGop)} />
      </div>

      {/* Detail table */}
      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
