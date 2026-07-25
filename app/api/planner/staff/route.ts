import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get('property_id');
  const { data, error } = await (supabase as any)
    .from('v_planner_staff')
    .select('user_id, full_name, position_title, dept_id, dept_name, dept_code, property_id')
    .eq('property_id', Number(pid))
    .order('dept_name')
    .order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
