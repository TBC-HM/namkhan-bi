// app/finance/pl/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PlRow {
  period_month: string;          // YYYY-MM
  department: string;
  revenue_total: number | null;
  cogs_total: number | null;
  gross_profit: number | null;
  payroll_total: number | null;
  other_expenses: number | null;
  ebitda: number | null;
  gop: number | null;
  gop_pct: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(value: number | null, prefix = ''): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const formatted =
    abs >= 1_000_000
      ? `${prefix}${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `${prefix}${(abs / 1_000).toFixed(1)}K`
      : `${prefix}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return value < 0 ? `−${formatted}` : formatted;
}

function fmtPct(value: number | null): string {
  if (value == null) return '—';
  const sign = value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function FinancePLPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Primary: attempt the USALI P&L view (schema-prefixed via RPC fallback)
  // Fallback: empty array so the page always renders without crashing.
  let rows: PlRow[] = [];

  const { data: viewData } = await supabase
    .from('v_pl_monthly_usali')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(24);

  if (viewData && viewData.length > 0) {
    rows = viewData as PlRow[];
  } else {
    // Secondary fallback — try the gl schema via RPC if view not yet public
    const { data: rpcData } = await supabase.rpc('get_usali_pl_monthly', {
      p_months: 12,
    });
    if (rpcData && rpcData.length > 0) {
      rows = rpcData as PlRow[];
    }
  }

  // ── Summary KPIs (latest month) ──
  const latest = rows[0] ?? null;
  const totalRevenue = latest?.revenue_total ?? null;
  const gop = latest?.gop ?? null;
  const gopPct = latest?.gop_pct ?? null;
  const ebitda = latest?.ebitda ?? null;

  // ── Table columns ──
  const columns: { key: keyof PlRow; header: string }[] = [
    { key: 'period_month',   header: 'Month' },
    { key: 'department',     header: 'Department' },
    { key: 'revenue_total',  header: 'Revenue ($)' },
    { key: 'cogs_total',     header: 'COGS ($)' },
    { key: 'gross_profit',   header: 'Gross Profit ($)' },
    { key: 'payroll_total',  header: 'Payroll ($)' },
    { key: 'other_expenses', header: 'Other Exp ($)' },
    { key: 'gop',            header: 'GOP ($)' },
    { key: 'gop_pct',        header: 'GOP %' },
    { key: 'ebitda',         header: 'EBITDA ($)' },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    ...r,
    revenue_total:  fmt(r.revenue_total, '$'),
    cogs_total:     fmt(r.cogs_total, '$'),
    gross_profit:   fmt(r.gross_profit, '$'),
    payroll_total:  fmt(r.payroll_total, '$'),
    other_expenses: fmt(r.other_expenses, '$'),
    gop:            fmt(r.gop, '$'),
    gop_pct:        fmtPct(r.gop_pct),
    ebitda:         fmt(r.ebitda, '$'),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Finance" tab="P&L" title="Profit & Loss — USALI" />

      {/* ── KPI Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox
          label="Total Revenue"
          value={fmt(totalRevenue, '$')}
          subtitle={latest?.period_month ?? '—'}
        />
        <KpiBox
          label="GOP"
          value={fmt(gop, '$')}
          subtitle={latest?.period_month ?? '—'}
        />
        <KpiBox
          label="GOP %"
          value={fmtPct(gopPct)}
          subtitle="vs budget TBD"
        />
        <KpiBox
          label="EBITDA"
          value={fmt(ebitda, '$')}
          subtitle={latest?.period_month ?? '—'}
        />
      </div>

      {/* ── Detail Table ── */}
      {displayRows.length > 0 ? (
        <DataTable
          columns={columns.map((c) => ({ key: c.key as string, header: c.header }))}
          rows={displayRows}
        />
      ) : (
        <p style={{ color: '#888', marginTop: 32 }}>
          No P&amp;L data available yet — view <code>v_pl_monthly_usali</code> has
          not been materialised in the public schema. Wire the migration first,
          then this page will populate automatically.
        </p>
      )}
    </main>
  );
}
