// app/api/website/translations/route.ts
// website-module-v1 CMS-3 — translation GET/POST (upsert via fn_website_upsert_translation)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page_id = searchParams.get('page_id');
  const section_id = searchParams.get('section_id');
  const locale = searchParams.get('locale');
  const property_id = searchParams.get('property_id');

  const sb = getSupabaseAdmin();
  let query = sb.from('v_website_translations').select('*');
  
  if (page_id) query = query.eq('page_id', page_id);
  if (section_id) query = query.eq('section_id', section_id);
  if (locale) query = query.eq('locale', locale);
  if (property_id) query = query.eq('property_id', property_id);

  const { data, error } = await query.order('section_id', { ascending: true });
  
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, translations: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { property_id, page_id, section_id, locale, fields, status } = body;

  if (!property_id || !locale || !fields) {
    return NextResponse.json({ ok: false, error: 'property_id, locale, fields required' }, { status: 400 });
  }
  if (!page_id && !section_id) {
    return NextResponse.json({ ok: false, error: 'page_id or section_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_upsert_translation', {
    p_property_id: property_id,
    p_page_id: page_id || null,
    p_section_id: section_id || null,
    p_locale: locale,
    p_fields: fields,
    p_status: status || 'draft'
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, translation_id: data });
}
