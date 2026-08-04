// app/api/settings/communications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { property_id, ...fields } = body;
    if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .schema('property')
      .from('communications')
      .upsert({ property_id, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'property_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
