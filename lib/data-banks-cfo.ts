// lib/data-banks-cfo.ts
//
// CFO-grade roll-up for /finance/banks. Pulls from the canonical views built
// 2026-05-15:
//   public.v_bank_coverage_matrix   — per (account × month) presence flag
//   public.v_bank_monthly_flow      — monthly inflow/outflow per account
//   public.v_bank_top_counterparties
//   public.v_bank_account_balance   — opening + Σ txns, FX'd to USD
//
// FX: LAK→USD uses static 21,800 until fx.rates_daily is wired (memory:
// reference_namkhan_infrastructure).

import { getSupabaseAdmin } from './supabaseAdmin';

export const LAK_USD = 21_800;

export interface CoverageCell {
  account_id: string;
  bank_id: string;
  bank_name: string;
  currency: string;
  account_label: string;
  period_yyyymm: string;
  txn_count: number;
  inflow_usd: number;
  outflow_usd: number;
  net_usd: number;
  has_data: boolean;
}

export interface MonthlyFlowRow {
  period_yyyymm: string;
  bank_id: string;
  account_id: string;
  bank_name: string;
  currency: string;
  account_label: string;
  txn_count: number;
  inflow_usd: number;
  outflow_usd: number;
  net_usd: number;
}

export interface CounterpartyRow {
  counterparty: string;
  category: string;
  txn_count: number;
  inflow_usd: number;
  outflow_usd: number;
  net_usd: number;
}

export interface LookupRow {
  txn_id: number;
  account_id: string;
  bank_name: string;
  currency: string;
  txn_date: string;
  amount: number;
  amount_usd: number | null;
  descriptor_raw: string | null;
  counterparty: string | null;
  category: string | null;
  reconciled: boolean;
}

export interface ReconcileHealth {
  bank_credit_n: number;
  bank_credit_usd: number;
  matched_n: number;
  matched_usd: number;
  matched_pct: number;
  cb_payment_n: number;
  cb_payment_usd: number;
  candidates_n: number;
  high_confidence_n: number;
}

export interface ReconcileCandidate {
  bank_txn_id: number;
  bank_name: string;
  currency: string;
  bank_date: string;
  bank_amount_usd: number;
  descriptor_raw: string | null;
  counterparty: string | null;
  cb_txn_id: string;
  reservation_id: string | null;
  cb_date: string;
  cb_amount_usd: number;
  cb_method: string;
  cb_description: string | null;
  match_score: number;
  amount_delta_usd: number;
  day_delta: number;
}

export interface AccountBalanceRow {
  account_id: string;
  bank_id: string;
  bank_name: string;
  currency: string;
  account_label: string;
  opening_balance: number;
  opening_balance_date: string | null;
  n_txn: number;
  movement_native: number;
  movement_usd: number;
  balance_usd: number;
  last_txn_date: string | null;
}

export interface BanksCfoView {
  // Position
  balances: AccountBalanceRow[];
  totalCashUsd: number;
  usdCashUsd: number;     // USD-account positions in USD
  lakCashUsd: number;     // LAK positions FX'd to USD
  fxExposurePct: number;  // % of cash in LAK
  // Flow
  ytdInflowUsd: number;
  ytdOutflowUsd: number;
  ytdNetUsd: number;
  ytdReconciledPct: number;
  // Coverage
  coverage: CoverageCell[];          // 6 × 17 = 102 cells
  months: string[];                  // ordered period_yyyymm list
  coverageStats: {
    cells_total: number;
    cells_present: number;
    cells_missing: number;
    coverage_pct: number;
    accounts_with_any_data: number;
    accounts_empty: number;
  };
  // Series for charts
  monthlyFlow: MonthlyFlowRow[];     // for graph 2
  topCounterparties: CounterpartyRow[];  // top 10 for graph 3
}

