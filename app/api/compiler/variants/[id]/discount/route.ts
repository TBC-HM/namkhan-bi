// app/api/compiler/variants/[id]/discount/route.ts
// PATCH { discount_usd } -> updates compiler.variants.operator_discount_usd

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { discount_usd } = await req.json().catch(() => ({}));
    const d = Math.max(0, Number(discount_usd) || 0);
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .schema('compiler')
      .from('variants')
      .update({ operator_discount_usd: d })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, discount_usd: d });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
