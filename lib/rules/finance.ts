// lib/rules/finance.ts v1
// PBS 2026-07-07: Finance HoD conclusion rules.
// Consumes operator-editable thresholds from public.guardrails (domain='finance').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface FinanceTargets {
  ap_late_days?: number;         // lte days — invoices older than this = flag
  ar_days_max?: number;          // lte days — receivables older = flag
  cash_days_min?: number;        // gte days — cash runway
  payroll_pct_target?: number;   // lte % of revenue
  gop_margin_target?: number;    // gte %
  variance_pl_pp?: number;       // lte pp — actual vs budget
}

export interface FinanceContext {
  currencySymbol: string;

  // Live data — nullable when the corresponding source hasn't been threaded yet
  cashDaysRunway: number | null;
  arOverdueDays: number | null;
  apOverdueDays: number | null;
  payrollPctRevenue: number | null;
  gopMarginPctMtd: number | null;
  variancePlPp: number | null;

  targets: FinanceTargets;
}

type Rule = (ctx: FinanceContext) => Insight | Insight[] | null;

const FB: Required<FinanceTargets> = {
  ap_late_days: 60,
  ar_days_max: 45,
  cash_days_min: 60,
  payroll_pct_target: 35,
  gop_margin_target: 30,
  variance_pl_pp: 5,
};
const T = (ctx: FinanceContext, k: keyof FinanceTargets) => ctx.targets[k] ?? FB[k];

// Rule 1 — Cash runway short
const ruleCashRunway: Rule = (ctx) => {
  if (ctx.cashDaysRunway == null) return null;
  const min = T(ctx, 'cash_days_min');
  if (ctx.cashDaysRunway >= min) return null;
  return {
    key: 'cash_runway_short',
    priority: ctx.cashDaysRunway < min * 0.5 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Cash runway ${ctx.cashDaysRunway} days — below ${min}-day floor`,
    body: 'Under the operator safety floor. Trigger AR collection push + defer non-essential AP where possible.',
    evidence: `Target ≥ ${min} days`,
    action: 'See banks →',
    href: '/finance/banks',
  };
};

// Rule 2 — AR aging blown
const ruleArOverdue: Rule = (ctx) => {
  if (ctx.arOverdueDays == null) return null;
  const max = T(ctx, 'ar_days_max');
  if (ctx.arOverdueDays <= max) return null;
  return {
    key: 'ar_overdue',
    priority: ctx.arOverdueDays > max * 2 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Oldest AR ${ctx.arOverdueDays} days — over ${max}-day ceiling`,
    body: 'Aging receivables tie up working capital and predict write-offs. Escalate the top 3 debtor accounts today.',
    evidence: `Ceiling ≤ ${max} days`,
    action: 'See ledger →',
    href: '/finance/ledger',
  };
};

// Rule 3 — AP overdue
const ruleApOverdue: Rule = (ctx) => {
  if (ctx.apOverdueDays == null) return null;
  const max = T(ctx, 'ap_late_days');
  if (ctx.apOverdueDays <= max) return null;
  return {
    key: 'ap_overdue',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Oldest AP ${ctx.apOverdueDays} days — over ${max}-day tolerance`,
    body: 'Aging supplier invoices damage trust + risk supply disruption. Check whether payment holds are intentional or slippage.',
    evidence: `Tolerance ≤ ${max} days`,
    action: 'See ledger →',
    href: '/finance/ledger',
  };
};

// Rule 4 — Payroll % of revenue high
const rulePayrollPct: Rule = (ctx) => {
  if (ctx.payrollPctRevenue == null) return null;
  const target = T(ctx, 'payroll_pct_target');
  if (ctx.payrollPctRevenue <= target) return null;
  return {
    key: 'payroll_pct_high',
    priority: ctx.payrollPctRevenue > target * 1.4 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Payroll ${ctx.payrollPctRevenue.toFixed(1)}% of revenue — above ${target}% ceiling`,
    body: 'Staff cost outpacing revenue = margin squeeze. Review headcount vs occupancy; check whether contract vs FTE mix has drifted.',
    evidence: `Ceiling ≤ ${target}%`,
    action: 'See HR →',
    href: '/finance/hr',
  };
};

// Rule 5 — GOP margin below target
const ruleGopMargin: Rule = (ctx) => {
  if (ctx.gopMarginPctMtd == null) return null;
  const target = T(ctx, 'gop_margin_target');
  if (ctx.gopMarginPctMtd >= target) return null;
  return {
    key: 'gop_margin_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `GOP margin MTD ${ctx.gopMarginPctMtd.toFixed(1)}% — below ${target}% target`,
    body: 'GOP is the operating-cash lever. If the gap widens, work backwards through payroll, F&B COGS, and utilities.',
    evidence: `Target ≥ ${target}%`,
    action: 'See P&L →',
    href: '/finance/pnl',
  };
};

// Rule 6 — Variance vs budget too wide
const ruleVarianceBudget: Rule = (ctx) => {
  if (ctx.variancePlPp == null) return null;
  const max = T(ctx, 'variance_pl_pp');
  if (Math.abs(ctx.variancePlPp) <= max) return null;
  return {
    key: 'budget_variance_wide',
    priority: 'warning',
    guardrail: 'fixed',
    title: `P&L variance ${ctx.variancePlPp > 0 ? '+' : ''}${ctx.variancePlPp.toFixed(1)}pp vs budget — over ${max}pp tolerance`,
    body: 'Either the budget was wrong or the operation drifted. Both matter — track which department carries the variance.',
    evidence: `Tolerance ≤ ${max}pp`,
    action: 'See budget →',
    href: '/finance/budget',
  };
};

const RULES: Rule[] = [
  ruleCashRunway,
  ruleArOverdue,
  ruleApOverdue,
  rulePayrollPct,
  ruleGopMargin,
  ruleVarianceBudget,
];

export function evaluateFinanceRules(ctx: FinanceContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of RULES) {
    try {
      const r = rule(ctx);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r);
      else out.push(r);
    } catch { /* silently skip broken rule */ }
  }
  return out;
}
