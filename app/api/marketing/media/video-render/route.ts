// app/api/marketing/media/video-render/route.ts
// PBS 2026-07-12 · Task #148 — Video AI Studio submission + poll.
//
// POST body:
//   { property_id, template_key, asset_ids[], voiceover_text?, target_channel,
//     title?, context? }
// Behaviour:
//   1. Look up template scaffold from public.v_video_templates.
//   2. Resolve each asset_id to a public URL via v_marketing_media_page.
//   3. Build a Shotstack EDL from the scaffold + assets.
//   4. Insert row into media.video_edits via public.fn_video_edit_insert RPC
//      (SECURITY DEFINER — bypasses PostgREST public-only writes rule).
//   5. Fetch SHOTSTACK_API_KEY from vault via fn_get_secret RPC.
//   6. POST to Shotstack /render, capture render_id, patch row via fn_video_edit_update.
//   7. Return { ok, id, row }.
//
// GET ?id=...   — return v_video_edits row for polling.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  property_id: number;
  template_key: string;
  asset_ids: string[];
  voiceover_text?: string | null;
  target_channel: string;
  title?: string | null;
  context?: {
    category_key?: string | null;
    what_area?: string | null;
    where_facility_id?: number | null;
  } | null;
}

interface TemplateRow {
  template_key: string;
  display_name: string;
  duration_sec: number;
  min_assets: number;
  max_assets: number;
  aspect: string;
  edl_scaffold: {
    per_shot_seconds?: number;
    effect?: string;
    transition?: string;
    background?: string;
  };
}

interface AssetRow {
  asset_id: string;
  public_url: string | null;
  mime_type: string | null;
  master_path: string | null;
  duration_sec?: number | null;
  original_filename?: string | null;
}

