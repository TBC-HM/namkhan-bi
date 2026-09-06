// app/finance/budget/page.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage chrome + Container sections +
// KpiTile headline + grid table preserved. Replaces the chrome-swap-only
// pass with the canonical Revenue-style surface.

import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
import { supabaseGl } from '@/lib/supabase-gl';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BudgetUpload from './BudgetUpload';
import BudgetGridClient, { type GridCell, type AccountRef } from './BudgetGridClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  amount_usd: number;
}

interface VsActualRow {
  period_yyyymm: string;
  usali_subcategory: string;
  actual_usd: number | null;
}

interface DetailRow {
  period_yyyymm: string;
  usali_subcategory: string;
  account_code: string;
  account_name: string | null;
  amount_usd: number | null;
  actual_usd: number | null;
}

// All 14 USALI subcategories the budget can carry. The previous list held 10, so
// rows uploaded as Mgmt Fees / Depreciation / Income Tax / Non-Operating were
// accepted by the API and then silently omitted from the grid and every total.
const SUBCAT_ORDER = ['Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses', 'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Mgmt Fees', 'Depreciation', 'Interest', 'FX Gain/Loss', 'Income Tax', 'Non-Operating'];
const MONTHS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function BudgetPage() {
  // v_budget_lines_detail lives in `public`, so it needs the default client rather than
  // the gl-scoped one. No property filter, matching gl.v_budget_lines above — only
  // Namkhan has budget scenarios, and this legacy page is Namkhan-only by construction.
  const [{ data: rows }, { data: vsActual }, { data: detailRows }] = await Promise.all([
    supabaseGl.from('v_budget_lines').select('period_yyyymm, usali_subcategory, amount_usd'),
    supabaseGl.from('v_budget_vs_actual').select('period_yyyymm, usali_subcategory, actual_usd'),
    getSupabaseAdmin()
      .from('v_budget_lines_detail')
      .select('period_yyyymm, usali_subcategory, account_code, account_name, amount_usd, actual_usd')
      .eq('period_year', 2026)
      .limit(5000),
  ]);

  const allRows = (rows ?? []) as BudgetRow[];
  const totalRows = allRows.length;
  const cell = new Map<string, number>();
  for (const r of allRows) {
    const k = `${r.period_yyyymm}|${r.usali_subcategory}`;
    cell.set(k, (cell.get(k) ?? 0) + Number(r.amount_usd || 0));
  }

  // Actuals, summed across usali_department. A month with no GL rows at all stays
  // null rather than 0, so an unposted month reads "—" instead of a -100% variance.
  const actual = new Map<string, number>();
  for (const r of ((vsActual ?? []) as VsActualRow[])) {
    if (r.actual_usd == null) continue;
    const k = `${r.period_yyyymm}|${r.usali_subcategory}`;
    actual.set(k, (actual.get(k) ?? 0) + Number(r.actual_usd));
  }
  // PBS 2026-06-17 #217 — Revenue and Costs MUST be separate.
  // v_budget_lines stores all amounts as positive (no sign convention), so
  // any total row that adds Revenue + Cost together is meaningless.
  // Net Income = Revenue - (Cost of Sales + every other expense subcategory).
  const REV_SUBCATS = new Set(['Revenue']);
  const revMonth = new Map<string, number>();
  const costMonth = new Map<string, number>();
  const rowSum = new Map<string, number>();
  let revTotal = 0;
  let costTotal = 0;
  for (const m of MONTHS_2026) {
    for (const s of SUBCAT_ORDER) {
      const v = cell.get(`${m}|${s}`) ?? 0;
      rowSum.set(s, (rowSum.get(s) ?? 0) + v);
      if (REV_SUBCATS.has(s)) {
        revMonth.set(m, (revMonth.get(m) ?? 0) + v);
        revTotal += v;
      } else {
        costMonth.set(m, (costMonth.get(m) ?? 0) + v);
        costTotal += v;
      }
    }
  }
  const netTotal = revTotal - costTotal;
  const monthsCovered = MONTHS_2026.filter((m) => ((revMonth.get(m) ?? 0) + (costMonth.get(m) ?? 0)) > 0).length;
  const subcatsCovered = SUBCAT_ORDER.filter((s) => (rowSum.get(s) ?? 0) > 0).length;
  const coveragePct = SUBCAT_ORDER.length > 0 ? (subcatsCovered / SUBCAT_ORDER.length) * 100 : 0;

  const subtitle = `plan.lines · Budget 2026 v1 · ${monthsCovered}/12 months · ${subcatsCovered}/${SUBCAT_ORDER.length} subcats`;

  const tabs = FINANCE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/finance/budget',
  }));

  // Grid payload: budget and actual per month × subcategory, serialisable for the
  // client component that owns the per-month expand.
  const gridCells: Record<string, GridCell> = {};
  for (const m of MONTHS_2026) {
    for (const s of SUBCAT_ORDER) {
      const k = `${m}|${s}`;
      gridCells[k] = { budget: cell.get(k) ?? 0, actual: actual.has(k) ? actual.get(k)! : null };
    }
  }

  // Account-level payload for the row drill-down. Accounts are ordered by FY budget,
  // then by actual — so an account with spend but no budget line still appears, which
  // is how unbudgeted spend becomes visible instead of hiding inside a subtotal.
  const detailCells: Record<string, GridCell> = {};
  const acctFy = new Map<string, { budget: number; actual: number }>();
  const acctName = new Map<string, string>();
  const acctSub = new Map<string, string>();
  for (const r of ((detailRows ?? []) as DetailRow[])) {
    if (!r.account_code) continue;
    const k = `${r.period_yyyymm}|${r.account_code}`;
    const b = Number(r.amount_usd ?? 0);
    const a = r.actual_usd == null ? null : Number(r.actual_usd);
    const prev = detailCells[k];
    detailCells[k] = {
      budget: (prev?.budget ?? 0) + b,
      actual: a == null ? (prev?.actual ?? null) : (prev?.actual ?? 0) + a,
    };
    acctName.set(r.account_code, r.account_name ?? r.account_code);
    acctSub.set(r.account_code, r.usali_subcategory);
    const fy = acctFy.get(r.account_code) ?? { budget: 0, actual: 0 };
    fy.budget += b;
    fy.actual += a ?? 0;
    acctFy.set(r.account_code, fy);
  }
  const accountsBySubcat: Record<string, AccountRef[]> = {};
  for (const [code, sub] of acctSub) {
    (accountsBySubcat[sub] ??= []).push({ code, name: acctName.get(code) ?? code });
  }
  for (const sub of Object.keys(accountsBySubcat)) {
    accountsBySubcat[sub].sort((x, y) => {
      const fx = acctFy.get(x.code)!, fy2 = acctFy.get(y.code)!;
      return (fy2.budget - fx.budget) || (fy2.actual - fx.actual);
    });
  }

  const tiles: KpiTileProps[] = [
    { label: 'Budget Revenue · FY', value: Math.round(revTotal), currency: 'USD', size: 'sm', footnote: 'Revenue subcat only', status: 'green' },
    { label: 'Budget Costs · FY', value: Math.round(costTotal), currency: 'USD', size: 'sm', footnote: 'all non-revenue subcategories', status: 'amber' },
    { label: 'Budget Net Income · FY', value: Math.round(netTotal), currency: 'USD', size: 'sm', footnote: 'Revenue − all cost subcats', status: netTotal > 0 ? 'green' : 'red' },
    { label: 'Months covered', value: `${monthsCovered}/12`, size: 'sm', footnote: 'months with ≥1 budget row' },
    { label: 'Subcats covered', value: `${subcatsCovered}/${SUBCAT_ORDER.length}`, size: 'sm', footnote: 'USALI subcategories with rows' },
    { label: 'Coverage %', value: `${coveragePct.toFixed(0)}%`, size: 'sm', status: coveragePct >= 80 ? 'green' : coveragePct >= 50 ? 'amber' : 'red' },
    { label: 'Budget rows', value: totalRows, size: 'sm', footnote: 'gl.v_budget_lines' },
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
        <Container title="Budget grid" subtitle="press + on a month for actual and variance · press ▸ on a row for its accounts" density="compact">
          <BudgetGridClient
            months={MONTHS_2026}
            subcats={SUBCAT_ORDER}
            cells={gridCells}
            revSubcats={['Revenue']}
            accountsBySubcat={accountsBySubcat}
            detailCells={detailCells}
          />
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
