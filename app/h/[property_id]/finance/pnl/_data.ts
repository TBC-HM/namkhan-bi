// app/h/[property_id]/finance/pnl/_data.ts
// Property-scoped P&L data layer reading finance.gl_pl_monthly + finance.gl_accounts
// directly (no MV stack). Pairs with the canonical /h/[property_id]/finance/pnl page.
//
// Currently wired for Donna (property_id=1000001) where 81 USALI line accounts were
// seeded 2026-05-14 with account_id pattern `{section_slug}__{line_slug}`.
// Namkhan rows in this table use Spanish PGC numeric codes — the existing
// /finance/pnl dashboard remains the canonical Namkhan surface.

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface PnlRow {
  period_yyyymm: string;
  account_id: string;
  amount: number;
  section_slug: string;
  line_label: string;
  qb_type: string;
}

// PostgREST exposes only `public` schema by default. We query through:
//   public.v_pl_monthly_by_property   — view over finance.gl_pl_monthly ⨝ finance.gl_accounts
//   public.fn_property_currency(p_id) — function reading core.properties.base_currency
// Both grant SELECT/EXECUTE to anon + authenticated + service_role.

export async function getPnlForYear(
  propertyId: number,
  year: string,
): Promise<PnlRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('v_pl_monthly_by_property')
    .select('period_yyyymm, account_id, amount_usd, usali_line_label, qb_type')
    .eq('property_id', propertyId)
    .like('period_yyyymm', `${year}-%`);
  if (error || !data) {
    if (error) console.error('[finance.pnl] getPnlForYear', error);
    return [];
  }
  type Raw = {
    period_yyyymm: string;
    account_id: string;
    amount_usd: number | string;
    usali_line_label: string | null;
    qb_type: string | null;
  };
  return (data as unknown as Raw[]).map((r) => {
    const parts = r.account_id.split('__');
    const sectionSlug = parts.length > 1 ? parts[0] : '';
    const lineLabel = r.usali_line_label
      ?? (parts.slice(1).join(' ').replace(/_/g, ' ') || r.account_id);
    return {
      period_yyyymm: r.period_yyyymm,
      account_id: r.account_id,
      amount: Number(r.amount_usd) || 0,
      section_slug: sectionSlug,
      line_label: lineLabel,
      qb_type: r.qb_type ?? '',
    };
  });
}

export async function getAvailableYears(propertyId: number): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('v_pl_monthly_by_property')
    .select('period_yyyymm')
    .eq('property_id', propertyId);
  if (error || !data) return [];
  const years = new Set<string>();
  for (const r of data as Array<{ period_yyyymm: string }>) {
    years.add(r.period_yyyymm.slice(0, 4));
  }
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

// ─── USALI structure for Donna's 81 USALI line slugs ──────────────────
// Order matches the PBS-expected USALI P&L flow:
//   Revenue → Departmental P/(L) → Undistributed → GOP → Mgmt/Royalty
//   → Income Before Non-Op → Non-Op → EBITDA → I/D/A → Net Income.

export interface UsaliRow {
  key: string;
  label: string;
  accountId: string;
  /** Indent depth (0=section header, 1=line, 2=sub-line). */
  depth: 0 | 1 | 2;
  /** Render style: 'section' bold, 'subtotal' bold+underline, 'line' plain. */
  style: 'section' | 'subtotal' | 'line';
}

