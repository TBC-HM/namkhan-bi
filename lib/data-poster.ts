// lib/data-poster.ts
// /finance/poster page data — every aggregation runs in Postgres via RPCs in
// the public schema. The page never pulls more than the receipt rows it actually
// renders. RPCs are defined in migrations:
//   poster_aggregation_rpcs_v1
//   poster_recent_explicit_columns

import { supabase } from './supabase';

export interface PosterReceipt {
  receipt_id: number;
  application: string | null;
  order_source: string | null;
  table_label: string | null;
  floor_area: string | null;
  waiter: string | null;
  open_at: string | null;
  close_at: string | null;
  total_time_text: string | null;
  location: string | null;
  client: string | null;
  customer_group: string | null;
  customers_count: number | null;
  order_total: number | null;
  paid: number | null;
  cash: number | null;
  card: number | null;
  service_charge: number | null;
  taxes: number | null;
  order_discount: number | null;
  order_promotions: number | null;
  status: string | null;
  payment_method: string | null;
  reconciled: boolean | null;
  reconciled_with: string | null;
  cb_reservation_id: string | null;
  cb_match_amount: number | null;
  cb_match_delta: number | null;
}

export interface PosterPeriodTotals {
  receipts_total: number;
  closed_n: number;
  open_n: number;
  deleted_n: number;
  canceled_n: number;
  order_usd: number;
  paid_usd: number;
  service_charge_usd: number;
  taxes_usd: number;
  discount_usd: number;
  earliest: string | null;
  latest: string | null;
}

export interface PosterMethodTotal {
  payment_method: string;
  closed_n: number;
  open_n: number;
  deleted_n: number;
  order_usd: number;
  paid_usd: number;
}

export interface PosterTopRow {
  bucket: string;
  receipts: number;
  order_usd: number;
}

const EMPTY_TOTALS: PosterPeriodTotals = {
  receipts_total: 0, closed_n: 0, open_n: 0, deleted_n: 0, canceled_n: 0,
  order_usd: 0, paid_usd: 0, service_charge_usd: 0, taxes_usd: 0, discount_usd: 0,
  earliest: null, latest: null,
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getPosterPeriodTotals(fromIso: string, toIso: string): Promise<PosterPeriodTotals> {
  const { data, error } = await supabase
    .rpc('poster_period_totals', { p_from: fromIso, p_to: toIso });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return EMPTY_TOTALS;
  const r = (Array.isArray(data) ? data[0] : data) as any;
  return {
    receipts_total:     num(r.receipts_total),
    closed_n:           num(r.closed_n),
    open_n:             num(r.open_n),
    deleted_n:          num(r.deleted_n),
    canceled_n:         num(r.canceled_n),
    order_usd:          num(r.order_usd),
    paid_usd:           num(r.paid_usd),
    service_charge_usd: num(r.service_charge_usd),
    taxes_usd:          num(r.taxes_usd),
    discount_usd:       num(r.discount_usd),
    earliest:           r.earliest ?? null,
    latest:             r.latest ?? null,
  };
}

export async function getPosterByMethod(fromIso: string, toIso: string): Promise<PosterMethodTotal[]> {
  const { data, error } = await supabase
    .rpc('poster_by_method', { p_from: fromIso, p_to: toIso });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    payment_method: String(r.payment_method ?? '(null)'),
    closed_n:  num(r.closed_n),
    open_n:    num(r.open_n),
    deleted_n: num(r.deleted_n),
    order_usd: num(r.order_usd),
    paid_usd:  num(r.paid_usd),
  }));
}

async function topBucket(field: 'order_source' | 'waiter' | 'floor_area' | 'client', fromIso: string, toIso: string, limit = 10): Promise<PosterTopRow[]> {
  const { data, error } = await supabase
    .rpc('poster_top_bucket', { p_field: field, p_from: fromIso, p_to: toIso, p_limit: limit });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    bucket:    String(r.bucket ?? '(unknown)'),
    receipts:  num(r.receipts),
    order_usd: num(r.order_usd),
  }));
}

export const getPosterTopSources = (fromIso: string, toIso: string, n = 10) => topBucket('order_source', fromIso, toIso, n);
export const getPosterTopWaiters = (fromIso: string, toIso: string, n = 10) => topBucket('waiter',       fromIso, toIso, n);
export const getPosterTopAreas   = (fromIso: string, toIso: string, n = 10) => topBucket('floor_area',   fromIso, toIso, n);

