// app/api/compiler/runs/[id]/itinerary/route.ts
// PATCH { variantId, day_structure } -> updates a variant's day_structure
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  _ctx: { params: { id: string } },
) {
  const admin = getSupabaseAdmin();
  const { variantId, day_structure } = await req.json().catch(() => ({}));
  if (!variantId || !Array.isArray(day_structure)) {
    return NextResponse.json({ error: 'variantId + day_structure required' }, { status: 400 });
  }
  const { error } = await admin
    .schema('compiler')
    .from('variants')
    .update({ day_structure })
    .eq('id', variantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
