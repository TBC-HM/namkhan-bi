// supabase/functions/render-media/index.ts v5
// Render worker — promotes marketing.media_assets ingested→ready, generates 5 sized renders.
// Pre-flight size check: skip files > MAX_BYTES (Edge Function memory budget).
// Oversize files go to status='needs_review' for a heavier worker (v1.1).
// verify_jwt=false: callable by pg_cron without secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts'

const MAX_BYTES = 4_000_000;

interface AssetRow {
  asset_id: string;
  raw_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!url || !key) return json({ error: 'env_missing' }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: assets, error: pullErr } = await sb
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, raw_path, original_filename, mime_type, file_size_bytes')
    .eq('status', 'ingested')
    .in('mime_type', ['image/jpeg', 'image/png'])
    .gte('file_size_bytes', 1024)
    .lte('file_size_bytes', MAX_BYTES)
    .order('created_at', { ascending: true })
    .limit(1);

  if (pullErr) return json({ error: 'pull_failed', detail: pullErr.message }, 500);
  if (!assets || assets.length === 0) return json({ processed: 0, message: 'queue empty (small assets)' });

  const a = assets[0] as AssetRow;
  try {
    const r = await processOne(sb, a);
    return json({ processed: 1, results: [r] });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    await sb.schema('marketing').from('media_assets')
      .update({ status: 'qc_failed' }).eq('asset_id', a.asset_id);
    return json({ processed: 1, results: [{ asset_id: a.asset_id, filename: a.original_filename, error: msg, marked: 'qc_failed' }] });
  }
});

async function processOne(sb: any, a: AssetRow) {
  const t0 = Date.now();
  const { data: blob, error: dlErr } = await sb.storage.from('media-raw').download(a.raw_path);
  if (dlErr || !blob) throw new Error(`download_failed: ${dlErr?.message ?? 'no blob'}`);
  let bytes: Uint8Array | null = new Uint8Array(await blob.arrayBuffer());

  let img = await Image.decode(bytes);
  bytes = null;
  const origW = img.width;
  const origH = img.height;

  const BASE_W = 2560;
  if (origW > BASE_W) {
    const baseH = Math.round(origH * BASE_W / origW);
    img.resize(BASE_W, baseH);
  }

  const renderRows: any[] = [];
  await renderCover(sb, img, 2560, 1440, 88, a.asset_id, 'hero_16x9', renderRows);
  await renderCover(sb, img, 1920, 1080, 85, a.asset_id, 'ota_main', renderRows);
  if (img.width > 2000) {
    const newH = Math.round(img.height * 2000 / img.width);
    img.resize(2000, newH);
  }
  await uploadAndRecord(sb, img, 82, a.asset_id, 'web_2k', renderRows);
  await renderCover(sb, img, 1080, 1080, 85, a.asset_id, 'ig_square', renderRows);
  if (img.width > 400) {
    const newH = Math.round(img.height * 400 / img.width);
    img.resize(400, newH);
  }
  await uploadAndRecord(sb, img, 75, a.asset_id, 'thumbnail', renderRows);

  await sb.schema('marketing').from('media_renders').delete().eq('asset_id', a.asset_id);
  const { error: insErr } = await sb.schema('marketing').from('media_renders').insert(renderRows);
  if (insErr) throw new Error(`render_insert_failed: ${insErr.message}`);

  const masterPath = renderRows.find((r) => r.render_purpose === 'web_2k')?.file_path ?? null;
  const { error: updErr } = await sb
    .schema('marketing').from('media_assets')
    .update({ status: 'ready', width_px: origW, height_px: origH, master_path: masterPath })
    .eq('asset_id', a.asset_id);
  if (updErr) throw new Error(`status_update_failed: ${updErr.message}`);

  return {
    asset_id: a.asset_id,
    filename: a.original_filename,
    orig_dims: `${origW}x${origH}`,
    renders: renderRows.map((r) => ({ purpose: r.render_purpose, dims: `${r.width_px}x${r.height_px}`, kb: Math.round(r.file_size_bytes/1024) })),
    duration_ms: Date.now() - t0,
    status: 'ready',
  };
}

async function renderCover(sb: any, img: any, targetW: number, targetH: number, q: number, assetId: string, purpose: string, rows: any[]) {
  const w = img.width, h = img.height;
  if (w >= targetW && h >= targetH) {
    const scale = Math.max(targetW / w, targetH / h);
    const scaledW = Math.round(w * scale);
    const scaledH = Math.round(h * scale);
    if (scaledW !== w || scaledH !== h) img.resize(scaledW, scaledH);
    const cropX = Math.floor((scaledW - targetW) / 2);
    const cropY = Math.floor((scaledH - targetH) / 2);
    img.crop(cropX, cropY, targetW, targetH);
  } else {
    img.resize(targetW, Image.RESIZE_AUTO);
  }
  await uploadAndRecord(sb, img, q, assetId, purpose, rows);
}

async function uploadAndRecord(sb: any, img: any, q: number, assetId: string, purpose: string, rows: any[]) {
  const out = await img.encodeJPEG(q);
  const renderPath = `${assetId}/${purpose}.jpg`;
  const { error: upErr } = await sb.storage.from('media-renders').upload(renderPath, out, {
    contentType: 'image/jpeg', upsert: true,
  });
  if (upErr) throw new Error(`upload_${purpose}_failed: ${upErr.message}`);
  rows.push({
    asset_id: assetId,
    render_purpose: purpose,
    width_px: img.width,
    height_px: img.height,
    file_path: renderPath,
    file_size_bytes: out.byteLength,
    format: 'jpeg',
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
