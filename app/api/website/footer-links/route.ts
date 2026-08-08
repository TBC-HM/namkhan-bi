// app/api/website/footer-links/route.ts
// website-module-v1 CMS-4 — footer menu editor API
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_website_footer_links')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('column_group')
    .order('sort_order');
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

export async function POST(req: Request) {
  const sb = getSupabaseAdmin();
  const body = await req.json();
  
  const { data, error } = await sb.rpc('fn_website_upsert_footer_link', {
    p_id: body.id || null,
    p_property_id: PROPERTY_ID,
    p_label: body.label,
    p_path: body.path,
    p_column_group: body.column_group,
    p_sort_order: body.sort_order
  });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  
  const { error } = await sb.rpc('fn_website_delete_footer_link', {
    p_id: parseInt(id),
    p_property_id: PROPERTY_ID
  });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
