// app/api/marketing/social/ai-draft/route.ts
// PBS 2026-08-20 · AI recon for Quick Post composer.
// Fix (2026-08-20 evening): correct import path + signature per lib/youtube/skills-common.
// callAnthropic signature: { systemPrompt, userPrompt, maxTokens?, model? } → LlmResult
//   LlmResult = { ok: true, text, usage } | { ok: false, error, detail? }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

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

  const TAG_CATEGORIES: Record<string, string[]> = {
    instagram:       ['subject','mood','activity','food_beverage','property_area','style'],
    pinterest:       ['subject','style','property_area','season'],
    tiktok:          ['activity','subject','mood'],
    facebook:        ['activity','subject','property_area'],
    linkedin:        ['activity','event'],
    google_business: [],
    x:               ['subject','activity'],
  };
  const tagCats = TAG_CATEGORIES[platform] ?? ['subject','activity'];

  const [specRes, tagsRes] = await Promise.all([
    sb.from('v_social_platform_specs')
      .select('platform, display_name, caption_max_chars, hashtags_allowed, hashtag_max, requires_title, notes')
      .eq('platform', platform).maybeSingle(),
    tagCats.length > 0
      ? sb.from('mkt_media_taxonomy').select('tag_slug,tag_label').in('category', tagCats).eq('is_active', true).limit(40)
      : Promise.resolve({ data: [] }),
  ]);

  const spec = specRes.data;
  const captionMax = (spec as { caption_max_chars?: number } | null)?.caption_max_chars ?? 500;
  const hashtagsAllowed = (spec as { hashtags_allowed?: boolean } | null)?.hashtags_allowed ?? true;
  const hashtagMax = hashtagsAllowed
    ? Math.min(15, (spec as { hashtag_max?: number } | null)?.hashtag_max ?? 15)
    : 0;
  const platformLabel = (spec as { display_name?: string } | null)?.display_name ?? platform;
  const propertyName = PROPERTY_NAME[property_id] ?? `Property ${property_id}`;

  const taxonomyTags = ((tagsRes as any)?.data ?? [])
    .map((t: { tag_slug: string }) => `#${t.tag_slug.replace(/_/g, '').toLowerCase()}`)
    .join(' ');

  const systemPrompt = 'You are a hospitality-industry social media copywriter. Respond only with valid JSON, no markdown, no prose.';
  const userPrompt = `You are a social media copywriter for ${propertyName}, a luxury boutique hotel. Draft ONE social post for ${platformLabel}.

Rules:
- Caption ≤ ${captionMax} characters (hard limit).
- ${hashtagMax > 0 ? `Include up to ${hashtagMax} on-brand hashtags at the end of the caption. Choose from or adapt these taxonomy tags: ${taxonomyTags.slice(0, 300)}.` : 'NO hashtags — platform disallows.'}
- Voice: warm, evocative, sensory, understated luxury. Never sales-y. Never emoji-heavy (max 1 emoji).
- Language: English.
${hint ? `- User hint / seed idea: "${hint.slice(0, 200)}"` : '- No user hint — pick a natural single moment (morning mist, temple bells, herbal tea, river silence, monk sweeping at dawn, etc.).'}

Respond in EXACTLY this JSON format, no prose:
{"caption": "...", "hashtags": "..."}

The hashtags field is a space-separated string (with # prefix) or an empty string if no hashtags allowed.`;

  const r = await callAnthropic({
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 400,
    systemPrompt,
    userPrompt,
  });

  if (!isLlmOk(r)) {
    return NextResponse.json({ ok: false, error: r.error, detail: r.detail }, { status: 502 });
  }

  // Find first JSON object in the response
  const m = r.text.match(/\{[\s\S]*\}/);
  let caption = '';
  let hashtags = '';
  try {
    const parsed = m ? JSON.parse(m[0]) : {};
    caption = String(parsed.caption ?? '').slice(0, captionMax);
    hashtags = String(parsed.hashtags ?? '').trim();
  } catch {
    // Fall back to the raw text
    caption = r.text.slice(0, captionMax);
  }

  return NextResponse.json({ ok: true, caption, hashtags, platform, captionMax, hashtagMax });
}
