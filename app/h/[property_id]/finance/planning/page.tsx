// app/h/[property_id]/finance/planning/page.tsx
// FP&C Module v1 — Financial Planning & Control (brief module-financial-planning-control-v1).
//
// Budget → forecast → actual → variance on the QB P&L BY CLASS structure
// (ADR-159 fixed point), plus 13-week cash forward. GL layer = USD (ADR-173).
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   variance table  → public.v_budget_vs_actual_monthly
//   cash strip      → public.v_cash_forward_13w (every line names its source view)
//   narratives      → cockpit_tickets (intent='variance_narrative', awaits_user only)
//
// Namkhan-first (Donna deferred per brief §7); the page itself is property-scoped.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import NarrativeButton from './NarrativeButton';
import BudgetUpload from './BudgetUpload';
import DataPanel from '@/app/(cockpit)/_design/DataPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

interface VarianceRow {
  property_id: number;
  year_month: string;
  gl_class: string;
  class_name: string | null;
  budget_usd: number | null;
  budget_revenue_usd: number | null;
  budget_cost_usd: number | null;
  actual_revenue_usd: number | null;
  actual_cost_usd: number | null;
  budget_version: number | null;
  forecast_usd: number | null;
  actual_usd: number | null;
  is_final: boolean | null;
  var_abs: number | null;
  var_pct: number | null;
  currency_layer: string;
}

interface CashRow {
  property_id: number;
  week_start: string;
  week_idx: number;
  iso_week: string;
  line_order: number;
  line_key: string;
  line_label: string;
  source_view: string;
  amount_usd: number;
  currency_layer: string;
}

interface NarrativeTicket {
  id: number;
  created_at: string;
  email_subject: string | null;
  email_body: string | null;
  parsed_summary: string | null;
}

const usd = (n: number | null | undefined, dp = 0): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;

function statusFor(varPct: number | null): 'green' | 'amber' | 'red' | 'grey' {
  if (varPct == null) return 'grey';
  const a = Math.abs(varPct);
  if (a <= 5) return 'green';
  if (a <= 10) return 'amber';
  return 'red';
}

/** Thin labelled rule so the page reads as sections instead of one long stack. */
function SectionRule({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 -4px' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
        color: 'var(--ink-soft, #5a5a5a)', whiteSpace: 'nowrap',
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--hairline, #e6dfcc)' }} />
    </div>
  );
}

