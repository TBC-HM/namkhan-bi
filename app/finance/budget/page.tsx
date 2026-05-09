// app/finance/budget/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabaseGl } from '@/lib/supabase-gl';
import BudgetUpload from './BudgetUpload';
import {
  FinanceStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from '../_components/FinanceShell';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  amount_usd: number;
  uploaded_at?: string | null;
}

const SUBCAT_ORDER = ['Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses', 'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Mgmt Fees', 'Depreciation', 'Interest', 'Income Tax', 'FX Gain/Loss', 'Non-Operating'];
const MONTHS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

function fmtK(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
}

export default async function BudgetPage() {
  const { data: rows } = await supabaseGl
    .from('v_budget_lines')
    .select('period_yyyymm, usali_subcategory, amount_usd, uploaded_at');

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
  const lastUpload = allRows.map((r) => r.uploaded_at).filter((d): d is string => !!d).sort().reverse()[0] ?? null;

  return (
    <Page
      eyebrow="Finance · Budget"
      title={<>The number you <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>committed to</em> — every USALI line, every month.</>}
      subPages={FINANCE_SUBPAGES}
    >
      <FinanceStatusHeader
        top={<>
          <StatusCell label="SOURCE"><StatusPill tone="active">plan.lines · v_budget_lines</StatusPill><span style={metaDim}>· "Budget 2026 v1"</span></StatusCell>
          <StatusCell label="ROWS"><span style={metaStrong}>{totalRows}</span></StatusCell>
          <StatusCell label="COVERAGE"><span style={metaSm}>{monthsCovered}/12</span><span style={metaDim}>months · {subcatsCovered}/{SUBCAT_ORDER.length} subcats</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
        bottom={<>
          <StatusCell label="ANNUAL"><span style={metaStrong}>{grand > 0 ? `$${(grand / 1000).toFixed(0)}k` : '—'}</span></StatusCell>
          {lastUpload && <StatusCell label="LAST UPLOAD"><span style={metaDim}>{String(lastUpload).slice(0, 10)}</span></StatusCell>}
          <span style={{ flex: 1 }} />
          <span style={metaDim}>feeds /finance/pnl Budget · Δ Bgt · Flow columns</span>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={totalRows} unit="count" label="Budget rows" />
        <KpiBox value={grand} unit="usd" label="Annual total" state={grand > 0 ? 'live' : 'data-needed'} needs={grand === 0 ? 'awaiting upload' : undefined} />
        <KpiBox value={null} unit="text" valueText={`${monthsCovered}/12`} label="Months covered" />
        <KpiBox value={null} unit="text" valueText={`${subcatsCovered}/${SUBCAT_ORDER.length}`} label="Subcats covered" />
      </div>
      <BudgetUpload lastUploadAt={lastUpload} />
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
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' };
