// lib/video/shotstackBuilder.ts
// PBS 2026-07-13 · Video AI Studio v1 — programmatic Shotstack EDL builder.
// Composes opener + main sequence + closer + music + voiceover tracks.
// Reference: https://shotstack.io/docs/api/
//
// Shotstack VALID image `effect` enum (as of v1):
//   zoomIn, zoomInSlow, zoomInFast, zoomOut, zoomOutSlow, zoomOutFast,
//   slideLeft, slideLeftSlow, slideLeftFast, slideRight, slideRightSlow,
//   slideRightFast, slideUp, slideUpSlow, slideUpFast, slideDown,
//   slideDownSlow, slideDownFast
// Do NOT use 'kenBurns' — that is a colloquial name, not a Shotstack value.
//
// Task-0 fix: prior EDL used `effect: 'kenBurns'` which caused every render
// since 2026-07-12 to return HTTP 400 "invalid_config" from Shotstack.

export type ShotstackClip = Record<string, unknown>;
export type ShotstackTrack = { clips: ShotstackClip[] };

export interface OpenerLayerText { type:'text'; text: string; position?: 'top'|'center'|'bottom'; style?: 'title'|'subtitle' }
export interface OpenerLayerImage { type:'image'; src: string; position?: string }
export type OpenerLayer = OpenerLayerText | OpenerLayerImage;

export interface OpenerCloserConfig {
  duration_sec?: number;
  tagline?: string;
  logo_url?: string | null;
  primary_color?: string;
  layers?: OpenerLayer[];
}

export interface MediaShot {
  asset_id: string;
  public_url: string;
  mime_type?: string | null;
  duration_sec?: number | null;
  is_video?: boolean;
}

