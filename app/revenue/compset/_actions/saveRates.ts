// app/revenue/compset/_actions/saveRates.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { FX_LAK_PER_USD } from '@/lib/format';

type Payload = { comp_id: string; stay_date: string; rate_usd: number };

export async function saveRates(rows: Payload[]) {
  if (!rows.length) return { saved: 0 };

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const upserts = rows.map((r) => ({
    comp_id: r.comp_id,
    stay_date: r.stay_date,
    shop_date: today,
    channel: 'booking.com',
    rate_usd: r.rate_usd,
    rate_lak: Math.round(r.rate_usd * FX_LAK_PER_USD),
    currency: 'USD',
    is_available: true,
    source: 'manual_owner_entry',
  }));

  // Public-schema RPC wraps the upsert into revenue.competitor_rates.
  // PostgREST won't route .schema('revenue') without that schema being
  // in db-schemas, so we go through a SECURITY DEFINER function.
  const { data, error } = await sb.rpc('save_competitor_rates', {
    p_rows: upserts,
  });

  if (error) {
    console.error('[saveRates] rpc save_competitor_rates failed', error);
    throw new Error(error.message);
  }

  revalidatePath('/revenue/compset');
  revalidatePath('/revenue/compset/manual');
  return { saved: (data as number) ?? rows.length };
}
