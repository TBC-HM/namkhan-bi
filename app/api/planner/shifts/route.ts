import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const pid = p.get('property_id');
  const start = p.get('start');
  const end = p.get('end');
  const { data, error } = await (supabase as any)
    .from('v_schedule_planner')
    .select('shift_id, user_id, shift_date, template_code, template_name, status, is_published, notes, edit_reason')
    .eq('property_id', Number(pid))
    .gte('shift_date', start)
    .lte('shift_date', end)
    .order('shift_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
