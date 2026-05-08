// app/finance/cashflow/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── types ────────────────────────────────────────────────────────────────────
interface CashflowRow {
  period_month?: string;
  operating_inflow?: number | null;
  operating_outflow?: number | null;
  net_operating?: number | null;
  investing_net?: number | null;
  financing_net?: number | null;
  net_cashflow?: number | null;
  closing_balance?: number | null;
  currency?: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const formatted =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : `$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return v < 0 ? `−${formatted}` : formatted;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
}

function netColor(v: number | null | undefined): string {
  if (v == null) return 'inherit';
  return v >= 0 ? '#22c55e' : '#ef4444';
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default async function CashFlowPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary source: gl schema cash flow view
  const { data, error } = await supabase
    .schema('gl')
    .from('v_cashflow_monthly')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(24);

  const rows: CashflowRow[] = data ?? [];
  const latest = rows[0] ?? {};

  // Aggregate for KPI tiles
  const ytdRows = rows.slice(0, 12);
  const ytdNet = ytdRows.reduce((acc, r) => acc + (r.net_cashflow ?? 0), 0);
  const ytdOperating = ytdRows.reduce((acc, r) => acc + (r.net_operating ?? 0), 0);
  const ytdInvesting = ytdRows.reduce((acc, r) => acc + (r.investing_net ?? 0), 0);
  const ytdFinancing = ytdRows.reduce((acc, r) => acc + (r.financing_net ?? 0), 0);

  // Derive MoM % change on net_cashflow (latest vs previous)
  const prev = rows[1];
  let momPct: number | null = null;
  if (latest.net_cashflow != null && prev?.net_cashflow != null && prev.net_cashflow !== 0) {
    momPct = ((latest.net_cashflow - prev.net_cashflow) / Math.abs(prev.net_cashflow)) * 100;
  }

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'Inter, sans-serif', color: '#1a1a2e' }}>
      <PageHeader pillar="Finance" tab="Cash Flow" title="Cash Flow" />

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#dc2626',
            fontSize: 13,
          }}
        >
          ⚠️ Data source unavailable — showing structure only. ({error.message})
        </div>
      )}

      {/* ── KPI tiles ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Closing Balance"
          value={fmtUSD(latest.closing_balance)}
          sub={latest.period_month ?? '—'}
        />
        <KpiBox
          label="Net Cash Flow (latest)"
          value={fmtUSD(latest.net_cashflow)}
          sub={momPct != null ? `MoM ${fmtPct(momPct)}` : undefined}
          valueStyle={{ color: netColor(latest.net_cashflow) }}
        />
        <KpiBox
          label="YTD Net Cash Flow"
          value={fmtUSD(ytdNet)}
          sub="Last 12 months"
          valueStyle={{ color: netColor(ytdNet) }}
        />
        <KpiBox
          label="YTD Operating CF"
          value={fmtUSD(ytdOperating)}
          valueStyle={{ color: netColor(ytdOperating) }}
        />
        <KpiBox
          label="YTD Investing CF"
          value={fmtUSD(ytdInvesting)}
          valueStyle={{ color: netColor(ytdInvesting) }}
        />
        <KpiBox
          label="YTD Financing CF"
          value={fmtUSD(ytdFinancing)}
          valueStyle={{ color: netColor(ytdFinancing) }}
        />
      </div>

      {/* ── Monthly detail table ───────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          Monthly Cash Flow Detail
        </h2>
        <DataTable
          columns={[
            { key: 'period_month', header: 'Month' },
            { key: 'operating_inflow_fmt', header: 'Operating In' },
            { key: 'operating_outflow_fmt', header: 'Operating Out' },
            { key: 'net_operating_fmt', header: 'Net Operating' },
            { key: 'investing_net_fmt', header: 'Investing Net' },
            { key: 'financing_net_fmt', header: 'Financing Net' },
            { key: 'net_cashflow_fmt', header: 'Net Cash Flow' },
            { key: 'closing_balance_fmt', header: 'Closing Balance' },
          ]}
          rows={
            rows.length > 0
              ? rows.map((r) => ({
                  period_month: r.period_month ?? '—',
                  operating_inflow_fmt: fmtUSD(r.operating_inflow),
                  operating_outflow_fmt: fmtUSD(r.operating_outflow),
                  net_operating_fmt: fmtUSD(r.net_operating),
                  investing_net_fmt: fmtUSD(r.investing_net),
                  financing_net_fmt: fmtUSD(r.financing_net),
                  net_cashflow_fmt: fmtUSD(r.net_cashflow),
                  closing_balance_fmt: fmtUSD(r.closing_balance),
                }))
              : [
                  {
                    period_month: '—',
                    operating_inflow_fmt: '—',
                    operating_outflow_fmt: '—',
                    net_operating_fmt: '—',
                    investing_net_fmt: '—',
                    financing_net_fmt: '—',
                    net_cashflow_fmt: '—',
                    closing_balance_fmt: '—',
                  },
                ]
          }
        />
      </section>

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
        Source: <code>gl.v_cashflow_monthly</code> · Refreshed every 60 s ·{' '}
        {rows.length} months loaded
      </p>
    </main>
  );
}
