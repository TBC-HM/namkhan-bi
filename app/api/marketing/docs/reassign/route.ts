// app/api/marketing/docs/reassign/route.ts
// PBS 2026-07-06: reassign a doc's container (doc_type + doc_subtype).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { doc_id?: string; doc_type?: string; doc_subtype?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ ok:false, error:'invalid_json' }, { status:400 }); }
  if (!body.doc_id || !body.doc_type) return NextResponse.json({ ok:false, error:'missing_fields' }, { status:400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_doc_reassign', {
    p_doc_id: body.doc_id,
    p_doc_type: body.doc_type,
    p_doc_subtype: body.doc_subtype ?? null,
  });
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
  return NextResponse.json(data);
}
