// app/api/marketing/prospects/import/route.ts
// PBS 2026-07-05: CSV import → normalise + guess email from domain + tag + insert.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: {
    rows?: Array<Record<string, string>>;
    tags?: string[];
    filename?: string;
    default_country?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok:false, error:'invalid_json' }, { status:400 }); }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ ok:false, error:'no_rows' }, { status:400 });
  if (rows.length > 10000) return NextResponse.json({ ok:false, error:'too_many_rows_max_10000' }, { status:400 });

  const tags = Array.isArray(body.tags) && body.tags.length > 0 ? body.tags : ['imported'];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_import_prospects', {
    p_rows: rows,
    p_tags: tags,
    p_filename: body.filename ?? null,
    p_default_country: body.default_country ?? null,
  });
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
  return NextResponse.json(data);
}
