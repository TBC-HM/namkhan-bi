// app/api/website/sections/route.ts
// website-module-v1 P3 — read/patch website.sections via public bridges.
// GET  ?page_id=  → sections of a page (v_website_sections)
// PATCH { section_id, patch } → public.fn_website_update_section (audited)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pageId = Number(req.nextUrl.searchParams.get('page_id'));
  if (!pageId) return NextResponse.json({ ok: false, error: 'page_id required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_website_sections').select('*')
    .eq('page_id', pageId)
    .order('sort_order', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sections: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  let body: { section_id?: number; patch?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  const sectionId = Number(body.section_id);
  if (!sectionId || !body.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ ok: false, error: 'section_id and patch required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_update_section', {
    p_section_id: sectionId, p_patch: body.patch, p_actor: 'website-editor',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; error?: string; updated_at?: string };
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'update failed' }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: res.updated_at ?? null });
}
