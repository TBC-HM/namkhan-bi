// lib/data-pos-unmatched.ts
//
// Charge-to-room reconciliation drill — reads the public bridge view
// `v_pos_unmatched_charge_room` (created 2026-05-15). Returns every Poster
// receipt that needs controller investigation: either no Cloudbeds match,
// or a match with a $ delta. The match algorithm pairs by Poster.client
// (room-type alias) + close date, so deltas can be wild without being
// tax / service-charge related — see bucket flag.

import { supabase } from './supabase';

export interface PosUnmatchedReceipt {
  receipt_id: number;
  close_at: string | null;
  close_date: string | null;
  month_yyyymm: string;
  poster_client: string | null;
  order_total: number;
  service_charge: number;
  taxes: number;
  paid: number;
  cb_reservation_id: string | null;
  cb_match_amount: number;
  cb_match_delta: number | null;
  bucket: 'no_cb_match' | 'amount_mismatch';
  status: string | null;
  payment_method: string | null;
  table_label: string | null;
  waiter: string | null;
  reconciled: boolean | null;
  reconciled_at: string | null;
}

export async function getPosUnmatchedChargeRoom(limit = 2000): Promise<PosUnmatchedReceipt[]> {
  const { data, error } = await supabase
    .from('v_pos_unmatched_charge_room')
    .select(
      'receipt_id, close_at, close_date, month_yyyymm, poster_client, order_total, service_charge, taxes, paid, cb_reservation_id, cb_match_amount, cb_match_delta, bucket, status, payment_method, table_label, waiter, reconciled, reconciled_at',
    )
    .order('close_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PosUnmatchedReceipt[];
}
