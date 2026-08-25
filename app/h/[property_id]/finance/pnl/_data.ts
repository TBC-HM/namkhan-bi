// app/h/[property_id]/finance/pnl/_data.ts
//
// Property-scoped P&L data layer — QuickBooks P&L AS-IS.
//
// ADR-159 (2026-07-20) killed USALI re-derivation: the QB export is the single
// source of truth and "USALI = presentation relabel only, amounts copied from QB".
// PBS 2026-08-25 extended that ruling to this page: take the USALI logic out and
// render the QB P&L as it arrives. This file therefore has NO USALI structure —
// no slug list, no hardcoded line order, no derived GOP/EBITDA formula. Accounts
// are grouped by their own QuickBooks type and printed in account-code order, so
// a new upload renders with no mapping step.
//
// Two bridges, joined here because neither carries the whole shape:
//   public.v_pl_monthly_by_property — qb_type, amount, labels (no row_type)
//   public.v_pl_statement           — row_type detail|computed (no qb_type)
// Both are property-scoped and closed to anon (ADR-277).
//
// WHY row_type MATTERS (ADR-115 + memory 443): Donna's 2025 gestoría file stores
// its own subtotals AS ACCOUNTS (GOP, EBITDA, Net Income, Revenue…). It is also
// double-loaded under two prefixes — hotel__hotel_revenue and
// hotel_p_l__hotel_revenue are the SAME EUR 6,432,635 — and hierarchical, so
// food_beverage__food_revenue sits inside food_beverage__revenue. Summing that
// file gives EUR 25.4M of "income" against EUR 6.43M of real revenue.
// The 2026 QB export has none of that: 246 flat leaf accounts that sum correctly.
// Hence totalsMode below: trust the file's own stored subtotals when it has them,
// sum the detail only when it does not. Never fabricate a total.

import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** A single P&L account line for one period, exactly as QuickBooks reports it. */
export interface QbPnlRow {
  period_yyyymm: string;
  account_id: string;
  /** Human label — usali_line_label when the source supplied one, else the account_id. */
  label: string;
  amount: number;
  /** QuickBooks account type, verbatim: Income | Expense | Expenses | Cost of Goods Sold | Other Expense … */
  qb_type: string;
  /** 'computed' = the source file stored this line as a subtotal account; never sum these. */
  row_type: 'detail' | 'computed';
  /** True when qb_type is a cost bucket (drives sign at render time). */
  isCost: boolean;
}

/** QB cost-type names seen across both Donna vintages. Income is everything else. */
const COST_TYPES = new Set([
  'expense', 'expenses', 'cost of goods sold', 'other expense', 'other expenses',
]);

export function isCostType(qbType: string | null | undefined): boolean {
  return COST_TYPES.has((qbType ?? '').trim().toLowerCase());
}

/**
 * Fetch every P&L account row for one property/year, as QuickBooks reports it.
 * No USALI filtering — whatever is in the table for that year comes back.
 */
export async function getQbPnlForYear(
  propertyId: number,
  year: string,
): Promise<QbPnlRow[]> {
  const supabase = createClient();

  const [amountsRes, typesRes] = await Promise.all([
    supabase
      .from('v_pl_monthly_by_property')
      .select('period_yyyymm, account_id, amount_usd, usali_line_label, qb_type')
      .eq('property_id', propertyId)
      .like('period_yyyymm', `${year}-%`),
    supabase
      .from('v_pl_statement')
      .select('period_yyyymm, account_id, row_type')
      .eq('property_id', propertyId)
      .like('period_yyyymm', `${year}-%`),
  ]);

  if (amountsRes.error || !amountsRes.data) {
    if (amountsRes.error) console.error('[finance.pnl] getQbPnlForYear amounts', amountsRes.error);
    return [];
  }
  // row_type is advisory: if v_pl_statement is unavailable we still render, treating
  // everything as detail. Losing the subtotal flag must never blank the page.
  if (typesRes.error) console.error('[finance.pnl] getQbPnlForYear row_type', typesRes.error);

  // row_type is stable per account (verified: 0 accounts carry both values),
  // so an account-level map is safe and cheaper than a per-period join.
  const rowTypeByAccount = new Map<string, 'detail' | 'computed'>();
  for (const r of (typesRes.data ?? []) as Array<{ account_id: string; row_type: string }>) {
    if (r.row_type === 'computed') rowTypeByAccount.set(r.account_id, 'computed');
    else if (!rowTypeByAccount.has(r.account_id)) rowTypeByAccount.set(r.account_id, 'detail');
  }

  type Raw = {
    period_yyyymm: string;
    account_id: string;
    amount_usd: number | string;
    usali_line_label: string | null;
    qb_type: string | null;
  };

  return (amountsRes.data as unknown as Raw[]).map((r) => {
    const qbType = r.qb_type ?? 'Uncategorised';
    return {
      period_yyyymm: r.period_yyyymm,
      account_id: r.account_id,
      label: r.usali_line_label ?? prettifyAccountId(r.account_id),
      amount: Number(r.amount_usd) || 0,
      qb_type: qbType,
      row_type: rowTypeByAccount.get(r.account_id) ?? 'detail',
      isCost: isCostType(qbType),
    };
  });
}

