import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { property_id, start_date, end_date, actor } = await req.json();
    if (!property_id || !start_date || !end_date)
      return NextResponse.json({ error: 'property_id, start_date, end_date required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_publish_schedule', {
      p_property: property_id,
      p_start: start_date,
      p_end: end_date,
      p_actor: actor ?? 'hr_manager',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shifts_published: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
