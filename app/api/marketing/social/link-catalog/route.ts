// app/api/marketing/social/link-catalog/route.ts
// Serves the internal link catalog for the quick-post link picker.
// Source: marketing.internal_link_catalog via public.v_marketing_internal_link_catalog.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, sp.get('property_id'));
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_marketing_internal_link_catalog')
    .select('id,title,url,section,anchor_hint,is_pinned')
    .eq('property_id', propertyId)
    .eq('active', true)
    .order('is_pinned', { ascending: false })
    .order('section')
    .order('title');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, links: data ?? [] });
}
