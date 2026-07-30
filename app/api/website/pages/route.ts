// app/api/website/pages/route.ts
// website-module-v1 P3 — read/patch website.pages via public bridges.
// GET  ?property_id=  → list pages (v_website_pages)
// PATCH { page_id, patch } → public.fn_website_update_page (audited SECURITY DEFINER)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pid = Number(req.nextUrl.searchParams.get('property_id') || PROPERTY_ID);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_website_pages').select('*')
    .eq('property_id', pid)
    .order('nav_order', { ascending: true, nullsFirst: false })
    .order('slug', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pages: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  let body: { page_id?: number; patch?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  const pageId = Number(body.page_id);
  if (!pageId || !body.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ ok: false, error: 'page_id and patch required' }, { status: 400 });
  }
  // Slug renames are forbidden app-side (SEO mandate: 1:1 slugs). The bridge fn
  // ignores unknown keys, but reject explicitly for a clear error.
  if ('slug' in body.patch) {
    return NextResponse.json({ ok: false, error: 'slug is immutable (SEO mandate — use redirects)' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_update_page', {
    p_page_id: pageId, p_patch: body.patch, p_actor: 'website-editor',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; error?: string; updated_at?: string };
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'update failed' }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: res.updated_at ?? null });
}
