// app/api/website/sections/reorder/route.ts
// website-module-v1 CMS-2 — reorder blocks within a page.
// POST {page_id, blocks: [{id, sort_order}]} → fn_website_reorder_sections
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { page_id, blocks } = body;
  if (!page_id || !Array.isArray(blocks)) {
    return NextResponse.json({ error: 'page_id and blocks array required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_reorder_sections', {
    p_page_id: page_id,
    p_sections: blocks,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
