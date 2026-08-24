// app/api/governance/route-registry/route.ts
// brief route_canon_registry-v1 · D3 — read public.v_route_registry
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_route_registry')
    .select('*')
    .order('route_path');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routes: data ?? [] });
}