function isVideoUrl(mime: string | null, url: string | null): boolean {
  const mt = (mime ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test((url ?? '').toLowerCase());
}

/**
 * Build a Shotstack EDL (edit decision list) that stitches the picked assets
 * into a single track with per_shot_seconds each. Shape follows Shotstack v1
 * schema. https://shotstack.io/docs/api/
 */
function buildEdl(template: TemplateRow, assets: AssetRow[], voiceoverText: string | null, targetAspect: string | null): Record<string, unknown> {
  const perShot = Number(template.edl_scaffold?.per_shot_seconds ?? Math.max(1.5, template.duration_sec / Math.max(1, assets.length)));
  const bg      = template.edl_scaffold?.background ?? '#000000';
  const effect  = template.edl_scaffold?.effect ?? 'zoomIn';
  const transition = template.edl_scaffold?.transition ?? 'fade';

  const clips = assets.map((a, i) => {
    const start = i * perShot;
    const type = isVideoUrl(a.mime_type, a.public_url) ? 'video' : 'image';
    const asset: Record<string, unknown> = { type, src: a.public_url ?? '' };
    // For videos, trim to perShot; for images, use effect for motion.
    const clip: Record<string, unknown> = {
      asset,
      start,
      length: perShot,
      transition: { in: transition, out: transition },
    };
    if (type === 'image') clip.effect = effect;
    if (type === 'video') (clip.asset as any).trim = 0;
    return clip;
  });

  const tracks: Array<Record<string, unknown>> = [{ clips }];

  // Optional voice-over track — placeholder src for now (ElevenLabs pre-render
  // will be added in a follow-up). Signalled via metadata field so the poller /
  // guardrail can pick it up.
  const meta: Record<string, unknown> = {};
  if (voiceoverText && voiceoverText.trim().length > 0) {
    meta.voiceover_text = voiceoverText.trim();
    meta.voiceover_provider = 'elevenlabs_pending';
  }

  // Aspect / resolution
  const aspect = targetAspect ?? template.aspect ?? '16:9';
  const resolution = aspect === '9:16' ? 'sd' : 'hd';

  return {
    timeline: {
      background: bg,
      tracks,
    },
    output: {
      format: 'mp4',
      resolution,
      aspectRatio: aspect,
    },
    ...(Object.keys(meta).length > 0 ? { merge: [], _meta: meta } : {}),
  };
}

// ---- POST -----------------------------------------------------------------

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: Payload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, template_key, asset_ids, target_channel } = body || ({} as Payload);
  if (!property_id || !template_key || !target_channel) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
    return NextResponse.json({ error: 'asset_ids_required' }, { status: 400 });
  }

  // 1. Look up template.
  const { data: tplData, error: tplErr } = await sb
    .from('v_video_templates')
    .select('*')
    .eq('template_key', template_key)
    .maybeSingle();
  if (tplErr || !tplData) {
    return NextResponse.json({ error: 'template_not_found', detail: tplErr?.message ?? null }, { status: 404 });
  }
  const template = tplData as TemplateRow;

  if (asset_ids.length < template.min_assets) {
    return NextResponse.json({ error: 'too_few_assets', detail: `template needs ≥ ${template.min_assets}` }, { status: 400 });
  }
  if (asset_ids.length > template.max_assets) {
    return NextResponse.json({ error: 'too_many_assets', detail: `template caps at ${template.max_assets}` }, { status: 400 });
  }

  // 2. Resolve assets to URLs (via public bridge view).
  const { data: assetRows, error: assetErr } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, public_url, mime_type, master_path, original_filename')
    .in('asset_id', asset_ids);
  if (assetErr) return NextResponse.json({ error: 'asset_resolve_failed', detail: assetErr.message }, { status: 500 });
  const byId = new Map<string, AssetRow>();
  for (const r of (assetRows ?? []) as AssetRow[]) byId.set(r.asset_id, r);
  const ordered: AssetRow[] = asset_ids.map(id => byId.get(id)).filter(Boolean) as AssetRow[];
  const missing = asset_ids.length - ordered.length;
  if (missing > 0) return NextResponse.json({ error: 'assets_missing', detail: `${missing} not found` }, { status: 400 });
  const anyNoUrl = ordered.find(a => !a.public_url);
  if (anyNoUrl) return NextResponse.json({ error: 'asset_no_public_url', detail: anyNoUrl.asset_id }, { status: 400 });

  // 3. Look up channel spec for aspect.
  const { data: specData } = await sb
    .from('v_media_channel_specs')
    .select('channel, display_name, video_aspect_ratio')
    .eq('channel', target_channel)
    .maybeSingle();
  const aspect = (specData as any)?.video_aspect_ratio ?? template.aspect ?? '16:9';

  // 4. Build EDL.
  const edl = buildEdl(template, ordered, body.voiceover_text ?? null, aspect);

  // 5. Insert row via SECURITY DEFINER RPC.
  const insertPayload = {
    property_id,
    title: body.title ?? null,
    channel: target_channel,
    aspect,
    timeline: edl,
    source_asset_ids: asset_ids,
    status: 'queued',
    cost_cap_eur: 5.00,
    created_by: 'PBS',
  };
  const { data: insData, error: insErr } = await sb.rpc('fn_video_edit_insert', { p: insertPayload as any });
  if (insErr || !insData) {
    return NextResponse.json({ error: 'video_edit_insert_failed', detail: insErr?.message ?? null }, { status: 500 });
  }
  const row = insData as any;

  // 6. Ship to Shotstack.
  const shotstackKey = await getVaultSecret('SHOTSTACK_API_KEY');
  if (!shotstackKey) {
    // Leave row in 'queued'; UI shows helpful banner.
    return NextResponse.json({
      ok: true,
      id: row.id,
      row,
      warning: 'shotstack_key_missing_in_vault — row queued but not dispatched',
    });
  }

  const host = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/edit/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${host}/render`, {
      method: 'POST',
      headers: { 'x-api-key': shotstackKey, 'content-type': 'application/json' },
      body: JSON.stringify(edl),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 240);
      await sb.rpc('fn_video_edit_update', {
        p_id: row.id, p_status: 'failed', p_shotstack_render_id: null,
      });
      return NextResponse.json({ ok: false, error: `shotstack_${res.status}`, detail, id: row.id, row }, { status: 502 });
    }
    const jr = await res.json().catch(() => null) as any;
    const renderId = jr?.response?.id;
    if (!jr?.success || !renderId) {
      await sb.rpc('fn_video_edit_update', {
        p_id: row.id, p_status: 'failed', p_shotstack_render_id: null,
      });
      return NextResponse.json({
        ok: false, error: 'shotstack_bad_response',
        detail: (jr?.response?.message ?? jr?.message ?? '').slice(0, 240),
        id: row.id, row,
      }, { status: 502 });
    }
    const { error: updErr } = await sb.rpc('fn_video_edit_update', {
      p_id: row.id, p_status: 'rendering', p_shotstack_render_id: renderId,
    });
    if (updErr) {
      return NextResponse.json({ ok: true, id: row.id, row: { ...row, status: 'rendering', shotstack_render_id: renderId }, warning: `video_edit_update: ${updErr.message}` });
    }
    return NextResponse.json({
      ok: true, id: row.id,
      row: { ...row, status: 'rendering', shotstack_render_id: renderId },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'shotstack_dispatch_crash', detail: e?.message ?? null, id: row.id, row }, { status: 500 });
  }
}

// ---- GET (poll) -----------------------------------------------------------

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_video_edits')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'load_failed', detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // If rendering + we have a shotstack_render_id, opportunistically poll Shotstack once.
  const status = (data as any).status?.toLowerCase();
  const shotstackId = (data as any).shotstack_render_id as string | null;
  if (shotstackId && (status === 'rendering' || status === 'queued')) {
    const key = await getVaultSecret('SHOTSTACK_API_KEY');
    if (key) {
      const host = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/edit/v1').replace(/\/$/, '');
      try {
        const r = await fetch(`${host}/render/${encodeURIComponent(shotstackId)}`, {
          headers: { 'x-api-key': key }, cache: 'no-store',
        });
        if (r.ok) {
          const jr = await r.json().catch(() => null) as any;
          const ssStatus = jr?.response?.status;
          if (ssStatus === 'done' && jr?.response?.url) {
            await sb.rpc('fn_video_edit_update', {
              p_id: id, p_status: 'done', p_shotstack_render_id: shotstackId,
            });
            return NextResponse.json({ ok: true, row: { ...data, status: 'done', output_url: jr.response.url } });
          }
          if (ssStatus === 'failed') {
            await sb.rpc('fn_video_edit_update', {
              p_id: id, p_status: 'failed', p_shotstack_render_id: shotstackId,
            });
            return NextResponse.json({ ok: true, row: { ...data, status: 'failed' } });
          }
        }
      } catch { /* silent */ }
    }
  }

  return NextResponse.json({ ok: true, row: data });
}
