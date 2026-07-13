// app/api/marketing/media/video-render/route.ts
// PBS 2026-07-13 · Task #148 v2 — Video AI Studio render dispatch.
//
// TWO INVOCATION MODES:
//   A) Legacy composer  { template_key, asset_ids, voiceover_text, target_channel, title }
//      → Uses public.v_video_templates scaffold + assembleEDL().
//   B) v1 prompt-first  { edl, thumbnails, opener_config, closer_config,
//                         property_id, title, channel, aspect,
//                         voiceover_script?, voice_id?,
//                         design_prompt?, style_key?, music_track_id? }
//      → EDL already built by /video-design; we just insert row + fire off
//        Shotstack + persist thumbnails + optional voiceover MP3.
//
// FIX 2026-07-13 (Task 0 root cause):
//   Prior EDL used `effect: 'kenBurns'` — Shotstack rejected as HTTP 400.
//   Legacy builder now uses `zoomIn` (safeEffect). v1 route uses shotstackBuilder
//   which validates the enum via VALID_EFFECTS.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret } from '@/lib/youtube/skills-common';
import { ttsOpenAI, type OpenAiVoice } from '@/lib/video/ttsOpenai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LegacyPayload {
  property_id: number;
  template_key: string;
  asset_ids: string[];
  voiceover_text?: string | null;
  target_channel: string;
  title?: string | null;
}

interface V1Payload {
  property_id: number;
  edl: Record<string, unknown>;
  title?: string | null;
  channel: string;
  aspect?: string;
  thumbnails?: any[];
  opener_config?: any;
  closer_config?: any;
  voiceover_script?: string | null;
  voice_id?: OpenAiVoice;
  design_prompt?: string | null;
  style_key?: string | null;
  music_track_id?: string | null;
  source_asset_ids?: string[];
  cost_cap_eur?: number;
}

interface TemplateRow {
  template_key: string; display_name: string;
  duration_sec: number; min_assets: number; max_assets: number;
  aspect: string;
  edl_scaffold: { per_shot_seconds?: number; effect?: string; transition?: string; background?: string };
}

interface AssetRow {
  asset_id: string; public_url: string | null; mime_type: string | null;
  master_path: string | null; duration_sec?: number | null; original_filename?: string | null;
}

const VALID_EFFECTS = new Set([
  'zoomIn','zoomInSlow','zoomInFast','zoomOut','zoomOutSlow','zoomOutFast',
  'slideLeft','slideLeftSlow','slideLeftFast','slideRight','slideRightSlow','slideRightFast',
  'slideUp','slideUpSlow','slideUpFast','slideDown','slideDownSlow','slideDownFast',
]);
function safeEffect(want: string | undefined | null, fallback = 'zoomIn'): string {
  if (want && VALID_EFFECTS.has(want)) return want;
  return fallback;
}
function isVideoUrl(mime: string | null, url: string | null): boolean {
  const mt = (mime ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test((url ?? '').toLowerCase());
}

function buildLegacyEdl(template: TemplateRow, assets: AssetRow[], voiceoverText: string | null, targetAspect: string | null): Record<string, unknown> {
  const perShot = Number(template.edl_scaffold?.per_shot_seconds ?? Math.max(1.5, template.duration_sec / Math.max(1, assets.length)));
  const bg      = template.edl_scaffold?.background ?? '#000000';
  const effect  = safeEffect(template.edl_scaffold?.effect, 'zoomIn');
  const transition = template.edl_scaffold?.transition ?? 'fade';
  const clips = assets.map((a, i) => {
    const start = i * perShot;
    const type = isVideoUrl(a.mime_type, a.public_url) ? 'video' : 'image';
    const asset: Record<string, unknown> = { type, src: a.public_url ?? '' };
    const clip: Record<string, unknown> = {
      asset, start, length: perShot,
      transition: { in: transition, out: transition },
    };
    if (type === 'image') clip.effect = effect;
    if (type === 'video') (clip.asset as any).trim = 0;
    return clip;
  });
  const meta: Record<string, unknown> = {};
  if (voiceoverText && voiceoverText.trim().length > 0) {
    meta.voiceover_text = voiceoverText.trim();
    meta.voiceover_provider = 'openai_tts_pending';
  }
  const aspect = targetAspect ?? template.aspect ?? '16:9';
  const resolution = aspect === '9:16' ? 'sd' : 'hd';
  return {
    timeline: { background: bg, tracks: [{ clips }] },
    output: { format: 'mp4', resolution, aspectRatio: aspect },
    ...(Object.keys(meta).length > 0 ? { _meta: meta } : {}),
  };
}

async function dispatchShotstack(sb: any, rowId: string, edl: Record<string, unknown>) {
  const key = await getVaultSecret('SHOTSTACK_API_KEY');
  if (!key) {
    return { ok: true, warning: 'shotstack_key_missing_in_vault — row queued but not dispatched' };
  }
  const host = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/edit/v1').replace(/\/$/, '');
  try {
    const res = await fetch(host + '/render', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(edl),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 800);
      await sb.rpc('fn_video_edit_update', {
        p_id: rowId, p_status: 'failed', p_shotstack_render_id: null,
        p_output_asset_id: null,
        p_error_msg: 'shotstack_' + res.status + ':' + detail,
        p_thumbnails: null,
      });
      return { ok: false, error: 'shotstack_' + res.status, detail, status: 502 };
    }
    const jr = await res.json().catch(() => null) as any;
    const renderId = jr?.response?.id;
    if (!jr?.success || !renderId) {
      const errMsg = (jr?.response?.message ?? jr?.message ?? 'unknown').toString();
      await sb.rpc('fn_video_edit_update', {
        p_id: rowId, p_status: 'failed', p_shotstack_render_id: null,
        p_output_asset_id: null,
        p_error_msg: 'shotstack_bad_response:' + errMsg,
        p_thumbnails: null,
      });
      return { ok: false, error: 'shotstack_bad_response', detail: errMsg, status: 502 };
    }
    await sb.rpc('fn_video_edit_update', {
      p_id: rowId, p_status: 'rendering', p_shotstack_render_id: renderId,
      p_output_asset_id: null, p_error_msg: null, p_thumbnails: null,
    });
    return { ok: true, shotstack_render_id: renderId };
  } catch (e: any) {
    await sb.rpc('fn_video_edit_update', {
      p_id: rowId, p_status: 'failed', p_shotstack_render_id: null,
      p_output_asset_id: null, p_error_msg: 'shotstack_crash:' + (e?.message ?? 'unknown'),
      p_thumbnails: null,
    });
    return { ok: false, error: 'shotstack_dispatch_crash', detail: e?.message ?? null, status: 500 };
  }
}

