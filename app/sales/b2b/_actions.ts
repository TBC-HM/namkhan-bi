// app/sales/b2b/_actions.ts
// Server actions for B2B/DMC reconciliation.

'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

export interface ConfirmResult {
  ok: boolean;
  error?: string;
}

export async function confirmMapping(
  reservationId: string,
  contractId: string,
  meta: { source_name?: string | null; rate_plan?: string | null; total_amount?: number | null; check_in_date?: string | null } = {},
): Promise<ConfirmResult> {
  if (!reservationId || !contractId) return { ok: false, error: 'missing_args' };

  const { error } = await supabase
    .from('v_dmc_reservation_mapping')
    .upsert(
      {
        reservation_id: reservationId,
        contract_id: contractId,
        mapping_status: 'mapped_human',
        mapping_method: 'manual',
        source_name: meta.source_name ?? null,
        rate_plan: meta.rate_plan ?? null,
        total_amount: meta.total_amount ?? null,
        check_in_date: meta.check_in_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'reservation_id' },
    );

  if (error) {
    console.error('[confirmMapping]', error);
    return { ok: false, error: error.message };
  }

  revalidatePath('/sales/b2b/reconciliation');
  revalidatePath('/sales/b2b');
  revalidatePath('/sales/b2b/performance');
  return { ok: true };
}

export async function rejectMapping(reservationId: string): Promise<ConfirmResult> {
  if (!reservationId) return { ok: false, error: 'missing_args' };

  // Mark as not-DMC — uses a sentinel contract_id of NULL is not allowed by FK,
  // so we delete the row instead (= "back to unmapped"). Real "rejected_not_dmc"
  // status comes when full migration ships with nullable contract_id.
  const { error } = await supabase
    .from('v_dmc_reservation_mapping')
    .delete()
    .eq('reservation_id', reservationId);

  if (error) {
    console.error('[rejectMapping]', error);
    return { ok: false, error: error.message };
  }

  revalidatePath('/sales/b2b/reconciliation');
  return { ok: true };
}