export default async function FinancePlanningPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { mo?: string };
}) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  const propertyLabel = KNOWN_LABEL[propertyId];

  const sb = getSupabaseAdmin();

  const [{ data: allVarRaw, error: varErr }, { data: cashRaw, error: cashErr }] = await Promise.all([
    sb.from('v_budget_vs_actual_monthly')
      .select('*')
      .eq('property_id', propertyId)
      .order('year_month', { ascending: true }),
    sb.from('v_cash_forward_13w')
      .select('*')
      .eq('property_id', propertyId)
      .order('week_idx', { ascending: true })
      .order('line_order', { ascending: true }),
  ]);
  if (varErr) throw new Error(`v_budget_vs_actual_monthly: ${varErr.message}`);
  if (cashErr) throw new Error(`v_cash_forward_13w: ${cashErr.message}`);

  const allVar = (allVarRaw ?? []) as VarianceRow[];
  const cash = (cashRaw ?? []) as CashRow[];

  const monthsWithActuals  = Array.from(new Set(allVar.filter((r) => r.actual_usd   != null).map((r) => r.year_month))).sort();
  // PBS 2026-09-06: chips labelled every month without actuals as "(fc)", including
  // July and August which have neither actuals (QB unposted) nor forecast (the engine
  // only runs forward). They advertised a forecast that does not exist.
  const monthsWithForecast = Array.from(new Set(allVar.filter((r) => r.forecast_usd != null).map((r) => r.year_month))).sort();
  const allMonths = Array.from(new Set(allVar.map((r) => r.year_month))).sort();
  const latestActualMonth = monthsWithActuals.length > 0 ? monthsWithActuals[monthsWithActuals.length - 1] : null;
  const selMonth =
    searchParams?.mo && allMonths.includes(searchParams.mo) ? searchParams.mo : latestActualMonth ?? allMonths[allMonths.length - 1] ?? null;

  const monthRows = allVar
    .filter((r) => r.year_month === selMonth)
    .sort((a, b) => (b.actual_usd ?? 0) - (a.actual_usd ?? 0));

  const budgetVersion = allVar.reduce<number | null>((mx, r) => (r.budget_version != null && (mx == null || r.budget_version > mx) ? r.budget_version : mx), null);

  // Narrative drafts (queue-only, awaits_user — never auto-published).
  const { data: ticketsRaw } = await sb
    .from('cockpit_tickets')
    .select('id, created_at, email_subject, email_body, parsed_summary')
    .eq('intent', 'variance_narrative')
    .eq('status', 'awaits_user')
    .contains('metadata', { property_id: propertyId })
    .order('created_at', { ascending: false })
    .limit(5);
  const tickets = (ticketsRaw ?? []) as NarrativeTicket[];

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  // PBS 2026-09-06: these summed budget_usd / actual_usd across every class, which adds
  // each department's REVENUE to its COSTS and then computes a variance on the total —
  // a number with no meaning. The table below already separates the two; the tiles now
  // do too. budget_usd/actual_usd are left untouched in the view for compatibility but
  // are not shown anywhere.
  const mBudgetRev = monthRows.reduce((s, r) => s + (r.budget_revenue_usd ?? 0), 0);
  const mActualRev = monthRows.reduce((s, r) => s + (r.actual_revenue_usd ?? 0), 0);
  const mBudgetCost = monthRows.reduce((s, r) => s + (r.budget_cost_usd ?? 0), 0);
  const mActualCost = monthRows.reduce((s, r) => s + (r.actual_cost_usd ?? 0), 0);
  const hasBudget    = monthRows.some((r) => r.budget_revenue_usd != null);
  const hasActualRev = monthRows.some((r) => r.actual_revenue_usd != null);
  const mVarPct = hasBudget && mBudgetRev !== 0
    ? ((mActualRev - mBudgetRev) / Math.abs(mBudgetRev)) * 100 : null;

  const opening = cash.find((c) => c.line_key === 'opening_balance');
  const closings = cash.filter((c) => c.line_key === 'closing_balance');
  const minClosing = closings.length > 0 ? closings.reduce((m, c) => (c.amount_usd < m.amount_usd ? c : m)) : null;

  const tiles: KpiTileProps[] = [
    {
      label: `Revenue · ${selMonth ?? '—'}`,
      value: hasActualRev ? usd(mActualRev) : '—',
      size: 'sm',
      status: hasActualRev ? 'green' : 'grey',
      footnote: hasBudget ? `budget ${usd(mBudgetRev)} · v${budgetVersion}` : 'no budget loaded',
    },
    {
      label: `Cost · ${selMonth ?? '—'}`,
      value: monthRows.some((r) => r.actual_cost_usd != null) ? usd(mActualCost) : '—',
      size: 'sm',
      // Over budget on cost is bad — the opposite reading to the revenue tile.
      status: mActualCost === 0 ? 'grey' : mActualCost > mBudgetCost ? 'red' : 'green',
      footnote: hasBudget ? `budget ${usd(mBudgetCost)}` : 'QB P&L by class (ADR-159)',
    },
    {
      label: 'Revenue vs budget',
      value: mVarPct == null ? '—' : `${mVarPct >= 0 ? '+' : ''}${mVarPct.toFixed(1)}%`,
      size: 'sm',
      status: statusFor(mVarPct),
      footnote: 'revenue only — costs in the tile alongside',
    },
    {
      label: 'Opening cash',
      value: opening ? usd(opening.amount_usd) : '—',
      size: 'sm',
      status: opening ? (opening.amount_usd > 0 ? 'green' : 'red') : 'grey',
      footnote: opening?.line_label ?? 'public.v_bank_account_balance',
    },
    {
      label: 'Lowest projected cash · 13w',
      value: minClosing ? usd(minClosing.amount_usd) : '—',
      size: 'sm',
      status: minClosing ? (minClosing.amount_usd > 0 ? 'green' : 'red') : 'grey',
      footnote: minClosing ? `week of ${minClosing.week_start}` : 'public.v_cash_forward_13w',
    },
  ];

  // ── Variance table ─────────────────────────────────────────────────────────
  // Revenue and cost are shown apart. The single Budget/Actual pair added them
  // together, so "Rooms 31,519" was room revenue PLUS front-office salary, OTA
  // commission, laundry and linen — neither revenue nor profit, and unactionable.
  const varianceRows = monthRows.map((r) => {
    const bRev = r.budget_revenue_usd, aRev = r.actual_revenue_usd;
    const bCost = r.budget_cost_usd,   aCost = r.actual_cost_usd;
    const revVar  = bRev  != null && aRev  != null && bRev  !== 0 ? ((aRev  - bRev)  / Math.abs(bRev))  * 100 : null;
    const costVar = bCost != null && aCost != null && bCost !== 0 ? ((aCost - bCost) / Math.abs(bCost)) * 100 : null;
    const pctTxt = (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    return {
      class: r.class_name ?? r.gl_class,
      bud_rev: usd(bRev),
      act_rev: usd(aRev),
      // revenue: over is good. cost: over is bad. Same arrow, opposite meaning.
      rev_var: pctTxt(revVar),
      bud_cost: usd(bCost),
      act_cost: usd(aCost),
      cost_var: pctTxt(costVar),
      forecast: usd(r.forecast_usd),
      status: revVar == null && costVar == null ? '·'
        : Math.max(Math.abs(revVar ?? 0), Math.abs(costVar ?? 0)) > 10 ? '●'
        : Math.max(Math.abs(revVar ?? 0), Math.abs(costVar ?? 0)) > 5 ? '◐' : '○',
    };
  });
  const varianceCols: ChartSeries[] = [
    { key: 'bud_rev',  label: 'Rev budget' },
    { key: 'act_rev',  label: 'Rev actual' },
    { key: 'rev_var',  label: 'Rev Δ%' },
    { key: 'bud_cost', label: 'Cost budget' },
    { key: 'act_cost', label: 'Cost actual' },
    { key: 'cost_var', label: 'Cost Δ%' },
    { key: 'forecast', label: 'Rooms fc' },
    { key: 'status',   label: '>10% = ●' },
  ];

  // ── Cash strip pivot (rows = lines, cols = weeks) ──────────────────────────
  const weeks = Array.from(new Set(cash.map((c) => c.week_idx))).sort((a, b) => a - b);
  const weekStarts = new Map(cash.map((c) => [c.week_idx, c.week_start.slice(5)]));
  const lineOrder = Array.from(new Map(cash.map((c) => [c.line_key, { order: c.line_order, label: c.line_label, source: c.source_view }])).entries())
    .sort((a, b) => a[1].order - b[1].order);
  const cashRows = lineOrder.map(([key, meta]) => {
    const row: Record<string, string> = { line: meta.label, source: meta.source };
    for (const w of weeks) {
      const cell = cash.find((c) => c.line_key === key && c.week_idx === w);
      row[`w${w}`] = cell ? usd(cell.amount_usd) : key === 'opening_balance' ? '' : '—';
    }
    return row;
  });
  const cashCols: ChartSeries[] = [
    ...weeks.map((w) => ({ key: `w${w}`, label: `W${w} · ${weekStarts.get(w) ?? ''}` })),
    { key: 'source', label: 'Source view' },
  ];

  const closingSeries = closings.map((c) => ({ week: `W${c.week_idx}`, closing: Math.round(c.amount_usd) }));

  return (
    <DashboardPage
      title={`Finance · Planning & Control · ${propertyLabel}`}
      subtitle={`budget vs actual by QB class (ADR-159) · 13-week cash forward · GL layer USD (ADR-173)${cash[0] ? '' : ' · no cash data'}`}
      tabs={financeSubPagesForProperty(propertyId).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/planning') }))}
    >
      <Container title="Planning headline" subtitle={selMonth ?? 'no month available'} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <SectionRule label="Control · budget vs actual" />

      <Container
        title={`Variance by class · ${selMonth ?? '—'}`}
        subtitle="budget = the approved FY plan · actual = QB P&L by class · forecast = rooms on-the-books (other classes pending)"
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
          {allMonths.map((m) => (
            <Link
              key={m}
              href={`/h/${propertyId}/finance/planning?mo=${m}`}
              style={{
                padding: '2px 10px', borderRadius: 12, textDecoration: 'none',
                border: '1px solid var(--hairline)',
                background: m === selMonth ? 'var(--primary)' : 'var(--paper)',
                color: m === selMonth ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              {m}{monthsWithActuals.includes(m) ? ''
                  : monthsWithForecast.includes(m) ? ' (fc)'
                  : ' (no data)'}
            </Link>
          ))}
        </div>
        <Chart
          variant="table"
          data={varianceRows}
          xKey="class"
          series={varianceCols}
          empty={{ title: 'No budget or actuals for this month', hint: 'Import a budget below to activate the variance loop' }}
        />
      </Container>

      <SectionRule label="Cash" />

      <Container
        title="13-week cash forward"
        subtitle={`${opening?.line_label ?? 'opening from public.v_bank_account_balance'} · settlement layer, USD-equivalent (ADR-173)`}
      >
        {closingSeries.length > 0 && (
          <Chart
            variant="line"
            data={closingSeries}
            xKey="week"
            yKey="closing"
            series={[{ key: 'closing', label: 'Projected closing balance USD' }]}
            height={200}
          />
        )}
        <Chart
          variant="table"
          data={cashRows}
          xKey="line"
          series={cashCols}
          empty={{ title: 'No cash-forward data', hint: 'public.v_cash_forward_13w returned no rows' }}
        />
      </Container>

      {/* ── Performance ─────────────────────────────────────────────────── */}
      <SectionRule label="Performance" />

      <DataPanel
        title="House summary · USALI by month"
        subtitle="finance.v_finance_house_summary · GL layer"
        view="v_finance_house_summary"
        columns={[
          { key: 'period_yyyymm', label: 'Period' },
          { key: 'total_revenue', label: 'Revenue', format: 'usd' },
          { key: 'total_dept_profit', label: 'Dept profit', format: 'usd' },
          { key: 'ag_total', label: 'A&G', format: 'usd' },
          { key: 'sales_marketing', label: 'Sales+Mkt', format: 'usd' },
          { key: 'pom', label: 'POM', format: 'usd' },
          { key: 'utilities', label: 'Utilities', format: 'usd' },
          { key: 'gop', label: 'GOP', format: 'usd' },
          { key: 'net_income', label: 'Net inc', format: 'usd' },
        ]}
        order_by={{ col: 'period_yyyymm', ascending: false }}
        limit={18}
      />

      <DataPanel
        title="Monthly revenue · CB Insights"
        subtitle="aggregated from insights.daily_revenue_cb (stock report 74)"
        view="v_monthly_revenue_cb"
        columns={[
          { key: 'month_key', label: 'Month' },
          { key: 'room_revenue_total', label: 'Room', format: 'usd' },
          { key: 'other_revenue_total', label: 'Other', format: 'usd' },
          { key: 'taxes_total', label: 'Taxes', format: 'usd' },
          { key: 'fees_total', label: 'Fees', format: 'usd' },
          { key: 'total_revenue', label: 'Total', format: 'usd' },
        ]}
        filter={{ col: 'property_id', eq: propertyId }}
        order_by={{ col: 'month_start', ascending: false }}
        limit={18}
      />

      {/* ── Cost control ────────────────────────────────────────────────── */}
      <SectionRule label="Cost control" />

      <DataPanel
        title="Top suppliers · current month"
        subtitle="where the money went"
        view="v_finance_top_suppliers"
        columns={[
          { key: 'rank_month', label: '#', format: 'int' },
          { key: 'vendor_name', label: 'Vendor' },
          { key: 'gross_spend_usd', label: 'Spend', format: 'usd' },
          { key: 'line_count', label: 'Lines', format: 'int' },
        ]}
        order_by={{ col: 'rank_month', ascending: true }}
        limit={15}
      />

      <DataPanel
        title="Discount & comp · last 6 months"
        subtitle="who gave away what · rows over $100 flagged"
        view="v_tx_comp_discount"
        columns={[
          { key: 'month', label: 'Month' },
          { key: 'usali_dept', label: 'Dept' },
          { key: 'user_name', label: 'User' },
          { key: 'line_count', label: 'Lines', format: 'int' },
          { key: 'comp_discount_value', label: 'Value', format: 'usd' },
        ]}
        filter={{ col: 'property_id', eq: propertyId }}
        order_by={{ col: 'month', ascending: false }}
        limit={40}
        highlight={{ key: 'comp_discount_value', above: 100 }}
      />

      <DataPanel
        title="Adjustments monitor · last 6 months"
        subtitle="voids and adjustments · gross over $500 flagged"
        view="v_tx_adjustments_monitor"
        columns={[
          { key: 'month', label: 'Month' },
          { key: 'adjustment_type', label: 'Type' },
          { key: 'posted_by', label: 'Posted by' },
          { key: 'adj_count', label: 'Count', format: 'int' },
          { key: 'net_amount', label: 'Net', format: 'usd' },
          { key: 'gross_abs_amount', label: 'Gross abs', format: 'usd' },
        ]}
        filter={{ col: 'property_id', eq: propertyId }}
        order_by={{ col: 'month', ascending: false }}
        limit={40}
        highlight={{ key: 'gross_abs_amount', above: 500 }}
      />

      {/* ── Reference ───────────────────────────────────────────────────── */}
      <SectionRule label="Reference" />

      <DataPanel
        title="Trial balance · monthly"
        subtitle="CB Accounting API · v_trial_balance_monthly_cb"
        view="v_trial_balance_monthly_cb"
        columns={[
          { key: 'month_key', label: 'Month' },
          { key: 'total_gl_charges', label: 'GL charges', format: 'usd' },
          { key: 'total_gl_activity', label: 'GL activity', format: 'usd' },
          { key: 'total_deposit_activity', label: 'Deposits', format: 'usd' },
          { key: 'total_ar_activity', label: 'AR', format: 'usd' },
          { key: 'total_activity', label: 'Total', format: 'usd' },
        ]}
        filter={{ col: 'property_id', eq: propertyId }}
        order_by={{ col: 'month_start', ascending: false }}
        limit={18}
      />

      <SectionRule label="Narrative" />

      <Container
        title="Monthly variance narrative"
        subtitle="drafted by the variance_narrative skill · lands as awaits_user ticket · never auto-published (§0.6)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NarrativeButton propertyId={propertyId} yearMonth={selMonth} />
          {tickets.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No narrative drafts awaiting review.</div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: 16, background: 'var(--paper)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {t.email_subject ?? `Draft #${t.id}`}
                  <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> · ticket #{t.id} · awaiting review</span>
                </div>
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', color: 'var(--ink)' }}>
                  {t.email_body ?? t.parsed_summary ?? ''}
                </pre>
              </div>
            ))
          )}
        </div>
      </Container>

      <SectionRule label="Maintain" />

      <Container title="Budget import" subtitle="xlsx → public.fn_budget_import · versioned append-forward · validates against finance.gl_classes">
        <BudgetUpload propertyId={propertyId} latestVersion={budgetVersion} latestVersionAt={null} />
      </Container>
    </DashboardPage>
  );
}