export const USALI_STRUCTURE: UsaliRow[] = [
  // — Revenue block ————————————————————————————————————————————
  { key: 'rev-hotel',     label: 'Hotel Revenue',    accountId: 'hotel__hotel_revenue',                   depth: 0, style: 'section' },
  { key: 'rev-rooms',     label: 'Rooms Revenue',    accountId: 'rooms__rooms_revenue',                   depth: 1, style: 'line' },
  { key: 'rev-fb',        label: 'F&B Revenue',      accountId: 'food_beverage__revenue',                 depth: 1, style: 'line' },
  { key: 'rev-fb-food',   label: '— Food',           accountId: 'food_beverage__food_revenue',            depth: 2, style: 'line' },
  { key: 'rev-fb-bev',    label: '— Beverage',       accountId: 'food_beverage__beverage_revenue',        depth: 2, style: 'line' },
  { key: 'rev-fb-mini',   label: '— Minibar',        accountId: 'food_beverage__minibar_revenue',         depth: 2, style: 'line' },
  { key: 'rev-ood',       label: 'OOD Revenue',      accountId: 'other_operated_departments__ood_revenue', depth: 1, style: 'line' },
  { key: 'rev-misc',      label: 'Misc. Income',     accountId: 'hotel_p_l__miscellaneous_income',        depth: 1, style: 'line' },

  // — Departmental P/(L) ——————————————————————————————————————
  { key: 'dp-header',     label: 'Departmental P/(L)', accountId: '',                                     depth: 0, style: 'section' },
  { key: 'dp-rooms',      label: 'Rooms',            accountId: 'rooms__profit_loss',                     depth: 1, style: 'line' },
  { key: 'dp-fb',         label: 'F&B',              accountId: 'food_beverage__profit_loss',             depth: 1, style: 'line' },
  { key: 'dp-ood',        label: 'OOD',              accountId: 'other_operated_departments__profit_loss', depth: 1, style: 'line' },

  // — Undistributed costs ——————————————————————————————————————
  { key: 'und-header',    label: 'Undistributed (P/(L))', accountId: '',                                  depth: 0, style: 'section' },
  { key: 'und-ag',        label: 'A&G',              accountId: 'administrative_general__profit_loss',    depth: 1, style: 'line' },
  { key: 'und-sm',        label: 'Sales & Marketing', accountId: 'sales_marketing__profit_loss',          depth: 1, style: 'line' },
  { key: 'und-it',        label: 'IT Systems',       accountId: 'it_systems__profit_loss',                depth: 1, style: 'line' },
  { key: 'und-pom',       label: 'POM',              accountId: 'property_operations_maintenance__profit_loss', depth: 1, style: 'line' },
  { key: 'und-util',      label: 'Utilities',        accountId: 'utilities__profit_loss',                 depth: 1, style: 'line' },

  // — Profitability totals ————————————————————————————————————
  { key: 'gop',           label: 'Gross Operating Profit (GOP)', accountId: 'utilities__gross_operating_profit_gop', depth: 0, style: 'subtotal' },
  { key: 'mgmt',          label: 'Management Fees',  accountId: 'utilities__management_fees',             depth: 1, style: 'line' },
  { key: 'royalty',       label: 'Royalty Fee',      accountId: 'utilities__royalty_fee',                 depth: 1, style: 'line' },
  { key: 'inc-bef-nonop', label: 'Income before Non-Operating', accountId: 'utilities__income_before_non_operating_income_and_expenses', depth: 0, style: 'subtotal' },
  { key: 'nonop',         label: 'Non-Operating Income / (Expenses)', accountId: 'utilities__total_non_operating_income_and_expenses', depth: 1, style: 'line' },
  { key: 'ebitda',        label: 'EBITDA',           accountId: 'utilities__earnings_before_interest_taxes_depreciation_and_amortization', depth: 0, style: 'subtotal' },
  { key: 'ida',           label: 'Interest, Depreciation & Amortization', accountId: 'utilities__interest_depreciation_and_amortization', depth: 1, style: 'line' },
  { key: 'inc-bef-tax',   label: 'Income Before Tax', accountId: 'utilities__income_before_income_taxes',  depth: 0, style: 'subtotal' },
  { key: 'net',           label: 'Net Income',       accountId: 'utilities__net_income',                  depth: 0, style: 'subtotal' },
];

export function pickAmount(rows: PnlRow[], accountId: string, period?: string): number {
  if (!accountId) return 0;
  let total = 0;
  for (const r of rows) {
    if (r.account_id !== accountId) continue;
    if (period && r.period_yyyymm !== period) continue;
    total += r.amount;
  }
  return total;
}