/**
 * The 2025 slug accounts read as `section__line`. Turn that into something a
 * human can scan without inventing a USALI hierarchy from it.
 */
function prettifyAccountId(accountId: string): string {
  if (!accountId.includes('__')) return accountId;
  const line = accountId.split('__').slice(1).join(' ');
  return line.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getAvailableYears(propertyId: number): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('v_pl_monthly_by_property')
    .select('period_yyyymm')
    .eq('property_id', propertyId);
  if (error || !data) return [];
  const years = new Set<string>();
  for (const r of data as Array<{ period_yyyymm: string }>) years.add(r.period_yyyymm.slice(0, 4));
  return Array.from(years).sort();
}

export async function getPropertyCurrency(propertyId: number): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_property_currency', { p_property_id: propertyId });
  if (error || data == null) {
    if (error) console.error('[finance.pnl] getPropertyCurrency', error);
    return 'USD';
  }
  return (data as string) || 'USD';
}

// ─── Totals ────────────────────────────────────────────────────────────
// Two shapes arrive in this table and they must be totalled differently.

export type TotalsMode = 'stored' | 'summed';

/**
 * 'stored'  — the file brought its own subtotal accounts. Summing the remaining
 *             rows is unsafe (duplicate prefixes + hierarchy), so we report only
 *             what the source itself asserts.
 * 'summed'  — flat leaf accounts (a normal QB export). Summing is correct.
 */
export function totalsModeFor(rows: QbPnlRow[]): TotalsMode {
  return rows.some((r) => r.row_type === 'computed') ? 'stored' : 'summed';
}

export interface PeriodTotals {
  income: number;
  cost: number;
  net: number;
  mode: TotalsMode;
  /** False when mode='stored' — the figures are not a sum of the rows above them. */
  sumsToRows: boolean;
}

/** Totals for a set of rows already filtered to the periods you want. */
export function totalsFor(rows: QbPnlRow[]): PeriodTotals {
  const mode = totalsModeFor(rows);
  if (mode === 'summed') {
    let income = 0;
    let cost = 0;
    for (const r of rows) {
      if (r.isCost) cost += r.amount;
      else income += r.amount;
    }
    return { income, cost, net: income - cost, mode, sumsToRows: true };
  }
  // Stored-subtotal file: report nothing we did not read off the source.
  return { income: NaN, cost: NaN, net: NaN, mode, sumsToRows: false };
}

/** Distinct periods present, ascending. */
export function periodsIn(rows: QbPnlRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.period_yyyymm))).sort();
}

/**
 * Group rows for one period into QB-type blocks, income first, then costs,
 * each block ordered by account_id — i.e. the order the chart of accounts
 * already implies (7xxxxxxx income, 6xxxxxxx expense for the Spanish PGC).
 */
export interface QbBlock {
  qb_type: string;
  isCost: boolean;
  rows: QbPnlRow[];
  /** Sum of detail rows in this block. Null when the block holds stored subtotals. */
  subtotal: number | null;
}

export function blocksForPeriods(rows: QbPnlRow[], periods: string[]): QbBlock[] {
  const inScope = rows.filter((r) => periods.includes(r.period_yyyymm));
  const byType = new Map<string, QbPnlRow[]>();
  for (const r of inScope) {
    const list = byType.get(r.qb_type);
    if (list) list.push(r);
    else byType.set(r.qb_type, [r]);
  }
  const blocks: QbBlock[] = [];
  for (const [qb_type, list] of byType) {
    const detail = list.filter((r) => r.row_type === 'detail');
    const hasComputed = list.length !== detail.length;
    blocks.push({
      qb_type,
      isCost: isCostType(qb_type),
      rows: list.sort((a, b) => a.account_id.localeCompare(b.account_id)),
      subtotal: hasComputed ? null : detail.reduce((s, r) => s + r.amount, 0),
    });
  }
  return blocks.sort((a, b) => {
    if (a.isCost !== b.isCost) return a.isCost ? 1 : -1;
    return a.qb_type.localeCompare(b.qb_type);
  });
}

/** Collapse rows to one amount per account across the given periods. */
export function annualByAccount(
  rows: QbPnlRow[],
  periods: string[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!periods.includes(r.period_yyyymm)) continue;
    out.set(r.account_id, (out.get(r.account_id) ?? 0) + r.amount);
  }
  return out;
}

export function periodsForYear(year: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m += 1) out.push(`${year}-${String(m).padStart(2, '0')}`);
  return out;
}
