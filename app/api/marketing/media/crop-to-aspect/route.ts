// app/api/marketing/media/crop-to-aspect/route.ts
// POST { asset_id, channel } — center-crop the master to a channel's target
// aspect ratio (from v_media_aspect_ratio_rules), upload as WebP into
// media-renders, then call fn_media_asset_crop_master to update master_path +
// width_px/height_px and strip the aspect_ratio failure from qa_notes.
// PBS 2026-07-14 · Media QA v2 · Task 4.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRatio(r: string): [number, number] {
  const m = /^(\d+)\s*:\s*(\d+)$/.exec(r);
  if (!m) return [16, 9];
  return [Number(m[1]), Number(m[2])];
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: { asset_id?: string; channel?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id = body.asset_id;
  const channel = body.channel;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  if (!channel) return NextResponse.json({ error: 'channel required' }, { status: 400 });

  const { data: rule, error: rErr } = await sb
    .from('v_media_aspect_ratio_rules')
    .select('channel, ratio, min_width_px, min_height_px, active')
    .eq('channel', channel).maybeSingle();
  if (rErr) return NextResponse.json({ error: 'rule_lookup_failed', detail: rErr.message }, { status: 500 });
  if (!rule || rule.active !== true) return NextResponse.json({ error: 'unknown_or_inactive_channel', channel }, { status: 400 });

  const { data: asset, error: aErr } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, raw_path, master_path, mime_type, is_ai_generated, width_px, height_px')
    .eq('asset_id', asset_id).maybeSingle();
  if (aErr) return NextResponse.json({ error: 'asset_lookup_failed', detail: aErr.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'asset_not_found' }, { status: 404 });

  const srcW = Number(asset.width_px ?? 0);
  const srcH = Number(asset.height_px ?? 0);
  const minW = Number(rule.min_width_px);
  const minH = Number(rule.min_height_px);
  if (srcW < minW || srcH < minH) {
    return NextResponse.json({
      ok: false, error: 'too_small',
      min: { width_px: minW, height_px: minH },
      source: { width_px: srcW, height_px: srcH },
      channel,
    }, { status: 200 });
  }

  const useMaster = Boolean(asset.master_path);
  const bucket = useMaster
    ? (asset.is_ai_generated ? 'media-ai' : 'media-renders')
    : ((asset.raw_path ?? '').startsWith('branding/') ? 'branding' : 'media-raw');
  const path = useMaster
    ? asset.master_path!
    : ((asset.raw_path ?? '').startsWith('branding/') ? asset.raw_path!.replace(/^branding\//, '') : asset.raw_path!);

  const { data: signed, error: sErr } = await sb.storage.from(bucket).createSignedUrl(path, 900);
  if (sErr || !signed?.signedUrl) return NextResponse.json({ error: 'sign_failed', detail: sErr?.message }, { status: 500 });

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok) return NextResponse.json({ error: 'upstream_fetch_failed', status: upstream.status }, { status: 502 });
  const inputBuf = Buffer.from(await upstream.arrayBuffer());

  const [ratioW, ratioH] = parseRatio(String(rule.ratio));
  const targetRatio = ratioW / ratioH;
  const srcRatio = srcW / srcH;

  let cropW: number, cropH: number, left: number, top: number;
  if (srcRatio > targetRatio) {
    cropH = srcH;
    cropW = Math.round(cropH * targetRatio);
    left = Math.max(0, Math.round((srcW - cropW) / 2));
    top = 0;
  } else {
    cropW = srcW;
    cropH = Math.round(cropW / targetRatio);
    left = 0;
    top = Math.max(0, Math.round((srcH - cropH) / 2));
  }

  const pipeline = sharp(inputBuf)
    .extract({ left, top, width: cropW, height: cropH })
    .webp({ quality: 88 });
  const outBuf = await pipeline.toBuffer();
  const meta = await sharp(outBuf).metadata();
  const outW = meta.width ?? cropW;
  const outH = meta.height ?? cropH;

  const outPath = `crops/${asset_id}_${channel}.webp`;
  const { error: upErr } = await sb.storage.from('media-renders').upload(outPath, outBuf, {
    contentType: 'image/webp', upsert: true,
  });
  if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 500 });

  const { data: rpcRes, error: rpcErr } = await sb.rpc('fn_media_asset_crop_master', {
    p_asset_id: asset_id,
    p_new_master_path: outPath,
    p_new_width: outW,
    p_new_height: outH,
    p_channel: channel,
  });
  if (rpcErr) return NextResponse.json({ error: 'db_persist_failed', detail: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    channel,
    ratio: rule.ratio,
    source: { width_px: srcW, height_px: srcH },
    crop:   { left, top, width: cropW, height: cropH },
    output: { width_px: outW, height_px: outH, path: outPath },
    rpc: rpcRes,
  });
}