export interface PosterReconcileSummary {
  charge_room_n: number;
  matched_green_n: number;
  matched_amber_n: number;
  amount_mismatch_n: number;
  no_cb_lines_n: number;
  ambiguous_room_n: number;
  no_match_n: number;
  charge_room_order_usd: number;
  matched_green_order_usd: number;
  cb_total_matched_usd: number;
  reconciled_at: string | null;
}

export async function getPosterReconcileSummary(fromIso: string, toIso: string): Promise<PosterReconcileSummary> {
  const { data, error } = await supabase
    .rpc('poster_reconcile_summary', { p_from: fromIso, p_to: toIso });
  const empty: PosterReconcileSummary = {
    charge_room_n: 0, matched_green_n: 0, matched_amber_n: 0,
    amount_mismatch_n: 0, no_cb_lines_n: 0, ambiguous_room_n: 0, no_match_n: 0,
    charge_room_order_usd: 0, matched_green_order_usd: 0, cb_total_matched_usd: 0,
    reconciled_at: null,
  };
  if (error || !data || (Array.isArray(data) && data.length === 0)) return empty;
  const r = (Array.isArray(data) ? data[0] : data) as any;
  return {
    charge_room_n:           num(r.charge_room_n),
    matched_green_n:         num(r.matched_green_n),
    matched_amber_n:         num(r.matched_amber_n),
    amount_mismatch_n:       num(r.amount_mismatch_n),
    no_cb_lines_n:           num(r.no_cb_lines_n),
    ambiguous_room_n:        num(r.ambiguous_room_n),
    no_match_n:              num(r.no_match_n),
    charge_room_order_usd:   num(r.charge_room_order_usd),
    matched_green_order_usd: num(r.matched_green_order_usd),
    cb_total_matched_usd:    num(r.cb_total_matched_usd),
    reconciled_at:           r.reconciled_at ?? null,
  };
}

export interface PosterVsCbMonth {
  month_yyyymm: string;
  poster_room_n: number;
  poster_room_usd: number;
  poster_total_usd: number;
  cb_fnb_n: number;
  cb_fnb_usd: number;
  delta_usd: number;
  match_pct: number | null;
}

export async function getPosterVsCbMonthly(): Promise<PosterVsCbMonth[]> {
  const { data, error } = await supabase.rpc('poster_vs_cb_monthly');
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    month_yyyymm:     String(r.month_yyyymm),
    poster_room_n:    num(r.poster_room_n),
    poster_room_usd:  num(r.poster_room_usd),
    poster_total_usd: num(r.poster_total_usd),
    cb_fnb_n:         num(r.cb_fnb_n),
    cb_fnb_usd:       num(r.cb_fnb_usd),
    delta_usd:        num(r.delta_usd),
    match_pct:        r.match_pct == null ? null : Number(r.match_pct),
  }));
}

export interface PosterReportFindings {
  unmatchable_clients_n: number;
  unmatchable_clients_usd: number;
  ambiguous_room_n: number;
  ambiguous_room_usd: number;
  unaliased_distinct_clients: number;
  alias_review_n: number;
  amount_mismatch_n: number;
  amount_mismatch_usd: number;
  no_cb_lines_n: number;
  no_cb_lines_usd: number;
  open_receipts_n: number;
  open_receipts_usd: number;
  deleted_receipts_n: number;
  deleted_receipts_usd: number;
  without_payment_n: number;
  without_payment_usd: number;
  internal_n: number;
  internal_usd: number;
  charge_room_total_n: number;
  charge_room_total_usd: number;
  matched_green_n: number;
  matched_green_usd: number;
  reconciled_at: string | null;
}

export interface PosterFindingDrillRow {
  month_yyyymm: string;
  n: number;
  usd: number;
}

export type PosterFindingKind =
  | 'unmatchable' | 'ambiguous_room' | 'amount_mismatch' | 'no_cb_lines'
  | 'open_receipts' | 'deleted_receipts' | 'without_payment' | 'internal';

export async function getPosterFindingDrilldown(kind: PosterFindingKind): Promise<PosterFindingDrillRow[]> {
  const { data, error } = await supabase.rpc('poster_finding_drilldown', { p_kind: kind });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    month_yyyymm: String(r.month_yyyymm),
    n: num(r.n),
    usd: num(r.usd),
  }));
}

