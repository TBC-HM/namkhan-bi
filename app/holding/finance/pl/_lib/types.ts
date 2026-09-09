// app/holding/finance/pl/_lib/types.ts
// Shape of public.fn_holding_pl_payload(p_from, p_to) and the four drilldown
// views. Brief holding-pl-v1 v2.
//
// dept_code is deliberately `string`, NOT a union of the codes that happen to
// exist today. The page iterates whatever the payload returns; a new department
// in holding.gl_entries must appear on the page without a code change.
// Same rule for ageing bucket keys and currency codes.

export type HoldingPlDept = {
  dept_code: string;
  dept_name: string;
  revenue_eur: number;
  direct_cost_eur: number;
  overhead_eur: number;
  margin_eur: number;
};

export type HoldingPlMonth = {
  period_yyyymm: string;
  revenue_eur: number;
  direct_cost_eur: number;
  overhead_eur: number;
};

export type HoldingPlPayload = {
  entity: string;
  /** Reporting layer (L15). Read from the payload — never assumed. */
  reporting_currency: string;
  basis: string;
  period: { from: string; to: string };
  generated_at: string;
  totals: {
    revenue_eur: number;
    revenue_draft_eur: number;
    direct_cost_eur: number;
    overhead_eur: number;
    ebitda_eur: number;
    estimated_cost_eur: number;
  };
  by_department: HoldingPlDept[];
  by_month: HoldingPlMonth[];
  ar: {
    open_total_eur: number;
    invoice_count: number;
    oldest_days_overdue: number;
    /** Bucket labels are data, not code. Render in the order returned. */
    buckets: Record<string, number>;
  };
  collected: { total_eur: number; invoice_count: number };
  data_quality: {
    estimated_cost_lines: number;
    source: string;
    fx_basis: string;
    no_cash_basis_cost: boolean;
  };
};

/** public.v_holding_pl_lines */
export type PlLineRow = {
  line_type: string;
  dept_code: string;
  account_code: string;
  account_name: string;
  dept_name: string;
  period_yyyymm: string;
  line_date: string;
  counterparty: string | null;
  source_ref: string | null;
  description: string | null;
  amount_native: number;
  currency_native: string;
  amount_eur: number | null;
  doc_status: string | null;
  is_draft: boolean;
  is_estimate: boolean;
};

/** public.v_holding_ar_ageing */
export type ArAgeingRow = {
  invoice_number: string;
  recipient_name: string;
  dept_code: string;
  subject: string | null;
  amount_native: number;
  currency: string;
  amount_eur: number | null;
  issued_at: string;
  due_at: string | null;
  days_overdue: number;
  ageing_bucket: string;
};

/** public.v_holding_cash_collected */
export type CashCollectedRow = {
  period_yyyymm: string;
  dept_code: string;
  currency: string;
  collected_native: number;
  collected_eur: number | null;
  invoice_count: number;
};

/** public.v_holding_pl_monthly */
export type PlMonthlyRow = {
  period_yyyymm: string;
  dept_code: string;
  dept_name: string;
  revenue_eur: number | null;
  revenue_draft_eur: number | null;
  direct_cost_eur: number | null;
  overhead_eur: number | null;
  dept_margin_eur: number | null;
  estimated_eur: number | null;
};

// ─── Budget / forecast (fn_holding_budget_payload) ────────────────────────
// Same conventions as the P&L payload: every dimension is a plain string so a
// new department or account appears without a code change, and no figure is
// ever defaulted in the component.

export type BudgetScenarioTotals = {
  revenue_eur: number;
  direct_cost_eur: number;
  overhead_eur: number;
  ebitda_eur: number;
};

export type BudgetMonthRow = {
  period_yyyymm: string;
  budget_revenue_eur: number;
  forecast_revenue_eur: number;
  actual_revenue_eur: number;
  budget_cost_eur: number;
  forecast_cost_eur: number;
  actual_cost_eur: number;
};

export type BudgetDeptRow = {
  dept_code: string;
  dept_name: string;
  budget_revenue_eur: number;
  actual_revenue_eur: number;
  budget_cost_eur: number;
  actual_cost_eur: number;
};

export type BudgetAccountRow = {
  dept_code: string;
  account_code: string;
  account_name: string;
  line_type: string;
  budget_eur: number;
  forecast_eur: number;
  actual_eur: number;
};

export type HoldingBudgetPayload = {
  entity: string;
  reporting_currency: string;
  basis: string;
  period: { from: string; to: string };
  generated_at: string;
  totals: {
    budget: BudgetScenarioTotals;
    forecast: BudgetScenarioTotals;
    actual: BudgetScenarioTotals;
  };
  by_month: BudgetMonthRow[];
  by_department: BudgetDeptRow[];
  by_account: BudgetAccountRow[];
  coverage: {
    budget_lines: number;
    forecast_lines: number;
    months_planned: number;
    has_plan: boolean;
  };
};
