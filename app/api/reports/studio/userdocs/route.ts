// app/api/reports/studio/userdocs/route.ts
// Spreadsheet Studio r2 — user document storage (brief §10.2 + §10.4).
// Private bucket `user-docs` + registry reports.user_docs (bridge
// public.v_studio_user_docs). Uploads carry the brain-consent answer:
// brain_excluded defaults TRUE (privacy-first) and is reversible via PATCH.
// The Studio never writes metric rows — documents are opaque files only.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { StudioDocsUsage, StudioUserDocRow } from '@/lib/studio/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per file — quota surfaced on the page

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ?download=<id> → short-lived signed URL from the private bucket
  const downloadId = url.searchParams.get('download');
  if (downloadId) {
    const { data: doc, error } = await supabase
      .from('v_studio_user_docs')
      .select('storage_path, filename')
      .eq('id', downloadId)
      .maybeSingle();
    if (error || !doc) return NextResponse.json({ error: error?.message ?? 'doc not found' }, { status: 404 });
    const { data: signed, error: signErr } = await supabase.storage
      .from('user-docs')
      .createSignedUrl(doc.storage_path, 300, { download: doc.filename });
    if (signErr || !signed) return NextResponse.json({ error: signErr?.message ?? 'sign failed' }, { status: 500 });
    return NextResponse.json({ url: signed.signedUrl });
  }

  const level = url.searchParams.get('level');
  const propertyId = Number(url.searchParams.get('property_id')) || null;

  let query = supabase
    .from('v_studio_user_docs')
    .select('id, owner, level, property_id, filename, storage_path, size_bytes, mime, tags, brain_excluded, uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(500);
  if (level === 'holding') query = query.eq('level', 'holding');
  else if (propertyId) query = query.eq('level', 'property').eq('property_id', propertyId);

  const [docsRes, usageRes] = await Promise.all([query, supabase.rpc('fn_studio_user_docs_usage')]);
  if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });

  const usage = (usageRes.data ?? { doc_count: 0, total_bytes: 0 }) as StudioDocsUsage;
  return NextResponse.json({ docs: (docsRes.data ?? []) as StudioUserDocRow[], usage });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart form-data required' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `file exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
  }

  const level = form.get('level') === 'holding' ? 'holding' : 'property';
  const propertyId = level === 'property' ? Number(form.get('property_id')) || 0 : null;
  if (level === 'property' && !propertyId) {
    return NextResponse.json({ error: 'property_id required for property-level docs' }, { status: 400 });
  }
  const owner = typeof form.get('owner') === 'string' ? String(form.get('owner')).slice(0, 60) : 'pbs';
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 10);
  // §10.4 brain consent: indexed ONLY on explicit yes; default = excluded.
  const brainExcluded = form.get('brain_ok') !== 'yes';

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'document';
  const storagePath = `${level}/${propertyId ?? 'holding'}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('user-docs')
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: id, error: regErr } = await supabase.rpc('fn_studio_register_user_doc', {
    p_owner: owner,
    p_level: level,
    p_property_id: propertyId,
    p_filename: file.name.slice(0, 200),
    p_storage_path: storagePath,
    p_size_bytes: file.size,
    p_mime: file.type || null,
    p_tags: tags,
    p_brain_excluded: brainExcluded,
  });
  if (regErr) {
    // registry failed → remove the orphan storage object (best effort)
    await supabase.storage.from('user-docs').remove([storagePath]);
    return NextResponse.json({ error: regErr.message }, { status: 500 });
  }

  return NextResponse.json({ id, uploaded: true, brain_excluded: brainExcluded });
}

// §10.4: reversible brain-consent toggle
export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const excluded = body.brain_excluded !== false; // default to excluded on ambiguity

  const { error } = await supabase.rpc('fn_studio_set_doc_brain', { p_id: id, p_excluded: excluded });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, brain_excluded: excluded });
}
