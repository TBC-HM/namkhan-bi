import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const pid = p.get('property_id');
  const start = p.get('start');
  const end = p.get('end');
  const { data, error } = await (supabase as any)
    .from('v_schedule_dept_coverage')
    .select('dept_id, dept_name, dept_code, shift_date, shifts_scheduled, shifts_published, on_leave, total_staff')
    .eq('property_id', Number(pid))
    .gte('shift_date', start)
    .lte('shift_date', end)
    .order('dept_name').order('shift_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