// PBS 2026-05-16: propertyId-scoped. Default 260955 keeps the Namkhan page
// working as-is. /h/[property_id]/finance/banks passes 1000001 for Donna.
// All 4 views now expose property_id (rebuilt 2026-05-16 to join bank.accounts).
export async function getBanksCfoView(propertyId: number = 260955): Promise<BanksCfoView> {
  const sb = getSupabaseAdmin();

  const [coverageR, flowR, cpR, balR] = await Promise.all([
    sb.from('v_bank_coverage_matrix').select('*').eq('property_id', propertyId).order('account_id').order('period_yyyymm'),
    sb.from('v_bank_monthly_flow').select('*').eq('property_id', propertyId).order('period_yyyymm'),
    sb.from('v_bank_top_counterparties')
      .select('*')
      .eq('property_id', propertyId)
      .order('inflow_usd', { ascending: false, nullsFirst: false })
      .limit(20),
    sb.from('v_bank_account_balance').select('*').eq('property_id', propertyId).order('account_id'),
  ]);

  const coverage = (coverageR.data ?? []) as CoverageCell[];
  const monthly  = (flowR.data ?? [])     as MonthlyFlowRow[];
  const cp       = (cpR.data ?? [])       as CounterpartyRow[];
  const balances = (balR.data ?? [])      as AccountBalanceRow[];

  const months = Array.from(new Set(coverage.map((c) => c.period_yyyymm))).sort();
  const cells_total   = coverage.length;
  const cells_present = coverage.filter((c) => c.has_data).length;
  const cells_missing = cells_total - cells_present;
  const coverage_pct  = cells_total > 0 ? Math.round((cells_present / cells_total) * 100) : 0;
  const accounts_with_any_data = balances.filter((b) => Number(b.n_txn || 0) > 0).length;
  const accounts_empty = balances.length - accounts_with_any_data;

  // Position
  const totalCashUsd = balances.reduce((s, b) => s + Number(b.balance_usd || 0), 0);
  const usdCashUsd = balances.filter((b) => b.currency === 'USD').reduce((s, b) => s + Number(b.balance_usd || 0), 0);
  const lakCashUsd = balances.filter((b) => b.currency === 'LAK').reduce((s, b) => s + Number(b.balance_usd || 0), 0);
  const fxExposurePct = totalCashUsd !== 0 ? Math.round((lakCashUsd / totalCashUsd) * 100) : 0;

  // Flow YTD = sum of monthly views for current year
  const thisYear = new Date().toISOString().slice(0, 4);
  const ytd = monthly.filter((r) => r.period_yyyymm.startsWith(thisYear));
  const ytdInflowUsd  = ytd.reduce((s, r) => s + Number(r.inflow_usd  || 0), 0);
  const ytdOutflowUsd = ytd.reduce((s, r) => s + Number(r.outflow_usd || 0), 0);
  const ytdNetUsd     = ytdInflowUsd + ytdOutflowUsd; // outflow already negative
  // Reconciled% will need a separate query once we have data; placeholder 0.
  const ytdReconciledPct = 0;

  return {
    balances,
    totalCashUsd,
    usdCashUsd,
    lakCashUsd,
    fxExposurePct,
    ytdInflowUsd,
    ytdOutflowUsd,
    ytdNetUsd,
    ytdReconciledPct,
    coverage,
    months,
    coverageStats: {
      cells_total, cells_present, cells_missing, coverage_pct,
      accounts_with_any_data, accounts_empty,
    },
    monthlyFlow: monthly,
    topCounterparties: cp.filter((r) => r.counterparty && r.counterparty !== '— unresolved —').slice(0, 10).length > 0
      ? cp.filter((r) => r.counterparty && r.counterparty !== '— unresolved —').slice(0, 10)
      : cp.slice(0, 10),
  };
}

// ─── Lookup container · search + period + type filters ─────────────────
export interface LookupOpts {
  q?: string;
  period?: '30d' | '90d' | 'ytd' | 'all';
  type?: 'all' | 'in' | 'out';
  limit?: number;
}

export async function getBankLookup(opts: LookupOpts & { propertyId?: number }): Promise<LookupRow[]> {
  const sb = getSupabaseAdmin();
  const propertyId = opts.propertyId ?? 260955;
  const limit = opts.limit ?? 200;
  // Use bank_transactions view; if it lacks property_id, fall back to filtering
  // by account_id derived from bank.accounts. For now we filter via a sub-call
  // on bank_account_balance which is property-scoped.
  const { data: acctRows } = await sb.from('v_bank_account_balance').select('account_id').eq('property_id', propertyId);
  const acctIds = (acctRows ?? []).map((r: { account_id: string }) => r.account_id);
  let q = sb.from('bank_transactions')
    .select('txn_id, account_id, bank_name, currency, txn_date, amount, amount_usd, descriptor_raw, counterparty, category, reconciled')
    .in('account_id', acctIds.length > 0 ? acctIds : ['__none__'])
    .order('txn_date', { ascending: false })
    .order('txn_id', { ascending: false })
    .limit(limit);

  if (opts.q && opts.q.trim()) {
    const needle = `%${opts.q.trim()}%`;
    q = q.or(`descriptor_raw.ilike.${needle},counterparty.ilike.${needle},category.ilike.${needle}`);
  }

  const today = new Date();
  const sinceDate = (() => {
    if (opts.period === '30d') return new Date(today.getTime() - 30 * 86400000);
    if (opts.period === '90d') return new Date(today.getTime() - 90 * 86400000);
    if (opts.period === 'ytd') return new Date(today.getFullYear(), 0, 1);
    return null; // 'all'
  })();
  if (sinceDate) q = q.gte('txn_date', sinceDate.toISOString().slice(0, 10));

  if (opts.type === 'in')  q = q.gt('amount_usd', 0);
  if (opts.type === 'out') q = q.lt('amount_usd', 0);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as LookupRow[];
}

// ─── Reconcile health + candidates ─────────────────────────────────────
export async function getReconcileHealth(): Promise<ReconcileHealth> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_bank_reconcile_health').select('*').limit(1).maybeSingle();
  return (data as ReconcileHealth) ?? {
    bank_credit_n: 0, bank_credit_usd: 0, matched_n: 0, matched_usd: 0, matched_pct: 0,
    cb_payment_n: 0, cb_payment_usd: 0, candidates_n: 0, high_confidence_n: 0,
  };
}

export async function getReconcileCandidates(limit = 200): Promise<ReconcileCandidate[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_bank_cloudbeds_reconcile_candidates')
    .select('*')
    .order('match_score', { ascending: false })
    .order('bank_date', { ascending: false })
    .limit(limit);
  return (data ?? []) as ReconcileCandidate[];
}
