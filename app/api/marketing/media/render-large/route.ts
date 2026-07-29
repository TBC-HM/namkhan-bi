// app/api/marketing/media/render-large/route.ts
// POST — server-side downscale path for oversized raws (>25MB) that Supabase
// image transforms reject ("too_large") and media-render-web v1 502s on.
// Runs sharp (native libvips, handles JPEG + TIFF at 30MP+ easily) inside the
// Vercel function, so no edge-function CPU/memory limits apply.
//
// Body: { asset_id: "<uuid>" }  ·  Header: x-upload-key = vault MEDIA_UPLOAD_KEY
// Flow: raw from media-raw → web_2k / ota_main / thumbnail JPEGs → media-renders
//       → fn_media_record_render per render → fn_media_set_render_result
//       (master_path = <asset_id>/web_2k.jpg + original dims, status unchanged).
//
// Media brief autospec-media_module-20260725 · verifier objection A5 (8 unscored
// raws with no web render) · 2026-07-29. Renders match media-render-web specs.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RENDERS: Array<{ p: string; w: number; h: number; fit: 'inside' | 'cover'; q: number }> = [
  { p: 'web_2k',    w: 2000, h: 2000, fit: 'inside', q: 82 },
  { p: 'ota_main',  w: 1920, h: 1080, fit: 'cover',  q: 85 },
  { p: 'thumbnail', w: 400,  h: 400,  fit: 'inside', q: 75 },
];

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  // Guard: shared vault secret (same key media-render-web v2 upload mode uses).
  const given = req.headers.get('x-upload-key') ?? '';
  const { data: secret } = await sb.rpc('fn_get_secret', { p_name: 'MEDIA_UPLOAD_KEY' });
  if (!secret || typeof secret !== 'string' || given.length < 20 || given !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id: string = body?.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const { data: asset, error: aErr } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, raw_path, master_path, mime_type, asset_type')
    .eq('asset_id', asset_id)
    .maybeSingle();
  if (aErr || !asset) {
    return NextResponse.json({ error: 'asset_not_found', detail: aErr?.message }, { status: 404 });
  }
  if (asset.asset_type !== 'photo' || !asset.raw_path) {
    return NextResponse.json({ error: 'not_a_photo_or_no_raw', asset_type: asset.asset_type }, { status: 400 });
  }

  const bucket = asset.raw_path.startsWith('branding/') ? 'branding' : 'media-raw';
  const path = bucket === 'branding' ? asset.raw_path.replace(/^branding\//, '') : asset.raw_path;

  const { data: blob, error: dErr } = await sb.storage.from(bucket).download(path);
  if (dErr || !blob) {
    return NextResponse.json({ error: 'raw_download_failed', detail: dErr?.message }, { status: 500 });
  }
  const rawBuf = Buffer.from(await blob.arrayBuffer());

  let origW = 0;
  let origH = 0;
  const uploads: any[] = [];
  try {
    const meta = await sharp(rawBuf, { limitInputPixels: 1e9 }).rotate().metadata();
    // .rotate() applies EXIF orientation, so report oriented dims.
    const swap = (meta.orientation ?? 1) >= 5;
    origW = (swap ? meta.height : meta.width) ?? 0;
    origH = (swap ? meta.width : meta.height) ?? 0;

    for (const rd of RENDERS) {
      const out = await sharp(rawBuf, { limitInputPixels: 1e9 })
        .rotate()
        .resize({ width: rd.w, height: rd.h, fit: rd.fit, withoutEnlargement: true })
        .jpeg({ quality: rd.q, mozjpeg: true })
        .toBuffer();
      const outPath = `${asset_id}/${rd.p}.jpg`;
      const { error: ue } = await sb.storage
        .from('media-renders')
        .upload(outPath, out, { contentType: 'image/jpeg', upsert: true });
      if (ue) { uploads.push({ purpose: rd.p, error: ue.message.slice(0, 80) }); continue; }
      const outMeta = await sharp(out).metadata();
      await sb.rpc('fn_media_record_render', {
        p_asset_id: asset_id,
        p_purpose: rd.p,
        p_path: outPath,
        p_w: outMeta.width ?? rd.w,
        p_h: outMeta.height ?? rd.h,
        p_bytes: out.length,
      });
      uploads.push({ purpose: rd.p, ok: true, bytes: out.length, w: outMeta.width, h: outMeta.height });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'sharp_failed', detail: String(e?.message ?? e).slice(0, 200), uploads }, { status: 500 });
  }

  const okCount = uploads.filter((u) => u.ok).length;
  let master: any = null;
  if (okCount > 0) {
    // Keep current status; only set master_path + honest original dims.
    const { data: cur } = await sb
      .from('v_marketing_media_page')
      .select('status')
      .eq('asset_id', asset_id)
      .maybeSingle();
    const { data: sm, error: se } = await sb.rpc('fn_media_set_render_result', {
      p_asset_id: asset_id,
      p_status: cur?.status ?? 'ingested',
      p_master_path: `${asset_id}/web_2k.jpg`,
      p_width: origW > 0 ? origW : null,
      p_height: origH > 0 ? origH : null,
    });
    master = se ? { error: se.message.slice(0, 80) } : sm;
  }

  return NextResponse.json({ ok: okCount > 0, asset_id, orig_w: origW, orig_h: origH, uploads, master });
}
