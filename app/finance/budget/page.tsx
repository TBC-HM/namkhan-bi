// app/finance/budget/page.tsx
// Finance · Budget — upload + view annual USALI budget.
// Reads gl.budgets aggregated by period × subcategory.
// Writes via /api/finance/budget/upload (CSV) which calls gl.upsert_budget_rows.

import { supabaseGl } from '@/lib/supabase-gl';
import BudgetUpload from './BudgetUpload';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  amount_usd: number;
}

const SUBCAT_ORDER = [
  'Revenue',
  'Cost of Sales',
  'Payroll & Related',
  'Other Operating Expenses',
  'A&G',
  'Sales & Marketing',
  'POM',
  'Utilities',
  'Mgmt Fees',
  'Depreciation',
  'Interest',
  'Income Tax',
  'FX Gain/Loss',
  'Non-Operating',
];

const MONTHS_2026 = [
  '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06',
  '2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
];

function fmtK(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
}

export default async function BudgetPage() {
  const { data: rows, error } = await supabaseGl
    .from('v_budget_lines')
    .select('period_yyyymm, usali_subcategory, amount_usd');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[budget] fetch', error);
  }

  const allRows = (rows ?? []) as BudgetRow[];
  const totalRows = allRows.length;

  // Aggregate to period × subcategory map
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

  const lastUpload = allRows
    .map((r: any) => r.uploaded_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Finance · Budget · 2026</div>
        <h1>USALI annual budget</h1>
        <p className="lead">
          Source: <code>plan.lines</code> · scenario <strong>Budget 2026 v1</strong> · 900 rows imported.
          Numbers below feed <a href="/finance/pnl">/finance/pnl</a> Budget / Δ Bgt / Flow columns + the 12-month bottom panel.
          To replace this budget, upload a new CSV (creates a new plan scenario) or edit <code>plan.lines</code> directly.
        </p>
      </header>

      <section className="kpi-strip">
        <div className="kpi"><div className="lbl">Budget rows in DB</div><div className="val">{totalRows}</div><div className="deltas neu">{totalRows === 0 ? 'no rows yet' : 'gl.budgets'}</div></div>
        <div className="kpi"><div className="lbl">Annual budget total</div><div className="val">{grand > 0 ? `$${(grand / 1000).toFixed(0)}k` : 'xx'}</div><div className="deltas neu">{grand > 0 ? 'sum of all rows' : 'awaiting upload'}</div></div>
        <div className="kpi"><div className="lbl">Months covered</div><div className="val">{MONTHS_2026.filter(m => (colSum.get(m) ?? 0) > 0).length} / 12</div><div className="deltas neu">2026</div></div>
        <div className="kpi"><div className="lbl">Subcats covered</div><div className="val">{SUBCAT_ORDER.filter(s => (rowSum.get(s) ?? 0) > 0).length} / {SUBCAT_ORDER.length}</div><div className="deltas neu">USALI</div></div>
      </section>

      <BudgetUpload lastUploadAt={lastUpload ?? null} />

      <section className="table-section">
        <h2>Current budget grid</h2>
        <p className="hint">Subcategory rows × month columns. 0 / blank = no row uploaded for that cell.</p>
        <div className="map-table-wrap">
          <table className="map-table">
            <thead>
              <tr>
                <th>USALI subcategory</th>
                {MONTHS_2026.map(m => <th key={m} className="num">{m.slice(5)}</th>)}
                <th className="num">FY total</th>
              </tr>
            </thead>
            <tbody>
              {SUBCAT_ORDER.map(s => (
                <tr key={s}>
                  <td><strong>{s}</strong></td>
                  {MONTHS_2026.map(m => {
                    const v = cell.get(`${m}|${s}`) ?? 0;
                    return <td key={m} className="num" style={v === 0 ? { color: 'var(--ink-mute, #8a8170)' } : {}}>{fmtK(v)}</td>;
                  })}
                  <td className="num"><strong>{fmtK(rowSum.get(s) ?? 0)}</strong></td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--line)' }}>
                <td><strong>Monthly total</strong></td>
                {MONTHS_2026.map(m => <td key={m} className="num"><strong>{fmtK(colSum.get(m) ?? 0)}</strong></td>)}
                <td className="num"><strong>{fmtK(grand)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .page { padding: 24px 28px 80px; max-width: 1480px; }
        .eyebrow { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-mute, #8a8170); }
        h1 { margin: 4px 0 8px; font-family: var(--font-display, 'Playfair Display', serif); font-weight: 500; font-size: 28px; }
        .lead { font-size: 14px; color: var(--ink-mute, #6a6353); max-width: 720px; line-height: 1.5; }
        .lead a { color: var(--green-2, #2e4a36); text-decoration: underline; }
        .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
        .kpi { background: var(--card, #fff); border: 1px solid var(--line, #e7e2d8); border-radius: 8px; padding: 14px 16px; }
        .kpi .lbl { font-size: 11px; color: var(--ink-mute, #8a8170); text-transform: uppercase; letter-spacing: .5px; }
        .kpi .val { font-size: 24px; font-weight: 600; margin: 4px 0 2px; }
        .kpi .deltas.neu { font-size: 12px; color: var(--ink-mute, #8a8170); }
        .table-section { margin: 32px 0; }
        .table-section h2 { font-family: var(--font-display); font-weight: 500; font-size: 20px; margin-bottom: 4px; }
        .table-section .hint { font-size: 13px; color: var(--ink-mute); margin: 0 0 12px; }
        .map-table-wrap { overflow-x: auto; border: 1px solid var(--line, #e7e2d8); border-radius: 8px; background: var(--card, #fff); }
        .map-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .map-table th { text-align: left; padding: 8px 10px; background: var(--surf-2, #f5f1e7); border-bottom: 1px solid var(--line, #e7e2d8); font-weight: 500; color: var(--ink-mute, #6a6353); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .map-table td { padding: 6px 10px; border-bottom: 1px solid var(--line-soft, #efeae0); }
        .map-table .num { text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
