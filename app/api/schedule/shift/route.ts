import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { property_id, user_id, shift_date, action, template_id, status, notes, edit_reason } = await req.json();
    if (!property_id || !user_id || !shift_date || !action)
      return NextResponse.json({ error: 'property_id, user_id, shift_date, action required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_shift_cell_edit', {
      p_property_id: property_id,
      p_user_id: user_id,
      p_shift_date: shift_date,
      p_action: action,
      p_template_id: template_id ?? null,
      p_status: status ?? 'planned',
      p_notes: notes ?? null,
      p_edit_reason: edit_reason ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shift_id: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
