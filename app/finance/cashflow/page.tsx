// app/finance/cashflow/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CashflowRow {
  month: string;           // e.g. '2025-04'
  operating_inflow: number | null;
  operating_outflow: number | null;
  net_operating: number | null;
  investing_inflow: number | null;
  investing_outflow: number | null;
  net_investing: number | null;
  financing_inflow: number | null;
  financing_outflow: number | null;
  net_financing: number | null;
  net_cashflow: number | null;
  closing_balance: number | null;
  currency: string | null;
}

function fmtUSD(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const formatted =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `$${(abs / 1_000).toFixed(1)}K`
      : `$${abs.toFixed(2)}`;
  return v < 0 ? `−${formatted}` : formatted;
}

function fmtMonth(m: string | null | undefined): string {
  if (!m) return '—';
  try {
    return new Date(`${m}-01`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  } catch {
    return m;
  }
}

export default async function CashFlowPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .schema('gl' as never)
    .from('v_cashflow_monthly')
    .select('*')
    .order('month', { ascending: false })
    .limit(24);

  const rows: CashflowRow[] = (data as CashflowRow[] | null) ?? [];

  // Derive KPI summary from most-recent month
  const latest = rows[0] ?? null;
  const ytdNet = rows.reduce((sum, r) => sum + (r.net_cashflow ?? 0), 0);
  const ytdOperating = rows.reduce((sum, r) => sum + (r.net_operating ?? 0), 0);

  const columns = [
    { key: 'month', header: 'Month' },
    { key: 'operating_inflow', header: 'Op. Inflow' },
    { key: 'operating_outflow', header: 'Op. Outflow' },
    { key: 'net_operating', header: 'Net Operating' },
    { key: 'net_investing', header: 'Net Investing' },
    { key: 'net_financing', header: 'Net Financing' },
    { key: 'net_cashflow', header: 'Net Cash Flow' },
    { key: 'closing_balance', header: 'Closing Balance' },
  ];

  const tableRows = rows.map((r) => ({
    month: fmtMonth(r.month),
    operating_inflow: fmtUSD(r.operating_inflow),
    operating_outflow: fmtUSD(r.operating_outflow),
    net_operating: fmtUSD(r.net_operating),
    net_investing: fmtUSD(r.net_investing),
    net_financing: fmtUSD(r.net_financing),
    net_cashflow: fmtUSD(r.net_cashflow),
    closing_balance: fmtUSD(r.closing_balance),
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Finance" tab="Cash Flow" title="Cash Flow" />

      {error && (
        <p
          style={{
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          ⚠️ Could not load cash flow data: {error.message}
        </p>
      )}

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Net Cash Flow (Latest Month)"
          value={fmtUSD(latest?.net_cashflow)}
        />
        <KpiBox
          label="Closing Balance"
          value={fmtUSD(latest?.closing_balance)}
        />
        <KpiBox
          label="YTD Net Cash Flow"
          value={fmtUSD(ytdNet)}
        />
        <KpiBox
          label="YTD Net Operating"
          value={fmtUSD(ytdOperating)}
        />
      </div>

      {/* Secondary KPI row — operating / investing / financing breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Net Operating (Latest)"
          value={fmtUSD(latest?.net_operating)}
        />
        <KpiBox
          label="Net Investing (Latest)"
          value={fmtUSD(latest?.net_investing)}
        />
        <KpiBox
          label="Net Financing (Latest)"
          value={fmtUSD(latest?.net_financing)}
        />
      </div>

      {/* Monthly detail table */}
      {tableRows.length > 0 ? (
        <DataTable columns={columns} rows={tableRows} />
      ) : (
        !error && (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            No cash flow data available yet.
          </p>
        )
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
        Source: <code>gl.v_cashflow_monthly</code> · Showing last 24 months ·
        Refreshes every 60 s
      </p>
    </main>
  );
}
