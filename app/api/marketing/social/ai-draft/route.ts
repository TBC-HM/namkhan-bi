// app/api/marketing/social/ai-draft/route.ts
// PBS 2026-08-20 — AI recon for Quick Post composer.
// Given { platform, property_id, hint? } → returns { ok, caption, hashtags }.
// Uses Anthropic via lib/skills-common (callAnthropic) to draft a brand-safe
// caption sized to the platform's caption_max_chars from v_social_platform_specs
// and respecting hashtag_max. Reads property brand tone from a lightweight
// property snapshot (name + hodTagline placeholder).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic } from '@/lib/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const PROPERTY_NAME: Record<number, string> = {
  260955: 'The Namkhan · Luang Prabang',
  1000001: 'The Donna Portals · Mallorca',
};

export async function POST(req: NextRequest) {
  let b: { platform?: string; property_id?: number; hint?: string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const platform = String(b.platform || '');
  const property_id = Number(b.property_id) || 260955;
  const hint = (b.hint ?? '').toString().trim();
  if (!platform) return NextResponse.json({ ok: false, error: 'platform required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: spec } = await sb.from('v_social_platform_specs')
    .select('platform, display_name, caption_max_chars, hashtags_allowed, hashtag_max, requires_title, notes')
    .eq('platform', platform).maybeSingle();

  const captionMax = (spec as { caption_max_chars?: number } | null)?.caption_max_chars ?? 500;
  const hashtagMax = (spec as { hashtags_allowed?: boolean; hashtag_max?: number } | null)?.hashtags_allowed
    ? Math.min(15, (spec as { hashtag_max?: number }).hashtag_max ?? 15)
    : 0;
  const platformLabel = (spec as { display_name?: string } | null)?.display_name ?? platform;
  const propertyName = PROPERTY_NAME[property_id] ?? `Property ${property_id}`;

  const prompt = `You are a social media copywriter for ${propertyName}, a luxury boutique hotel. Draft ONE social post for ${platformLabel}.

Rules:
- Caption ≤ ${captionMax} characters (hard limit)
- ${hashtagMax > 0 ? `Include up to ${hashtagMax} on-brand hashtags at the end of the caption. Use lowercase relevant tags (e.g. #luangprabang #laos #wellness).` : 'NO hashtags — platform disallows.'}
- Voice: warm, evocative, sensory, understated luxury. Never sales-y. Never emoji-heavy (max 1 emoji).
- Language: English.
${hint ? `- User hint / seed idea: "${hint.slice(0, 200)}"` : '- No user hint — pick a natural single moment (a sensory detail: morning mist, temple bells, herbal tea, river silence, monk sweeping at dawn, etc.).'}

Respond in EXACTLY this JSON format, no prose:
{"caption": "...", "hashtags": "..."}

The hashtags field is a space-separated string of hashtags (with # prefix) or empty string if no hashtags allowed.`;

  try {
    const raw = await callAnthropic({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      system: 'You are a hospitality-industry social media copywriter. Respond only with valid JSON, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    });
    // callAnthropic returns { text } or a raw string depending on shape
    let text: string;
    if (typeof raw === 'string') text = raw;
    else if (raw && typeof raw === 'object' && 'text' in raw) text = String((raw as { text: unknown }).text);
    else text = JSON.stringify(raw);
    // Find first JSON object
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    const caption = String(parsed.caption ?? '').slice(0, captionMax);
    const hashtags = String(parsed.hashtags ?? '').trim();
    return NextResponse.json({ ok: true, caption, hashtags, platform, captionMax, hashtagMax });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'AI draft failed' }, { status: 502 });
  }
}
