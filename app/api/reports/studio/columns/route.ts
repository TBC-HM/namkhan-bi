// app/api/reports/studio/columns/route.ts
// Spreadsheet Studio v1 — column metadata for a whitelisted view
// (public.fn_studio_view_columns; whitelist enforced in SQL).

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const schema = url.searchParams.get('schema') === 'kpi' ? 'kpi' : 'public';
  const view = url.searchParams.get('view') ?? '';
  if (!/^v_[a-z0-9_]+$/.test(view)) {
    return NextResponse.json({ error: 'invalid view' }, { status: 400 });
  }
  const { data, error } = await supabase.rpc('fn_studio_view_columns', {
    p_schema: schema,
    p_view: view,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ columns: data ?? [] });
}
