// app/api/marketing/media/video-design/route.ts
// PBS 2026-07-13 · Video AI Studio v1 — prompt-first design pipeline.
// Runs: prompt → AI shot selection → thumbnails preview → EDL preview.
// Does NOT dispatch to Shotstack yet — that stays in video-render/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { selectShots } from '@/lib/video/aiShotSelector';
import { searchMusic } from '@/lib/video/musicPixabay';
import { generateThumbnails, ensureBucket } from '@/lib/video/thumbnailGenerator';
import {
  buildOpenerLayers, buildCloserLayers, buildMainSequence,
  buildMusicTrack, buildVoiceoverTrack, assembleEDL,
} from '@/lib/video/shotstackBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  property_id: number;
  prompt: string;
  length_sec: number;
  style: 'cinematic'|'snappy'|'editorial'|'casual';
  channel: 'youtube_16_9'|'youtube_shorts_9_16'|'instagram_reels'|'tiktok'|'facebook'|'website_hero';
  voiceover_mode: 'none'|'openai_tts'|'upload';
  voice_id?: string;
  music_mood?: 'ambient'|'upbeat'|'emotional'|'cinematic'|'none';
  areas_included?: string[];
  title?: string | null;
  tagline?: string | null;
  preset_key?: string | null;
  include_thumbnails?: boolean;
}

function aspectFor(channel: string): string {
  if (channel === 'youtube_shorts_9_16' || channel === 'tiktok' || channel === 'instagram_reels') return '9:16';
  if (channel === 'website_hero') return '16:9';
  return '16:9';
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: Payload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, prompt, length_sec, style, channel } = body || ({} as Payload);
  if (!property_id || !prompt || !length_sec || !style || !channel) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // 1. Look up style preset for opener/closer/music/voice defaults.
  const presetKey = body.preset_key ?? style;
  const { data: presetRow } = await sb.from('v_video_style_presets')
    .select('*').eq('channel', channel).eq('preset_key', presetKey)
    .or('property_id.is.null,property_id.eq.' + property_id)
    .maybeSingle();
  const preset = (presetRow as any) ?? null;
  const avgShot = Number(preset?.avg_shot_duration_sec ?? 3.5);

  // 2. AI shot selection.
  const selection = await selectShots(prompt, {
    targetLength: length_sec, style,
    avgShotDurationSec: avgShot,
    areasIncluded: body.areas_included ?? [],
    propertyId: property_id,
    includeVideoAssets: false,
  });

  if (selection.shots.length === 0) {
    return NextResponse.json({ error: 'no_shots_matched', detail: 'AI could not find enough library assets matching this prompt' }, { status: 422 });
  }

  // 3. Music search.
  const mood = body.music_mood && body.music_mood !== 'none'
    ? body.music_mood
    : (preset?.music_mood ?? 'ambient');
  const musicTracks = await searchMusic(mood, Math.max(30, length_sec), Math.max(60, length_sec * 6));
  const chosenTrack = musicTracks[0] ?? null;

  // 4. Preview thumbnails (skip when include_thumbnails=false).
  let thumbnails: any[] = [];
  const thumbAssetId = selection.thumbnailAssetId;
  if (body.include_thumbnails !== false && thumbAssetId) {
    await ensureBucket('media-thumbnails');
    const thumbShot = selection.shots.find(s => s.asset_id === thumbAssetId) ?? selection.shots[0];
    if (thumbShot?.public_url) {
      thumbnails = await generateThumbnails(
        thumbShot.public_url,
        body.title ?? 'THE NAMKHAN',
        body.tagline ?? 'Luang Prabang · Laos',
        { render_id: 'preview_' + Date.now() + '_' + property_id, primary_color: preset?.opener_config?.primary_color ?? '#084838' },
      );
    }
  }

  // 5. Assemble EDL preview.
  const openerCfg = (preset?.opener_config ?? { duration_sec: 2.5, tagline: 'THE NAMKHAN', primary_color: '#084838' });
  const closerCfg = (preset?.closer_config ?? { duration_sec: 3.0, tagline: 'thenamkhan.com', primary_color: '#084838' });

  const openerLayers = buildOpenerLayers(openerCfg, 0);
  const openerDur = Number(openerCfg.duration_sec ?? 2.5);

  const main = buildMainSequence(selection.shots, style, avgShot, openerDur);
  const closerStart = openerDur + main.total_duration;

  const closerLayers = buildCloserLayers(closerCfg, closerStart, {
    domain: 'thenamkhan.com', ig: '@thenamkhan', email: 'stay@thenamkhan.com',
  });
  const closerDur = Number(closerCfg.duration_sec ?? 3.0);
  const totalDuration = closerStart + closerDur;

  const music = chosenTrack ? buildMusicTrack({ url: chosenTrack.url }, totalDuration) : null;
  const voice = null; // Voice added at RENDER time (tts call happens in video-render).

  const edl = assembleEDL({
    opener_layers: openerLayers,
    main_clips: main.clips,
    closer_layers: closerLayers,
    music,
    voice,
    aspect: aspectFor(channel),
  });

  return NextResponse.json({
    ok: true,
    shots: selection.shots.map(s => ({
      asset_id: s.asset_id, public_url: s.public_url,
      area: (s as any).area ?? null, tier: (s as any).tier ?? null,
      reason: (s as any).reason ?? null,
    })),
    script: selection.script,
    scenes: selection.scenes,
    keywords: selection.keywords,
    music: chosenTrack ? {
      id: chosenTrack.id, title: chosenTrack.title, artist: chosenTrack.artist,
      url: chosenTrack.url, mood_tags: chosenTrack.mood_tags, source: chosenTrack.source,
    } : null,
    thumbnails,
    thumbnail_asset_id: thumbAssetId,
    edl_preview: edl,
    total_duration_sec: totalDuration,
    preset: preset ? {
      preset_key: preset.preset_key, channel: preset.channel,
      opener_config: preset.opener_config, closer_config: preset.closer_config,
      music_mood: preset.music_mood, voice_id: preset.voice_id,
    } : null,
  });
}
