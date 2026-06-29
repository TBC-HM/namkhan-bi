// app/api/docs/signed-url/route.ts
// GET /api/docs/signed-url?bucket=...&path=...&exp=600        — by bucket+path
// GET /api/docs/signed-url?doc_id=...&exp=600                  — by dms.documents.doc_id (resolves bucket+path)
// Returns a short-lived signed URL for opening/downloading a doc from a private bucket.
// PBS 2026-06-29: doc_id mode added so the staff drawer can render a clickable
// contract link without first having to query the documents table client-side.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { searchParams } = new URL(req.url);
  const docId  = searchParams.get('doc_id');
  let bucket   = searchParams.get('bucket');
  let path     = searchParams.get('path');
  const exp    = parseInt(searchParams.get('exp') || '600');

  // doc_id mode: resolve bucket+path from dms.documents
  if (docId && (!bucket || !path)) {
    const { data: doc, error: docErr } = await admin
      .schema('dms')
      .from('documents')
      .select('storage_bucket, storage_path, file_name')
      .eq('doc_id', docId)
      .maybeSingle();
    if (docErr || !doc) {
      return NextResponse.json({ ok: false, error: docErr?.message || 'doc not found' }, { status: 404 });
    }
    bucket = doc.storage_bucket;
    path   = doc.storage_path;
  }

  if (!bucket || !path) return NextResponse.json({ ok: false, error: 'missing bucket or path (or doc_id)' }, { status: 400 });

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, exp);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