async function handleV1(sb: any, body: V1Payload) {
  if (!body.property_id || !body.edl || !body.channel) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  const aspect = body.aspect ?? '16:9';

  // Optional TTS voiceover
  let edl = body.edl;
  let voiceMeta: any = null;
  if (body.voiceover_script && body.voice_id) {
    const tts = await ttsOpenAI(body.voiceover_script, body.voice_id);
    if (tts.ok && tts.url) {
      const timeline = (edl as any).timeline ?? {};
      timeline.tracks = [
        ...(timeline.tracks ?? []),
        { clips: [{ asset: { type: 'audio', src: tts.url, volume: 1.0 }, start: 0, length: Math.max(5, tts.duration_estimate_sec ?? 30) }] },
      ];
      (edl as any).timeline = timeline;
      voiceMeta = { url: tts.url, cost_usd: tts.cost_usd_est, duration_estimate_sec: tts.duration_estimate_sec };
    }
  }

  const insertPayload = {
    property_id: body.property_id,
    title: body.title ?? null,
    channel: body.channel,
    aspect,
    timeline: edl,
    source_asset_ids: body.source_asset_ids ?? [],
    status: 'queued',
    cost_cap_eur: body.cost_cap_eur ?? 5,
    created_by: 'PBS',
  };
  const { data: insData, error: insErr } = await sb.rpc('fn_video_edit_insert', { p: insertPayload as any });
  if (insErr || !insData) {
    return NextResponse.json({ error: 'video_edit_insert_failed', detail: insErr?.message ?? null }, { status: 500 });
  }
  const row = insData as any;

  // Persist thumbnails + prompt/style metadata via a follow-up SQL patch
  if (Array.isArray(body.thumbnails) || body.design_prompt || body.style_key || body.voice_id || body.music_track_id) {
    await sb.rpc('fn_video_edit_update', {
      p_id: row.id,
      p_status: null, p_shotstack_render_id: null, p_output_asset_id: null,
      p_error_msg: null,
      p_thumbnails: (body.thumbnails ?? null) as any,
    });
    // Prompt/style/voice/music metadata via direct SQL RPC (SECURITY DEFINER helper)
    try {
      await sb.rpc('fn_video_edit_update_meta', {
        p_id: row.id,
        p_design_prompt: body.design_prompt ?? null,
        p_style_key: body.style_key ?? null,
        p_voice_id: body.voice_id ?? null,
        p_music_track_id: body.music_track_id ?? null,
      });
    } catch { /* helper may not exist yet — non-fatal */ }
  }

  const dispatch = await dispatchShotstack(sb, row.id, edl);
  if (!dispatch.ok) {
    return NextResponse.json({ ok: false, id: row.id, row, ...dispatch }, { status: (dispatch as any).status ?? 502 });
  }
  return NextResponse.json({
    ok: true, id: row.id,
    row: { ...row, status: 'rendering', shotstack_render_id: (dispatch as any).shotstack_render_id },
    voiceover: voiceMeta,
  });
}

