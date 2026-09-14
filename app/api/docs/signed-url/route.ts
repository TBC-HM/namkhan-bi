// app/api/docs/signed-url/route.ts
// GET /api/docs/signed-url?bucket=...&path=...&exp=600        — by bucket+path
// GET /api/docs/signed-url?doc_id=...&exp=600                  — by dms.documents.doc_id (resolves bucket+path)
// Returns a short-lived signed URL for opening/downloading a doc from a private bucket.
// PBS 2026-06-29: doc_id mode added so the staff drawer can render a clickable
// contract link without first having to query the documents table client-side.
//
// TENANCY (2026-09-14): this route used to resolve ANY registered document to a
// signed URL for any authenticated caller — middleware only proves a session
// exists, it does not scope by tenant. Both call modes now resolve the
// dms.documents row first (doc_id mode already did; bucket+path mode now does
// a reverse lookup, since (storage_bucket, storage_path) is unique across active
// docs) and, when that row carries a property_id, require the caller to hold
// access to THAT property via requirePropertyAccess() before a URL is issued.
// Docs with property_id IS NULL are genuine platform-wide reference material
// and stay open to any authenticated caller. An object with no matching
// dms.documents row is refused outright (404) — deny unknown, since every
// legitimate caller (KnowledgeApp, StaffDrawer) passes a bucket+path or doc_id
// it already read off a registered document row.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

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

  let propertyId: number | null;

  if (docId) {
    // doc_id mode: resolve bucket+path+property_id from dms.documents
    const { data: doc, error: docErr } = await admin
      .schema('dms')
      .from('documents')
      .select('storage_bucket, storage_path, file_name, property_id')
      .eq('doc_id', docId)
      .maybeSingle();
    if (docErr || !doc) {
      return NextResponse.json({ ok: false, error: docErr?.message || 'doc not found' }, { status: 404 });
    }
    bucket     = doc.storage_bucket;
    path       = doc.storage_path;
    propertyId = doc.property_id;
  } else if (bucket && path) {
    // bucket+path mode: reverse-look-up the registered document so we can
    // apply the same tenancy rule. (storage_bucket, storage_path) is unique
    // across active documents — an unregistered pair cannot be authorised.
    const { data: doc, error: docErr } = await admin
      .schema('dms')
      .from('documents')
      .select('property_id')
      .eq('storage_bucket', bucket)
      .eq('storage_path', path)
      .maybeSingle();
    if (docErr || !doc) {
      return NextResponse.json({ ok: false, error: docErr?.message || 'doc not found' }, { status: 404 });
    }
    propertyId = doc.property_id;
  } else {
    return NextResponse.json({ ok: false, error: 'missing bucket or path (or doc_id)' }, { status: 400 });
  }

  if (!bucket || !path) return NextResponse.json({ ok: false, error: 'missing bucket or path (or doc_id)' }, { status: 400 });

  // Platform-wide reference material (property_id IS NULL) is open to any
  // authenticated caller. Everything else requires a verified grant on the
  // document's own property — never a default, never the caller-supplied one.
  if (propertyId != null) {
    try {
      await requirePropertyAccess(req, propertyId);
    } catch (err) {
      if (err instanceof Response) return err;
      return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
    }
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, exp);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
