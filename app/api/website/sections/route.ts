// app/api/website/sections/route.ts
// website-module-v1 P3 + CMS-2 — CRUD website.sections via public bridges
// GET    ?page_id=  → sections of a page (v_website_sections)
// POST   { page_id, kind, heading, body_md, data, sort_order } → fn_website_add_section
// PATCH  ?id= { kind, heading, body_md, data } → fn_website_update_section
// DELETE ?id= → fn_website_delete_section
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

export async function POST(req: NextRequest) {
  let body: { page_id?: number; kind?: string; heading?: string | null; body_md?: string | null; data?: Record<string, unknown> | null; sort_order?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  if (!body.page_id || !body.kind) {
    return NextResponse.json({ ok: false, error: 'page_id and kind required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_add_section', {
    p_page_id: body.page_id,
    p_kind: body.kind,
    p_heading: body.heading ?? null,
    p_body_md: body.body_md ?? null,
    p_data: body.data ?? null,
    p_sort_order: body.sort_order ?? null
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, section_id: data });
}

export async function PATCH(req: NextRequest) {
  const sectionId = Number(req.nextUrl.searchParams.get('id'));
  if (!sectionId) return NextResponse.json({ ok: false, error: 'id required in query' }, { status: 400 });
  
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_update_section', {
    p_section_id: sectionId, p_patch: body, p_actor: 'website-editor',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; error?: string; updated_at?: string };
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'update failed' }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: res.updated_at ?? null });
}

export async function DELETE(req: NextRequest) {
  const sectionId = Number(req.nextUrl.searchParams.get('id'));
  if (!sectionId) return NextResponse.json({ ok: false, error: 'id required in query' }, { status: 400 });
  
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_delete_section', { p_section_id: sectionId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
