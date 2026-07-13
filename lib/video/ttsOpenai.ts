// lib/video/ttsOpenai.ts
// PBS 2026-07-13 · Video AI Studio v1 — OpenAI TTS wrapper.
// Google Cloud TTS blocked by org policy; OpenAI supports API-key auth.
// Voices: alloy | echo | fable | onyx | nova | shimmer
// Cost: ~$15 per 1M chars via tts-1-hd model.
//
// Reads secret via fn_get_secret RPC:
//   OPENAI_TTS_API_KEY → OPENAI_IMAGE_KEY → process.env.OPENAI_API_KEY
//
// Uploads generated MP3 to `media-renders` bucket at tts/{uuid}.mp3 and
// returns the public URL. Callers wire the URL into a Shotstack audio track.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret } from '@/lib/youtube/skills-common';
import { randomUUID } from 'crypto';

export type OpenAiVoice = 'alloy'|'echo'|'fable'|'onyx'|'nova'|'shimmer';

export interface TtsResult {
  ok: boolean;
  url?: string;
  duration_estimate_sec?: number;
  error?: string;
  char_count?: number;
  cost_usd_est?: number;
}

async function resolveKey(): Promise<string | null> {
  const a = await getVaultSecret('OPENAI_TTS_API_KEY');
  if (a) return a;
  const b = await getVaultSecret('OPENAI_IMAGE_KEY');
  if (b) return b;
  return process.env.OPENAI_API_KEY ?? null;
}

export async function ttsOpenAI(script: string, voice: OpenAiVoice = 'nova'): Promise<TtsResult> {
  const clean = (script ?? '').trim();
  if (!clean) return { ok: false, error: 'empty_script' };
  if (clean.length > 4000) return { ok: false, error: 'script_too_long_max_4000_chars' };

  const key = await resolveKey();
  if (!key) return { ok: false, error: 'no_openai_key_available' };

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', input: clean, voice, response_format: 'mp3' }),
    });
  } catch (e: any) {
    return { ok: false, error: 'openai_fetch_crash:' + (e?.message ?? 'unknown') };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 240);
    return { ok: false, error: 'openai_' + res.status + ':' + detail };
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // Upload to media-renders/tts/{uuid}.mp3
  const sb = getSupabaseAdmin();
  const key2 = 'tts/' + randomUUID() + '.mp3';
  const up = await sb.storage.from('media-renders').upload(key2, buf, {
    contentType: 'audio/mpeg', upsert: false, cacheControl: 'public, max-age=31536000',
  });
  if (up.error) return { ok: false, error: 'storage_upload_failed:' + up.error.message };
  const pub = sb.storage.from('media-renders').getPublicUrl(key2);
  const url = pub.data?.publicUrl ?? null;
  if (!url) return { ok: false, error: 'no_public_url_returned' };

  // Rough duration estimate: 150 wpm → 2.5 words/sec → ~13 chars/sec.
  const durationEstimate = Math.max(1, Math.round(clean.length / 13));
  const cost = (clean.length / 1_000_000) * 15; // tts-1-hd = $15 per 1M chars.
  return {
    ok: true, url, duration_estimate_sec: durationEstimate,
    char_count: clean.length, cost_usd_est: Math.round(cost * 10000) / 10000,
  };
}
