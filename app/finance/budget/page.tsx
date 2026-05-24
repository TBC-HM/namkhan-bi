// app/finance/budget/page.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage chrome + Container sections +
// KpiTile headline + grid table preserved. Replaces the chrome-swap-only
// pass with the canonical Revenue-style surface.

import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
import { supabaseGl } from '@/lib/supabase-gl';
import BudgetUpload from './BudgetUpload';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  amount_usd: number;
}

const SUBCAT_ORDER = ['Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses', 'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Interest', 'FX Gain/Loss'];
const MONTHS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

function fmtK(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function BudgetPage() {
  const { data: rows } = await supabaseGl
    .from('v_budget_lines')
    .select('period_yyyymm, usali_subcategory, amount_usd');

  const allRows = (rows ?? []) as BudgetRow[];
  const totalRows = allRows.length;
  const cell = new Map<string, number>();
  for (const r of allRows) {
    const k = `${r.period_yyyymm}|${r.usali_subcategory}`;
    cell.set(k, (cell.get(k) ?? 0) + Number(r.amount_usd || 0));
  }
  const colSum = new Map<string, number>();
  const rowSum = new Map<string, number>();
  let grand = 0;
  for (const m of MONTHS_2026) {
    for (const s of SUBCAT_ORDER) {
      const v = cell.get(`${m}|${s}`) ?? 0;
      colSum.set(m, (colSum.get(m) ?? 0) + v);
      rowSum.set(s, (rowSum.get(s) ?? 0) + v);
      grand += v;
    }
  }
  const monthsCovered = MONTHS_2026.filter((m) => (colSum.get(m) ?? 0) > 0).length;
  const subcatsCovered = SUBCAT_ORDER.filter((s) => (rowSum.get(s) ?? 0) > 0).length;
  const coveragePct = SUBCAT_ORDER.length > 0 ? (subcatsCovered / SUBCAT_ORDER.length) * 100 : 0;

  const subtitle = `plan.lines · Budget 2026 v1 · ${monthsCovered}/12 months · ${subcatsCovered}/${SUBCAT_ORDER.length} subcats`;

  const tabs = FINANCE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/finance/pnl',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Budget rows', value: totalRows, size: 'sm', footnote: 'gl.v_budget_lines' },
    { label: 'Annual total', value: Math.round(grand), currency: 'USD', size: 'sm', footnote: 'sum across all subcats × months', status: grand > 0 ? 'green' : 'amber' },
    { label: 'Months covered', value: `${monthsCovered}/12`, size: 'sm', footnote: 'months with ≥1 budget row' },
    { label: 'Subcats covered', value: `${subcatsCovered}/${SUBCAT_ORDER.length}`, size: 'sm', footnote: 'USALI subcategories with rows' },
    { label: 'Coverage %', value: `${coveragePct.toFixed(0)}%`, size: 'sm', status: coveragePct >= 80 ? 'green' : coveragePct >= 50 ? 'amber' : 'red' },
  ];

  return (
    <DashboardPage title="Budget · FY2026" subtitle={subtitle} tabs={tabs}>
      {/* 1 · Headline KPI strip */}
      <div style={fullRow}>
        <Container title="Headline" subtitle="annual · USALI · monthly" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* 2 · Budget grid */}
      <div style={fullRow}>
        <Container title="Budget grid" subtitle="USALI subcategory rows × month columns" density="compact">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>USALI subcategory</th>
                  {MONTHS_2026.map((m) => <th key={m} style={{ ...th, textAlign: 'right' }}>{m.slice(5)}</th>)}
                  <th style={{ ...th, textAlign: 'right' }}>FY total</th>
                </tr>
              </thead>
              <tbody>
                {SUBCAT_ORDER.map((s) => (
                  <tr key={s}>
                    <td style={td}><strong>{s}</strong></td>
                    {MONTHS_2026.map((m) => {
                      const v = cell.get(`${m}|${s}`) ?? 0;
                      return <td key={m} style={{ ...td, textAlign: 'right', color: v === 0 ? 'var(--ink-mute, #6b7280)' : undefined }}>{fmtK(v)}</td>;
                    })}
                    <td style={{ ...td, textAlign: 'right' }}><strong>{fmtK(rowSum.get(s) ?? 0)}</strong></td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--ink-soft, #5a5a5a)' }}>
                  <td style={td}><strong>Monthly total</strong></td>
                  {MONTHS_2026.map((m) => <td key={m} style={{ ...td, textAlign: 'right' }}><strong>{fmtK(colSum.get(m) ?? 0)}</strong></td>)}
                  <td style={{ ...td, textAlign: 'right' }}><strong>{fmtK(grand)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      {/* 3 · Upload */}
      <div style={fullRow}>
        <Container title="Upload" subtitle="drop a new budget CSV" density="compact">
          <BudgetUpload lastUploadAt={null} />
        </Container>
      </div>
    </DashboardPage>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--ink-soft, #d4d4d8)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5a5a5a)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--ink-soft, #ececec)', fontSize: 12, color: 'var(--ink, #1b1b1b)', fontVariantNumeric: 'tabular-nums' };