export interface PosterFindingReceipt {
  receipt_id: number;
  open_at: string | null;
  close_at: string | null;
  order_source: string | null;
  table_label: string | null;
  poster_client: string | null;
  order_total: number | null;
  status: string | null;
  payment_method: string | null;
  cb_reservation_id: string | null;
  cb_guest_name: string | null;
  cb_room_type: string | null;
  cb_room_no: string | null;
  cb_check_in: string | null;
  cb_check_out: string | null;
  in_house_at_close: boolean | null;
  reconciled_with: string | null;
}

export async function getPosterFindingReceipts(kind: PosterFindingKind, limit = 200): Promise<PosterFindingReceipt[]> {
  const { data, error } = await supabase.rpc('poster_finding_receipts', { p_kind: kind, p_limit: limit });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    receipt_id:        Number(r.receipt_id ?? 0),
    open_at:           r.open_at ?? null,
    close_at:          r.close_at ?? null,
    order_source:      r.order_source ?? null,
    table_label:       r.table_label ?? null,
    poster_client:     r.poster_client ?? null,
    order_total:       r.order_total != null ? Number(r.order_total) : null,
    status:            r.status ?? null,
    payment_method:    r.payment_method ?? null,
    cb_reservation_id: r.cb_reservation_id ?? null,
    cb_guest_name:     r.cb_guest_name ?? null,
    cb_room_type:      r.cb_room_type ?? null,
    cb_room_no:        r.cb_room_no ?? null,
    cb_check_in:       r.cb_check_in ?? null,
    cb_check_out:      r.cb_check_out ?? null,
    in_house_at_close: r.in_house_at_close ?? null,
    reconciled_with:   r.reconciled_with ?? null,
  }));
}

export async function getPosterReportFindings(): Promise<PosterReportFindings> {
  const { data, error } = await supabase.rpc('poster_report_findings');
  const empty: PosterReportFindings = {
    unmatchable_clients_n: 0, unmatchable_clients_usd: 0,
    ambiguous_room_n: 0, ambiguous_room_usd: 0,
    unaliased_distinct_clients: 0, alias_review_n: 0,
    amount_mismatch_n: 0, amount_mismatch_usd: 0,
    no_cb_lines_n: 0, no_cb_lines_usd: 0,
    open_receipts_n: 0, open_receipts_usd: 0,
    deleted_receipts_n: 0, deleted_receipts_usd: 0,
    without_payment_n: 0, without_payment_usd: 0,
    internal_n: 0, internal_usd: 0,
    charge_room_total_n: 0, charge_room_total_usd: 0,
    matched_green_n: 0, matched_green_usd: 0,
    reconciled_at: null,
  };
  if (error || !data || (Array.isArray(data) && data.length === 0)) return empty;
  const r = (Array.isArray(data) ? data[0] : data) as any;
  return {
    unmatchable_clients_n:      num(r.unmatchable_clients_n),
    unmatchable_clients_usd:    num(r.unmatchable_clients_usd),
    ambiguous_room_n:           num(r.ambiguous_room_n),
    ambiguous_room_usd:         num(r.ambiguous_room_usd),
    unaliased_distinct_clients: num(r.unaliased_distinct_clients),
    alias_review_n:             num(r.alias_review_n),
    amount_mismatch_n:          num(r.amount_mismatch_n),
    amount_mismatch_usd:        num(r.amount_mismatch_usd),
    no_cb_lines_n:              num(r.no_cb_lines_n),
    no_cb_lines_usd:            num(r.no_cb_lines_usd),
    open_receipts_n:            num(r.open_receipts_n),
    open_receipts_usd:          num(r.open_receipts_usd),
    deleted_receipts_n:         num(r.deleted_receipts_n),
    deleted_receipts_usd:       num(r.deleted_receipts_usd),
    without_payment_n:          num(r.without_payment_n),
    without_payment_usd:        num(r.without_payment_usd),
    internal_n:                 num(r.internal_n),
    internal_usd:               num(r.internal_usd),
    charge_room_total_n:        num(r.charge_room_total_n),
    charge_room_total_usd:      num(r.charge_room_total_usd),
    matched_green_n:            num(r.matched_green_n),
    matched_green_usd:          num(r.matched_green_usd),
    reconciled_at:              r.reconciled_at ?? null,
  };
}

export async function getPosterReceiptsRaw(fromIso: string, toIso: string, limit = 2000): Promise<PosterReceipt[]> {
  const { data, error } = await supabase
    .rpc('poster_recent', { p_from: fromIso, p_to: toIso, p_limit: limit });
  if (error || !data) return [];
  return data as PosterReceipt[];
}
