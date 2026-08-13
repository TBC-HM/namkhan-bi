// app/api/website/nav/route.ts
// website_module-owner-findings-v1 work-order item 1 — header nav menu editor API.
// Reads via public.v_website_nav_menus, writes via public.fn_website_upsert_nav_menu
// (SECURITY DEFINER bridge over website.nav_menus). Mirrors footer-links/route.ts.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MENU_KEY = 'header_main';

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_website_nav_menus')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .eq('menu_key', MENU_KEY)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ menu: data ?? null });
}

export async function POST(req: Request) {
  const sb = getSupabaseAdmin();
  const body = await req.json();

  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
  }
  for (const it of items) {
    const label = typeof it?.label === 'string' ? it.label.trim() : '';
    const href = typeof it?.href === 'string' ? it.href.trim() : '';
    if (!label) {
      return NextResponse.json({ error: 'every nav item needs a label' }, { status: 400 });
    }
    if (!href.startsWith('/')) {
      return NextResponse.json({ error: `nav item "${label}": href must start with /` }, { status: 400 });
    }
  }

  const { data, error } = await sb.rpc('fn_website_upsert_nav_menu', {
    p_property_id: PROPERTY_ID,
    p_menu_key: typeof body.menu_key === 'string' && body.menu_key ? body.menu_key : MENU_KEY,
    p_items: items.map((it: { label: string; href: string }) => ({
      label: String(it.label).trim(),
      href: String(it.href).trim(),
    })),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, menu: data ?? null });
}