export interface MusicTrackInput {
  url: string;
  duration_sec?: number;
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

function isVideoAsset(a: MediaShot): boolean {
  if (a.is_video) return true;
  const mt = (a.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test((a.public_url ?? '').toLowerCase());
}

/**
 * Build opener title-card layers from config. Runs 0..duration.
 * Uses Shotstack HTML asset for text (title / subtitle).
 */
export function buildOpenerLayers(cfg: OpenerCloserConfig, startAt = 0): ShotstackClip[] {
  const dur = Math.max(1, Number(cfg?.duration_sec ?? 2.5));
  const primary = cfg?.primary_color ?? '#084838';
  const layers = (cfg?.layers ?? []) as OpenerLayer[];
  const out: ShotstackClip[] = [];

  // Background solid color card via HTML asset.
  out.push({
    asset: {
      type: 'html',
      html: '<div class="bg"></div>',
      css: '.bg { width:100%; height:100%; background:' + primary + '; }',
      width: 1920, height: 1080,
    },
    start: startAt, length: dur,
    transition: { in: 'fade', out: 'fade' },
  });

  for (const layer of layers) {
    if (layer.type === 'text') {
      const isTitle = layer.style === 'title';
      const size = isTitle ? 72 : 28;
      const color = '#FFFFFF';
      const y = layer.position === 'top' ? '-30%' : layer.position === 'bottom' ? '30%' : '0%';
      out.push({
        asset: {
          type: 'html',
          html: '<div class="t">' + (layer.text || '').replace(/</g,'&lt;') + '</div>',
          css: '.t { font-family: sans-serif; font-size:' + size + 'px; font-weight:' + (isTitle ? 700 : 400) + '; color:' + color + '; text-align:center; letter-spacing:' + (isTitle ? '0.08em' : '0.16em') + '; }',
          width: 1600, height: 240,
        },
        start: startAt, length: dur,
        offset: { y: y === '0%' ? 0 : (y === '-30%' ? 0.15 : -0.15) },
      });
    } else if (layer.type === 'image' && layer.src) {
      out.push({
        asset: { type: 'image', src: layer.src },
        start: startAt, length: dur,
        fit: 'contain',
      });
    }
  }
  return out;
}

/**
 * Build closer layers. Same as opener but tagline defaults to contact strip.
 */
export function buildCloserLayers(cfg: OpenerCloserConfig, startAt: number, contacts?: { domain?: string; ig?: string; email?: string }): ShotstackClip[] {
  // If layers empty, synthesize from contacts.
  const synth = { ...cfg } as OpenerCloserConfig;
  if (!synth.layers || synth.layers.length === 0) {
    const layers: OpenerLayer[] = [];
    if (contacts?.domain) layers.push({ type: 'text', text: contacts.domain, position: 'center', style: 'title' });
    const sub: string[] = [];
    if (contacts?.ig) sub.push(contacts.ig);
    if (contacts?.email) sub.push(contacts.email);
    if (sub.length) layers.push({ type: 'text', text: sub.join('  ·  '), position: 'bottom', style: 'subtitle' });
    synth.layers = layers;
  }
  return buildOpenerLayers(synth, startAt);
}

/**
 * Build the main sequence: per-shot clips with style-driven avg duration
 * and safe effect / transition choices.
 */
export function buildMainSequence(
  shots: MediaShot[],
  style: 'cinematic' | 'snappy' | 'editorial' | 'casual',
  avgDurSec: number,
  startAt = 0,
): { clips: ShotstackClip[]; total_duration: number } {
  const transitions = {
    cinematic: 'fade',
    snappy: 'zoom',
    editorial: 'wipeLeft',
    casual: 'fade',
  } as const;
  const effects = {
    cinematic: ['zoomInSlow', 'zoomOutSlow', 'slideRightSlow', 'slideLeftSlow'],
    snappy: ['zoomInFast', 'zoomOutFast', 'slideLeftFast', 'slideRightFast'],
    editorial: ['zoomIn', 'slideLeft', 'slideRight', 'zoomOut'],
    casual: ['zoomIn', 'zoomOut', 'slideRight'],
  } as const;
  const eff = effects[style] ?? effects.cinematic;
  const trans = transitions[style] ?? 'fade';

  const dur = Math.max(1.2, Number(avgDurSec || 3.5));
  let cursor = startAt;
  const clips: ShotstackClip[] = [];
  shots.forEach((shot, i) => {
    const isVid = isVideoAsset(shot);
    const clipDur = isVid && shot.duration_sec ? Math.min(dur, Number(shot.duration_sec)) : dur;
    const clip: ShotstackClip = {
      asset: isVid
        ? { type: 'video', src: shot.public_url, trim: 0 }
        : { type: 'image', src: shot.public_url },
      start: cursor,
      length: clipDur,
      transition: { in: trans, out: trans },
    };
    if (!isVid) (clip as any).effect = safeEffect(eff[i % eff.length]);
    clips.push(clip);
    cursor += clipDur;
  });
  return { clips, total_duration: cursor - startAt };
}

export function buildMusicTrack(track: MusicTrackInput, duration: number): ShotstackTrack {
  return {
    clips: [{
      asset: { type: 'audio', src: track.url, volume: 0.35 },
      start: 0, length: Math.max(1, duration),
    }],
  };
}

export function buildVoiceoverTrack(mp3Url: string, duration: number, startAt = 0): ShotstackTrack {
  return {
    clips: [{
      asset: { type: 'audio', src: mp3Url, volume: 1.0 },
      start: startAt, length: Math.max(1, duration),
    }],
  };
}

/**
 * Assemble the full EDL. Track order (top-to-bottom, first is FRONT):
 *   1. Opener/closer overlays (text layers)
 *   2. Main visual sequence
 *   3. Voiceover audio
 *   4. Music bed
 */
export function assembleEDL(params: {
  opener_layers: ShotstackClip[];
  main_clips: ShotstackClip[];
  closer_layers: ShotstackClip[];
  music?: ShotstackTrack | null;
  voice?: ShotstackTrack | null;
  aspect: string;
  resolution?: 'sd' | 'hd' | '1080';
  background?: string;
}): Record<string, unknown> {
  const tracks: ShotstackTrack[] = [];
  const overlays = [...params.opener_layers, ...params.closer_layers];
  if (overlays.length > 0) tracks.push({ clips: overlays });
  tracks.push({ clips: params.main_clips });
  if (params.voice) tracks.push(params.voice);
  if (params.music) tracks.push(params.music);
  return {
    timeline: {
      background: params.background ?? '#000000',
      tracks,
    },
    output: {
      format: 'mp4',
      resolution: params.resolution ?? 'hd',
      aspectRatio: params.aspect ?? '16:9',
    },
  };
}
