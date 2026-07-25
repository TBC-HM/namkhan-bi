import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { property_id, dept_id, start_date, end_date, template_id, edit_reason } = await req.json();
    if (!property_id || !dept_id || !start_date || !end_date || !template_id)
      return NextResponse.json({ error: 'property_id, dept_id, start_date, end_date, template_id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_assign_dept_schedule', {
      p_property_id: property_id, p_dept_id: dept_id,
      p_start: start_date, p_end: end_date,
      p_template_id: template_id, p_status: 'scheduled',
      p_edit_reason: edit_reason ?? 'Bulk department assignment',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shifts_assigned: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
