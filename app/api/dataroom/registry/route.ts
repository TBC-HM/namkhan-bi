// app/api/dataroom/registry/route.ts — picker search for the room view.
// Brief dataroom-module-v1 (research R3): documents via public.v_documents_registry,
// media via public.v_marketing_media_page. Both existing bridges — no new views.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const source = req.nextUrl.searchParams.get('source') === 'media' ? 'media' : 'docs';
  const sb = getSupabaseAdmin();

  if (source === 'media') {
    let query = sb.from('v_marketing_media_page')
      .select('asset_id,asset_type,mime_type,raw_path,master_path')
      .limit(30);
    if (q) query = query.or(`raw_path.ilike.%${q}%,master_path.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      results: (data ?? []).map((r) => ({
        id: r.asset_id,
        title: String(r.master_path ?? r.raw_path ?? r.asset_id).split('/').pop(),
        subtitle: `${r.asset_type ?? 'asset'} · ${r.mime_type ?? ''}`,
        kind: 'media_asset',
      })),
    });
  }

  let query = sb.from('v_documents_registry')
    .select('doc_id,title,doc_type,doc_subtype,file_name,mime,property_id,storage_path')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (q) query = query.or(`title.ilike.%${q}%,file_name.ilike.%${q}%,doc_type.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    results: (data ?? []).map((r) => ({
      id: r.doc_id,
      title: r.title ?? r.file_name ?? r.doc_id,
      subtitle: [r.doc_type, r.doc_subtype, r.property_id ? `prop ${r.property_id}` : 'holding']
        .filter(Boolean).join(' · '),
      kind: 'registry_doc',
      has_file: Boolean(r.storage_path),
    })),
  });
}
