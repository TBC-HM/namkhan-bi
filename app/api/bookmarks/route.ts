// app/api/bookmarks/route.ts
// GET    /api/bookmarks?q=&category=&lim=50      — search/list
// POST   /api/bookmarks  body: {url, title?, description?, category?, tags?, importance?}
// DELETE /api/bookmarks?id=<uuid>

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const category = searchParams.get('category');
  const lim = Math.min(200, parseInt(searchParams.get('lim') || '100'));

  let query = admin.schema('docs').from('bookmarks').select('*').eq('is_active', true);
  if (category) query = query.eq('category', category);
  if (q) {
    // simple ILIKE on title/url/description
    query = query.or(`title.ilike.%${q}%,url.ilike.%${q}%,description.ilike.%${q}%`);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(lim);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bookmarks: data || [], count: data?.length || 0 });
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: {
    url?: string; title?: string; description?: string;
    category?: string; tags?: string[]; importance?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.url || !/^https?:\/\//i.test(body.url)) {
    return NextResponse.json({ ok: false, error: 'url required, must start with http(s)://' }, { status: 400 });
  }

  // Auto-fallback title from URL host
  let title = (body.title || '').trim();
  if (!title) {
    try { title = new URL(body.url).hostname.replace(/^www\./,''); } catch { title = body.url; }
  }

  const row = {
    property_id: 260955,
    url: body.url.trim(),
    title,
    description: body.description?.trim() || null,
    category: body.category || 'reference',
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
    importance: body.importance && ['critical','standard','note','research','reference'].includes(body.importance)
                ? body.importance : 'standard',
    is_active: true,
  };

  const { data, error } = await admin.schema('docs').from('bookmarks')
    .upsert(row, { onConflict: 'property_id,url' })
    .select('*').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bookmark: data });
}

export async function DELETE(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
  const { error } = await admin.schema('docs').from('bookmarks').delete().eq('bookmark_id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
