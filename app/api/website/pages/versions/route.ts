// app/api/website/pages/versions/route.ts
// website-module-v1 CMS-2 — page versions API (list versions for a page, create snapshot).
// GET ?page_id= → list versions via v_website_page_versions
// POST {page_id} → create version via fn_website_create_version
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('page_id');
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_website_page_versions')
    .select('*')
    .eq('page_id', parseInt(pageId, 10))
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { page_id } = body;
  if (!page_id) return NextResponse.json({ error: 'page_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_create_version', { p_page_id: page_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
