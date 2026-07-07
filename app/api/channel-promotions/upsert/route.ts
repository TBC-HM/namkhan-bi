// app/api/channel-promotions/upsert/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_channel_promotion_upsert', {
      p_property_id: Number(b.property_id),
      p_channel:     String(b.channel),
      p_promo_key:   String(b.promo_key),
      p_label:       String(b.label),
      p_is_active:   !!b.is_active,
      p_cost_pct:    b.cost_pct == null ? null : Number(b.cost_pct),
      p_cost_flat:   b.cost_flat == null ? null : Number(b.cost_flat),
      p_notes:       b.notes ?? '',
      p_updated_by:  'ui',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
