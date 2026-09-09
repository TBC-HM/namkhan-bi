// app/holding/finance/pl/_lib/fetchPayload.ts
// Read path for the holding P&L. Brief holding-pl-v1 v2.
//
// CLIENT CHOICE (deviation from the brief's handoff reference file, deliberate):
// the handoff used createClient() from '@/lib/supabase/server'. That module's
// docstring says "anon" but it re-exports lib/supabase.ts, which resolves its
// key as `serviceKey ?? anonKey`. fn_holding_pl_payload and the four v_holding_*
// views are GRANTed to authenticated + service_role and REVOKEd from anon
// (ADR-277), so on the anon branch this page would render EMPTY rather than
// fail — the invariant-3 symptom. Every sibling page under
// app/holding/finance/* uses getSupabaseAdmin(); so does this one.
//
// Page access itself is enforced upstream: middleware 403s /holding for any
// session whose holding_role claim is empty.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  HoldingPlPayload, PlLineRow, ArAgeingRow, CashCollectedRow, PlMonthlyRow,
  HoldingBudgetPayload,
} from './types';

/**
 * Every read returns ok/error rather than a value, so a failure surfaces as an
 * error state on the page. Nothing in this module invents a fallback figure.
 */
// NOTE: deliberately a single shape, not a discriminated union. tsconfig has
// "strict": false, which disables narrowing on a boolean literal discriminant —
// `if (!r.ok)` would not narrow and `r.error` would not typecheck. Consumers
// check `!r.ok || !r.data` and render the error instead of any figure.
export type Fetched<T> = { ok: boolean; data: T | null; error: string | null };

/** Hard ceiling on drilldown rows; the UI says so when it bites. */
export const ROW_LIMIT = 2000;

export async function fetchHoldingPl(
  from: string | null,
  to: string | null,
): Promise<Fetched<HoldingPlPayload>> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_holding_pl_payload', {
      p_from: from,
      p_to: to,
    });
    if (error) return { ok: false, data: null, error: `fn_holding_pl_payload failed: ${error.message}` };
    if (!data) return { ok: false, data: null, error: 'fn_holding_pl_payload returned no payload.' };
    return { ok: true, data: data as HoldingPlPayload, error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export type LedgerFilters = {
  from: string;
  to: string;
  dept?: string | null;
  lineType?: string | null;
  /** 'draft' | 'estimate' | null — flag filters, not value filters. */
  flag?: string | null;
};

export async function fetchPlLines(f: LedgerFilters): Promise<Fetched<PlLineRow[]>> {
  try {
    const sb = getSupabaseAdmin();
    let q = sb
      .from('v_holding_pl_lines')
      .select('*')
      .gte('line_date', f.from)
      .lte('line_date', f.to)
      .order('line_date', { ascending: false })
      .limit(ROW_LIMIT);
    if (f.dept) q = q.eq('dept_code', f.dept);
    if (f.lineType) q = q.eq('line_type', f.lineType);
    if (f.flag === 'draft') q = q.eq('is_draft', true);
    if (f.flag === 'estimate') q = q.eq('is_estimate', true);
    const { data, error } = await q;
    if (error) return { ok: false, data: null, error: `v_holding_pl_lines failed: ${error.message}` };
    return { ok: true, data: (data ?? []) as PlLineRow[], error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchArAgeing(): Promise<Fetched<ArAgeingRow[]>> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_holding_ar_ageing')
      .select('*')
      .order('days_overdue', { ascending: false })
      .limit(ROW_LIMIT);
    if (error) return { ok: false, data: null, error: `v_holding_ar_ageing failed: ${error.message}` };
    return { ok: true, data: (data ?? []) as ArAgeingRow[], error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchCashCollected(
  from: string, to: string,
): Promise<Fetched<CashCollectedRow[]>> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_holding_cash_collected')
      .select('*')
      .gte('period_yyyymm', from.slice(0, 7).replace('-', ''))
      .lte('period_yyyymm', to.slice(0, 7).replace('-', ''))
      .order('period_yyyymm', { ascending: true })
      .limit(ROW_LIMIT);
    if (error) return { ok: false, data: null, error: `v_holding_cash_collected failed: ${error.message}` };
    return { ok: true, data: (data ?? []) as CashCollectedRow[], error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchPlMonthly(
  from: string, to: string,
): Promise<Fetched<PlMonthlyRow[]>> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_holding_pl_monthly')
      .select('*')
      .gte('period_yyyymm', from.slice(0, 7).replace('-', ''))
      .lte('period_yyyymm', to.slice(0, 7).replace('-', ''))
      .order('period_yyyymm', { ascending: true })
      .limit(ROW_LIMIT);
    if (error) return { ok: false, data: null, error: `v_holding_pl_monthly failed: ${error.message}` };
    return { ok: true, data: (data ?? []) as PlMonthlyRow[], error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Distinct line_type values in the period, so the Ledger filter offers the
 * values that actually exist instead of a list baked into the component.
 * Deliberately ignores the other filters — otherwise the dropdown would
 * collapse to whatever is already selected.
 */
export async function fetchLineTypes(from: string, to: string): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_holding_pl_lines')
      .select('line_type')
      .gte('line_date', from)
      .lte('line_date', to)
      .limit(ROW_LIMIT);
    if (error || !data) return [];
    return Array.from(new Set(
      (data as Array<{ line_type: string }>).map((r) => r.line_type).filter(Boolean),
    )).sort();
  } catch {
    return [];
  }
}

/**
 * Budget / forecast payload. Same contract as the P&L: the gold layer does the
 * arithmetic, the page only lays it out. Returns zeros and coverage.has_plan =
 * false when no plan exists — never a fabricated figure.
 */
export async function fetchHoldingBudget(
  from: string | null,
  to: string | null,
): Promise<Fetched<HoldingBudgetPayload>> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_holding_budget_payload', {
      p_from: from,
      p_to: to,
    });
    if (error) return { ok: false, data: null, error: `fn_holding_budget_payload failed: ${error.message}` };
    if (!data) return { ok: false, data: null, error: 'fn_holding_budget_payload returned no payload.' };
    return { ok: true, data: data as HoldingBudgetPayload, error: null };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}
