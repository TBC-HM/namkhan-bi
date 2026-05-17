// lib/data-bank.ts
//
// Bank-side data layer for /finance/ledger?tab=bank.
//
// Schema (Supabase):
//   bank.banks                   3 banks (BCEL, BFL, JDB)
//   bank.accounts                6 accounts (USD + LAK per bank)
//   bank.transactions            line items + FTS column
//   bank.descriptor_rules        regex → counterparty/category/GL hint
//   public.v_bank_cash_summary   per-account roll-up KPI source
//   public.bank_transactions     bridge view for PostgREST drill-down
//
// PBS 2026-05-15: every operational query is property-scoped to 260955 today;
// expand to tenant context once Beyond Circle multi-tenant ships.

import { getSupabaseAdmin } from './supabaseAdmin';

export interface BankAccountRow {
  account_id: string;
  bank_id: string;
  bank_name: string;
  currency: string;
  account_label: string;
  is_active: boolean | null;
  account_number: string | null;
  property_id: number;
}

export interface BankSummaryRow {
  account_id: string;
  bank_id: string;
  bank_name: string;
  currency: string;
  account_label: string;
  n_txn: number;
  inflow_usd: number;
  outflow_usd: number;
  net_usd: number;
  first_txn: string | null;
  last_txn: string | null;
  reconciled_n: number;
  unreconciled_n: number;
}

export interface BankTransactionRow {
  txn_id: number;
  account_id: string;
  bank_id: string;
  bank_name: string;
  account_label: string;
  currency: string;
  txn_date: string;
  value_date: string | null;
  amount: number;
  amount_usd: number | null;
  fx_rate: number | null;
  balance_after: number | null;
  descriptor_raw: string | null;
  counterparty: string | null;
  category: string | null;
  gl_account_hint: string | null;
  reconciled: boolean;
  reconciled_with: string | null;
  source_file: string | null;
  imported_at: string;
}

export interface BankView {
  accounts: BankAccountRow[];
  summary: BankSummaryRow[];
  recent: BankTransactionRow[];     // most recent 200 across all accounts
  totals: {
    n_txn: number;
    inflow_usd: number;
    outflow_usd: number;
    net_usd: number;
    reconciled_pct: number;         // 0..100
    accounts_with_data: number;
    accounts_empty: number;
  };
}

export async function getBankView(propertyId: number, opts?: {
  account?: string;
  q?: string;                       // full-text search query
  limit?: number;
}): Promise<BankView> {
  const sb = getSupabaseAdmin();
  const limit = opts?.limit ?? 200;

  const [accountsR, summaryR, recentR] = await Promise.all([
    sb.from('bank_accounts').select('*').eq('property_id', propertyId).order('account_id'),
    sb.from('v_bank_cash_summary').select('*').order('bank_id').order('currency'),
    (async () => {
      let q = sb.from('bank_transactions')
        .select('*')
        .order('txn_date', { ascending: false })
        .order('txn_id', { ascending: false })
        .limit(limit);
      if (opts?.account && opts.account !== 'all') q = q.eq('account_id', opts.account);
      // Note: simple ILIKE filter on descriptor_raw — FTS handled in a separate
      // RPC once we have ≥10k rows; this is plenty until then.
      if (opts?.q && opts.q.trim()) q = q.ilike('descriptor_raw', `%${opts.q.trim()}%`);
      return q;
    })(),
  ]);

  const accounts  = (accountsR.data ?? []) as BankAccountRow[];
  const summary   = (summaryR.data ?? []) as BankSummaryRow[];
  const recent    = (recentR.data ?? []) as BankTransactionRow[];

  const n_txn       = summary.reduce((s, r) => s + Number(r.n_txn || 0), 0);
  const inflow_usd  = summary.reduce((s, r) => s + Number(r.inflow_usd || 0), 0);
  const outflow_usd = summary.reduce((s, r) => s + Number(r.outflow_usd || 0), 0);
  const net_usd     = summary.reduce((s, r) => s + Number(r.net_usd || 0), 0);
  const reconciled  = summary.reduce((s, r) => s + Number(r.reconciled_n || 0), 0);
  const unreconciled= summary.reduce((s, r) => s + Number(r.unreconciled_n || 0), 0);
  const total       = reconciled + unreconciled;
  const reconciled_pct = total > 0 ? Math.round((reconciled / total) * 100) : 0;
  const accounts_with_data = summary.filter((r) => Number(r.n_txn || 0) > 0).length;
  const accounts_empty     = summary.length - accounts_with_data;

  return {
    accounts,
    summary,
    recent,
    totals: {
      n_txn, inflow_usd, outflow_usd, net_usd, reconciled_pct,
      accounts_with_data, accounts_empty,
    },
  };
}
