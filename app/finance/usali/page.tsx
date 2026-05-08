// app/finance/usali/page.tsx
// Marathon #195 — Finance · USALI: Uniform System of Accounts for the Lodging Industry
// Wired to: v_pl_monthly_usali (public schema, allowlisted)
// Assumption: view columns follow USALI P&L structure (period, department, revenue, expense, gop, etc.)

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

interface UsaliRow {
  period?: string;
  department?: string;
  revenue?: number | null;
  expenses?: number | null;
  gop?: number | null;
  gop_pct?: number | null;
  adr?: number | null;
  revpar?: number | null;
  occupancy_pct?: number | null;
  rooms_sold?: number | null;
  rooms_available?: number | null;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUSD(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const formatted =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `$${(abs / 1_000).toFixed(1)}K`
      : `$${abs.toFixed(2)}`;
  return v < 0 ? `−${formatted.slice(1)}` : formatted;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function UsaliPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_pl_monthly_usali')
    .select('*')
    .order('period', { ascending: false })
    .limit(60);

  const rows: UsaliRow[] = data ?? [];

  // Latest period aggregate (first row is most-recent period)
  const latest = rows[0] ?? {};

  // Summaries across all loaded rows
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalExpenses = rows.reduce((s, r) => s + (r.expenses ?? 0), 0);
  const totalGOP = rows.reduce((s, r) => s + (r.gop ?? 0), 0);
  const avgGOPpct =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.gop_pct ?? 0), 0) / rows.length
      : null;

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Finance" tab="USALI" title="USALI P&L" />

      {error && (
        <p
          role="alert"
          style={{
            background: '#fff1f0',
            border: '1px solid #ffccc7',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#a8071a',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          ⚠️ Data load error: {error.message}
        </p>
      )}

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <section
        aria-label="USALI KPIs"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Total Revenue"
          value={fmtUSD(totalRevenue)}
          sublabel="all loaded periods"
        />
        <KpiBox
          label="Total Expenses"
          value={fmtUSD(totalExpenses)}
          sublabel="all loaded periods"
        />
        <KpiBox
          label="Gross Operating Profit"
          value={fmtUSD(totalGOP)}
          sublabel="all loaded periods"
        />
        <KpiBox
          label="Avg GOP %"
          value={fmtPct(avgGOPpct)}
          sublabel="across periods"
        />
        <KpiBox
          label="Latest ADR"
          value={fmtUSD(latest.adr)}
          sublabel={latest.period ?? '—'}
        />
        <KpiBox
          label="Latest RevPAR"
          value={fmtUSD(latest.revpar)}
          sublabel={latest.period ?? '—'}
        />
        <KpiBox
          label="Latest Occupancy"
          value={fmtPct(latest.occupancy_pct)}
          sublabel={latest.period ?? '—'}
        />
        <KpiBox
          label="Rooms Sold"
          value={fmtNum(latest.rooms_sold)}
          sublabel={latest.period ?? '—'}
        />
      </section>

      {/* ── USALI Detail Table ────────────────────────────────────────────── */}
      <section aria-label="USALI detail">
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 12,
            color: '#1a1a2e',
          }}
        >
          Monthly P&amp;L Detail
        </h2>
        <DataTable
          columns={[
            { key: 'period',       header: 'Period'      },
            { key: 'department',   header: 'Department'  },
            { key: 'revenue',      header: 'Revenue'     },
            { key: 'expenses',     header: 'Expenses'    },
            { key: 'gop',          header: 'GOP'         },
            { key: 'gop_pct',      header: 'GOP %'       },
            { key: 'adr',          header: 'ADR'         },
            { key: 'revpar',       header: 'RevPAR'      },
            { key: 'occupancy_pct',header: 'OCC %'       },
            { key: 'rooms_sold',   header: 'Rooms Sold'  },
          ]}
          rows={rows.map((r) => ({
            ...r,
            period:        r.period       ?? '—',
            department:    r.department   ?? '—',
            revenue:       fmtUSD(r.revenue),
            expenses:      fmtUSD(r.expenses),
            gop:           fmtUSD(r.gop),
            gop_pct:       fmtPct(r.gop_pct),
            adr:           fmtUSD(r.adr),
            revpar:        fmtUSD(r.revpar),
            occupancy_pct: fmtPct(r.occupancy_pct),
            rooms_sold:    fmtNum(r.rooms_sold),
          }))}
        />
        {rows.length === 0 && !error && (
          <p
            style={{
              textAlign: 'center',
              color: '#888',
              fontSize: 13,
              padding: '32px 0',
            }}
          >
            No USALI data available yet.
          </p>
        )}
      </section>
    </main>
  );
}
