// app/api/legal/docs/bulk-download/route.ts
// POST { doc_ids: string[] } → application/zip stream of every selected doc's
// bytes pulled straight from the dms-docs bucket. Filename collisions are
// suffixed so the zip never overwrites itself. Cap: 200 docs per call.
//
// Auth is service-role server-side; the bucket itself stays private. Anyone
// who can reach the page can also bulk-download via this route — the page is
// itself gated by middleware (tbc.active_property cookie + tenant scope).

import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_DOCS = 200;

interface FileInfo { storage_bucket: string | null; storage_path: string | null; file_name: string | null; mime: string | null }

export async function POST(req: NextRequest) {
  let body: { doc_ids?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }); }

  const ids = Array.isArray(body.doc_ids) ? body.doc_ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ error: 'doc_ids required' }, { status: 400 });
  if (ids.length > MAX_DOCS) {
    return NextResponse.json({ error: `too many docs in one call (limit ${MAX_DOCS}, got ${ids.length})` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Resolve each doc to its storage info. fn_doc_file_info is single-doc; loop
  // is fine at 200 calls — they're parallelised and the RPC is sub-ms.
  const infos = await Promise.all(ids.map(async (id) => {
    const { data, error } = await supabase.rpc('fn_doc_file_info', { p_doc_id: id });
    if (error) return { id, err: error.message, info: null as FileInfo | null };
    const row = (Array.isArray(data) ? data[0] : data) as FileInfo | null;
    return { id, err: null, info: row };
  }));

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  const skipped: { id: string; reason: string }[] = [];

  for (const { id, err, info } of infos) {
    if (err) { skipped.push({ id, reason: `lookup: ${err}` }); continue; }
    if (!info?.storage_bucket || !info?.storage_path) { skipped.push({ id, reason: 'no file' }); continue; }

    // Pull bytes via service-role download. Storage.download returns a Blob.
    const { data: blob, error: dlErr } = await supabase.storage.from(info.storage_bucket).download(info.storage_path);
    if (dlErr || !blob) { skipped.push({ id, reason: `download: ${dlErr?.message ?? 'no blob'}` }); continue; }

    // Disambiguate filename collisions: same name → "<base> (2).ext" etc.
    let name = info.file_name?.trim() || info.storage_path.split('/').pop() || id;
    if (used.has(name)) {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext  = dot > 0 ? name.slice(dot) : '';
      let n = 2;
      while (used.has(`${base} (${n})${ext}`)) n++;
      name = `${base} (${n})${ext}`;
    }
    used.add(name);

    zip.file(name, Buffer.from(await blob.arrayBuffer()));
    added++;
  }

  if (added === 0) {
    return NextResponse.json({ error: 'no files were available for download', skipped }, { status: 404 });
  }

  // Uint8Array is assignable to BodyInit; nodebuffer is not in Next 14's types.
  const zipBuf = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `legal-docs-${stamp}-${added}files.zip`;

  return new NextResponse(new Blob([zipBuf as BlobPart], { type: 'application/zip' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Bulk-Added': String(added),
      'X-Bulk-Skipped': String(skipped.length),
    },
  });
}