async function handleLegacy(sb: any, body: LegacyPayload) {
  const { property_id, template_key, asset_ids, target_channel } = body || ({} as LegacyPayload);
  if (!property_id || !template_key || !target_channel) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!Array.isArray(asset_ids) || asset_ids.length === 0) return NextResponse.json({ error: 'asset_ids_required' }, { status: 400 });

  const { data: tplData, error: tplErr } = await sb.from('v_video_templates').select('*').eq('template_key', template_key).maybeSingle();
  if (tplErr || !tplData) return NextResponse.json({ error: 'template_not_found', detail: tplErr?.message ?? null }, { status: 404 });
  const template = tplData as TemplateRow;
  if (asset_ids.length < template.min_assets) return NextResponse.json({ error: 'too_few_assets', detail: 'template needs >= ' + template.min_assets }, { status: 400 });
  if (asset_ids.length > template.max_assets) return NextResponse.json({ error: 'too_many_assets', detail: 'template caps at ' + template.max_assets }, { status: 400 });

  const { data: assetRows, error: assetErr } = await sb.from('v_marketing_media_page')
    .select('asset_id, public_url, mime_type, master_path, original_filename').in('asset_id', asset_ids);
  if (assetErr) return NextResponse.json({ error: 'asset_resolve_failed', detail: assetErr.message }, { status: 500 });
  const byId = new Map<string, AssetRow>();
  for (const r of (assetRows ?? []) as AssetRow[]) byId.set(r.asset_id, r);
  const ordered: AssetRow[] = asset_ids.map(id => byId.get(id)).filter(Boolean) as AssetRow[];
  if (ordered.length < asset_ids.length) return NextResponse.json({ error: 'assets_missing' }, { status: 400 });

  const { data: specData } = await sb.from('v_media_channel_specs').select('channel, display_name, video_aspect_ratio').eq('channel', target_channel).maybeSingle();
  const aspect = (specData as any)?.video_aspect_ratio ?? template.aspect ?? '16:9';

  const edl = buildLegacyEdl(template, ordered, body.voiceover_text ?? null, aspect);

  const insertPayload = {
    property_id, title: body.title ?? null,
    channel: target_channel, aspect, timeline: edl,
    source_asset_ids: asset_ids, status: 'queued',
    cost_cap_eur: 5.00, created_by: 'PBS',
  };
  const { data: insData, error: insErr } = await sb.rpc('fn_video_edit_insert', { p: insertPayload as any });
  if (insErr || !insData) return NextResponse.json({ error: 'video_edit_insert_failed', detail: insErr?.message ?? null }, { status: 500 });
  const row = insData as any;

  const dispatch = await dispatchShotstack(sb, row.id, edl);
  if (!dispatch.ok) return NextResponse.json({ ok: false, id: row.id, row, ...dispatch }, { status: (dispatch as any).status ?? 502 });
  return NextResponse.json({ ok: true, id: row.id, row: { ...row, status: 'rendering', shotstack_render_id: (dispatch as any).shotstack_render_id } });
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  // v1 mode is signalled by presence of `edl` field.
  if (body?.edl) return handleV1(sb, body as V1Payload);
  return handleLegacy(sb, body as LegacyPayload);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { data, error } = await sb.from('v_video_edits').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'load_failed', detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const status = (data as any).status?.toLowerCase();
  const shotstackId = (data as any).shotstack_render_id as string | null;
  if (shotstackId && (status === 'rendering' || status === 'queued')) {
    const key = await getVaultSecret('SHOTSTACK_API_KEY');
    if (key) {
      const host = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/edit/v1').replace(/\/$/, '');
      try {
        const r = await fetch(host + '/render/' + encodeURIComponent(shotstackId), {
          headers: { 'x-api-key': key }, cache: 'no-store',
        });
        if (r.ok) {
          const jr = await r.json().catch(() => null) as any;
          const ssStatus = jr?.response?.status;
          if (ssStatus === 'done' && jr?.response?.url) {
            await sb.rpc('fn_video_edit_update', {
              p_id: id, p_status: 'done', p_shotstack_render_id: shotstackId,
              p_output_asset_id: null, p_error_msg: null, p_thumbnails: null,
            });
            return NextResponse.json({ ok: true, row: { ...data, status: 'done', output_url: jr.response.url } });
          }
          if (ssStatus === 'failed') {
            await sb.rpc('fn_video_edit_update', {
              p_id: id, p_status: 'failed', p_shotstack_render_id: shotstackId,
              p_output_asset_id: null,
              p_error_msg: 'shotstack_render_failed:' + (jr?.response?.error ?? 'unknown'),
              p_thumbnails: null,
            });
            return NextResponse.json({ ok: true, row: { ...data, status: 'failed' } });
          }
        }
      } catch { /* silent */ }
    }
  }
  return NextResponse.json({ ok: true, row: data });
}
