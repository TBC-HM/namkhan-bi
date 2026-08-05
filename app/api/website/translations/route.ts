import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page_id = searchParams.get('page_id')
  const locale = searchParams.get('locale')

  if (!page_id) {
    return NextResponse.json({ error: 'page_id required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase
    .from('v_website_translations')
    .select('*')
    .eq('page_id', page_id)
    .eq('locale', locale || 'lo')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    page_id,
    section_id,
    property_id,
    locale,
    fields,
    status,
    translated_by
  } = body

  if (!page_id || !locale || !fields) {
    return NextResponse.json(
      { error: 'page_id, locale, and fields required' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase.rpc('fn_website_upsert_translation', {
    p_page_id: page_id,
    p_section_id: section_id || null,
    p_property_id: property_id || null,
    p_locale: locale,
    p_fields: fields,
    p_status: status || 'draft',
    p_translated_by: translated_by || null
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
