// POST /api/recruitment/salary-band
// Body: { propertyId: number, positionTitle: string }
// → ops.fn_position_salary_band → jsonb

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { propertyId, positionTitle } = await req.json();
    if (!Number.isFinite(Number(propertyId)) || typeof positionTitle !== 'string' || positionTitle.trim().length === 0) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 });
    }
    const { data, error } = await supabase
      .schema('ops')
      .rpc('fn_position_salary_band', { p_property_id: Number(propertyId), p_position_title: positionTitle });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? {});
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
