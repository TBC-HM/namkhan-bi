import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get('property_id');
  const { data, error } = await (supabase as any)
    .from('v_shift_templates_active')
    .select('id, code, name, start_time, end_time, break_min, dept_id')
    .eq('property_id', Number(pid))
    .order('code');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
