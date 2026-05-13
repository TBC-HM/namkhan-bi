// app/finance/budget/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import { supabaseGl } from '@/lib/supabase-gl';
import BudgetUpload from './BudgetUpload';
import { SectionHead } from '../_components/FinanceShell';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  amount_usd: number;
}

// PBS 2026-05-13: trimmed SUBCAT_ORDER to the 10 subcats that actually
// exist in gl.v_budget_lines. Mgmt Fees / Depreciation / Income Tax /
// Non-Operating are not budgeted at the property level (out-of-scope or
// non-cash); previously the page rendered them as blank rows.
const SUBCAT_ORDER = ['Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses', 'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Interest', 'FX Gain/Loss'];
const MONTHS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

function fmtK(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
}

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
  // PBS 2026-05-13: v_budget_lines has no uploaded_at column; previously
  // the page silently rendered null. Show "—" until a versioning column
  // is added to plan.lines.
  const lastUpload: string | null = null;

  const budgetEyebrow = [
    'Finance · Budget',
    'plan.lines · Budget 2026 v1',
    `${monthsCovered}/12 months`,
    `${subcatsCovered}/${SUBCAT_ORDER.length} subcats`,
    lastUpload ? `uploaded ${String(lastUpload).slice(0, 10)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Page
      eyebrow={budgetEyebrow}
      title={<>The number you <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>committed to</em> — every USALI line, every month.</>}
      subPages={FINANCE_SUBPAGES}
    >
      {/* ─── 1. KPI tiles ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={totalRows} unit="count" label="Budget rows"   tooltip="Distinct (subcategory × month) rows in plan.lines for the active budget year." />
        <KpiBox value={grand} unit="usd" label="Annual total"        state={grand > 0 ? 'live' : 'data-needed'} needs={grand === 0 ? 'awaiting upload' : undefined} tooltip="Sum of budget across every subcategory + month in the active year." />
        <KpiBox value={null} unit="text" valueText={`${monthsCovered}/12`} label="Months covered" tooltip="Distinct months that have at least one budget row populated for the active year." />
        <KpiBox value={null} unit="text" valueText={`${subcatsCovered}/${SUBCAT_ORDER.length}`} label="Subcats covered" tooltip="Distinct USALI subcategories with at least one budget row this year." />
      </div>

      {/* No period selector — page scope is fixed FY2026 annual budget. */}

      {/* ─── 4. Tables ──────────────────────────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Budget grid" emphasis="2026 · monthly" sub="Subcategory rows × month columns" source="plan.lines" />
        <div style={{ overflowX: 'auto', border: '1px solid var(--paper-deep)', borderRadius: 8, background: 'var(--paper-warm)' }}>
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
                    return <td key={m} style={{ ...td, textAlign: 'right', color: v === 0 ? 'var(--ink-mute)' : undefined }}>{fmtK(v)}</td>;
                  })}
                  <td style={{ ...td, textAlign: 'right' }}><strong>{fmtK(rowSum.get(s) ?? 0)}</strong></td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--paper-deep)' }}>
                <td style={td}><strong>Monthly total</strong></td>
                {MONTHS_2026.map((m) => <td key={m} style={{ ...td, textAlign: 'right' }}><strong>{fmtK(colSum.get(m) ?? 0)}</strong></td>)}
                <td style={{ ...td, textAlign: 'right' }}><strong>{fmtK(grand)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin action — drop new budget file. Below the table per canonical order. */}
      <div style={{ marginTop: 18 }}>
        <BudgetUpload lastUploadAt={lastUpload} />
      </div>
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' };
