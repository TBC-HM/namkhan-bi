// app/holding/finance/costs/budgets/page.tsx
// Cost Budget Builder — Owner F3 scope: holding recurring + platform build budgets
// Monthly overview, budget vs actual vs forecast per MD §6.6 forecast structures.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BudgetMonthlyRow {
  month: string;
  scope_type: string;
  property_id: number | null;
  module_key: string | null;
  work_class: string | null;
  budget_usd: number | null;
  actual_usd: number;
  forecast_usd: number | null;
  variance_pct: number | null;
  variance_status: string | null;
  forecast_basis: string | null;
}

interface BudgetRow {
  budget_id: number;
  scope_type: string;
  property_id: number | null;
  module_key: string | null;
  period_start: string;
  period_end: string | null;
  budget_usd: number;
  version: number;
  approved_by: string | null;
  status: string;
}

const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;
const pct = (n: number | null | undefined): string =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;

export default async function CostBudgetsPage() {
  const sb = getSupabaseAdmin();
  
  const [monthlyRes, budgetRes] = await Promise.all([
    sb.from('v_costs_budget_monthly').select('*').order('month', { ascending: false }).limit(100),
    sb.from('v_costs_budgets').select('*').order('period_start', { ascending: false }),
  ]);

  const monthlyRows: BudgetMonthlyRow[] = monthlyRes.data ?? [];
  const budgetRows: BudgetRow[] = budgetRes.data ?? [];

  // Group monthly by month for summary
  const monthMap = new Map<string, BudgetMonthlyRow[]>();
  for (const row of monthlyRows) {
    const key = row.month;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(row);
  }

  // Calculate summaries per month
  const summaryRows = Array.from(monthMap.entries()).map(([month, rows]) => {
    const budget = rows.reduce((sum, r) => sum + (r.budget_usd ?? 0), 0);
    const actual = rows.reduce((sum, r) => sum + r.actual_usd, 0);
    const forecast = rows.reduce((sum, r) => sum + (r.forecast_usd ?? 0), 0);
    const variance_pct = budget > 0 ? ((actual - budget) / budget * 100) : null;
    return { 
      month: month.slice(0, 7), 
      budget: usd(budget), 
      actual: usd(actual), 
      forecast: usd(forecast), 
      variance_pct: pct(variance_pct) 
    };
  }).sort((a, b) => b.month.localeCompare(a.month));

  // Tiles: YTD actuals, total budget, variance
  const ytdActual = monthlyRows.reduce((sum, r) => sum + r.actual_usd, 0);
  const ytdBudget = monthlyRows.reduce((sum, r) => sum + (r.budget_usd ?? 0), 0);
  const ytdVariancePct = ytdBudget > 0 ? ((ytdActual - ytdBudget) / ytdBudget * 100) : null;

  const summaryChartCols: ChartSeries[] = [
    { key: 'budget', label: 'Budget' },
    { key: 'actual', label: 'Actual' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'variance_pct', label: 'Variance %' },
  ];

  const budgetChartRows = budgetRows.map(b => ({
    budget_id: b.budget_id,
    scope: b.scope_type,
    module: b.module_key ?? '(holding)',
    start: b.period_start.slice(0, 7),
    end: b.period_end?.slice(0, 7) ?? 'ongoing',
    budget: usd(b.budget_usd),
    ver: b.version,
    status: b.status,
    approved: b.approved_by ?? '—',
  }));

  const budgetChartCols: ChartSeries[] = [
    { key: 'scope', label: 'Scope' },
    { key: 'module', label: 'Module' },
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
    { key: 'budget', label: 'Budget' },
    { key: 'ver', label: 'Ver' },
    { key: 'status', label: 'Status' },
    { key: 'approved', label: 'Approved By' },
  ];

  const detailChartRows = monthlyRows.slice(0, 50).map(r => ({
    month: r.month.slice(0, 7),
    scope: r.scope_type,
    module: r.module_key ?? '(all)',
    work_class: r.work_class ?? '(all)',
    budget: usd(r.budget_usd),
    actual: usd(r.actual_usd),
    forecast: usd(r.forecast_usd),
    variance: pct(r.variance_pct),
    status: r.variance_status ?? '—',
    basis: r.forecast_basis ?? '—',
  }));

  const detailChartCols: ChartSeries[] = [
    { key: 'month', label: 'Month' },
    { key: 'scope', label: 'Scope' },
    { key: 'module', label: 'Module' },
    { key: 'work_class', label: 'Work Class' },
    { key: 'budget', label: 'Budget' },
    { key: 'actual', label: 'Actual' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'variance', label: 'Var %' },
    { key: 'status', label: 'Status' },
    { key: 'basis', label: 'Basis' },
  ];

  return (
    <DashboardPage
      title="Cost Budgets & Forecasts"
      subtitle="Holding recurring + platform build budgets (Owner F3) · Budget vs Actual vs Forecast · MD §6.6"
    >
      <Container title="YTD Summary">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiTile label="YTD Actual" value={usd(ytdActual)} footnote="All actuals YTD" />
          <KpiTile label="YTD Budget" value={usd(ytdBudget)} footnote="Approved budgets YTD (empty until budgets seeded)" />
          <KpiTile 
            label="YTD Variance" 
            value={ytdVariancePct != null ? `${ytdVariancePct > 0 ? '+' : ''}${ytdVariancePct.toFixed(1)}%` : '—'}
            footnote={ytdVariancePct != null && ytdVariancePct > 20 ? 'Over budget' : ytdVariancePct != null && ytdVariancePct < -20 ? 'Under budget' : ytdBudget === 0 ? 'No budgets defined yet' : 'Within range'}
          />
        </div>
      </Container>

      <Container 
        title="Monthly Budget vs Actual vs Forecast" 
        subtitle="Holding recurring costs + platform build costs · public.v_costs_budget_monthly"
      >
        <Chart variant="table" data={summaryRows} xKey="month" series={summaryChartCols} 
          empty={{ title: 'No budget data', hint: 'Create budgets in costs.budgets table to track variance' }} />
      </Container>

      <Container 
        title="Active Budgets" 
        subtitle="Approved budget entries · public.v_costs_budgets"
      >
        <Chart variant="table" data={budgetChartRows} xKey="budget_id" series={budgetChartCols}
          empty={{ title: 'No budgets defined', hint: 'Budgets are created in costs.budgets table. Owner to seed with holding recurring + platform build numbers (G2).' }} />
      </Container>

      <Container 
        title="Detailed Monthly View" 
        subtitle="Budget vs Actual by scope, module, work class · Last 50 months"
      >
        <Chart variant="table" data={detailChartRows} xKey="month" series={detailChartCols}
          empty={{ title: 'No monthly data' }} />
      </Container>
    </DashboardPage>
  );
}
