// app/api/marketing/docs/upload/route.ts
// PBS 2026-07-06: accepts multipart file upload, writes to dms-documents Storage
// bucket, registers row in dms.documents.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ ok:false, error:'invalid_form_data' }, { status:400 }); }

  const file = fd.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok:false, error:'no_file' }, { status:400 });
  if (file.size < 10) return NextResponse.json({ ok:false, error:'empty_file' }, { status:400 });
  if (file.size > 50_000_000) return NextResponse.json({ ok:false, error:'file_too_large_max_50mb' }, { status:400 });

  const title = String(fd.get('title') ?? '').trim() || file.name;
  const doc_type = String(fd.get('doc_type') ?? '').trim() || 'marketing';
  const doc_subtype = String(fd.get('doc_subtype') ?? '').trim() || null;

  const sb = getSupabaseAdmin();

  // Path: yyyy/mm/<uuid>__<sanitised-name>
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = crypto.randomUUID().slice(0, 8);
  const cleanName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${yyyy}/${mm}/${rand}__${cleanName}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from('dms-documents').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return NextResponse.json({ ok:false, error:'storage_upload_failed', detail: upErr.message }, { status:500 });

  const { data: rowIns, error: dbErr } = await sb.schema('dms').from('documents').insert({
    property_id: PROPERTY_ID,
    title,
    doc_type,
    doc_subtype,
    file_name: file.name,
    storage_bucket: 'dms-documents',
    storage_path: storagePath,
    mime: file.type || null,
    file_size_bytes: file.size,
  }).select('doc_id').maybeSingle();

  if (dbErr) return NextResponse.json({ ok:false, error:'db_insert_failed', detail: dbErr.message, storage_path: storagePath }, { status:500 });

  return NextResponse.json({ ok:true, doc_id: rowIns?.doc_id, storage_path: storagePath });
}
