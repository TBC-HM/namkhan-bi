// lib/data-deposits.ts
// Reads the public bridge view `v_deposits_pipeline_with_contact` built
// 2026-05-15. Powers the Deposits tab on /finance/ledger.

import { supabase, PROPERTY_ID } from './supabase';

export interface DepositRow {
  property_id: number;
  reservation_id: string;
  guest_name: string | null;
  source_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  paid_amount: number;
  balance: number;
  days_until_arrival: number | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_id: string | null;
  status: string | null;
  // 2026-05-15 widened: rate plan + ADR + LOS for revenue-management drill
  rate_plan_name: string | null;
  nights: number | null;
  adr_usd: number | null;
  booking_total_usd: number | null;
}

export async function getDepositsPipeline(): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('v_deposits_pipeline_with_contact')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('check_in_date', { ascending: true });
  if (error || !data) return [];
  return data as DepositRow[];
}
