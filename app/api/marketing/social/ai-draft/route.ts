// app/api/marketing/social/ai-draft/route.ts
// PBS 2026-08-20 · AI recon for Quick Post composer.
// Fix (2026-08-20 evening): correct import path + signature per lib/youtube/skills-common.
// callAnthropic signature: { systemPrompt, userPrompt, maxTokens?, model? } → LlmResult
//   LlmResult = { ok: true, text, usage } | { ok: false, error, detail? }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const PROPERTY_NAME: Record<number, string> = {
  260955: 'The Namkhan · Luang Prabang',
  1000001: 'The Donna Portals · Mallorca',
};

export async function POST(req: NextRequest) {
  let b: { platform?: string; property_id?: number; hint?: string | null; category_code?: string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const platform = String(b.platform || '');
  if (!platform) return NextResponse.json({ ok: false, error: 'platform required' }, { status: 400 });
  if (!b.property_id) return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  const property_id = await requirePropertyAccess(req, b.property_id);
  const hint = (b.hint ?? '').toString().trim();
  const categoryCode = (b.category_code ?? '').toString().toLowerCase().trim();

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

  const [specRes, tagsRes, linksRes, briefRes] = await Promise.all([
    sb.from('v_social_platform_specs')
      .select('platform, display_name, caption_max_chars, hashtags_allowed, hashtag_max, requires_title, notes')
      .eq('platform', platform).maybeSingle(),
    tagCats.length > 0
      ? sb.from('mkt_media_taxonomy').select('tag_slug,tag_label').in('category', tagCats).eq('is_active', true).limit(40)
      : Promise.resolve({ data: [] }),
    sb.from('v_marketing_internal_link_catalog')
      .select('id,title,url,section,anchor_hint')
      .eq('property_id', property_id)
      .eq('active', true)
      .order('is_pinned', { ascending: false })
      .limit(30),
    sb.rpc('fn_social_property_brief', { p_property_id: property_id }),
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

  type LinkRow = { id: number; title: string; url: string; section: string; anchor_hint: string | null };
  const links: LinkRow[] = (linksRes as any)?.data ?? [];
  const linkMenu = links.map(l => `${l.id}|${l.section}|${l.title}`).join(', ');

  // Property knowledge base — real rooms, spa, activities, season, retreats
  const brief = (briefRes as any)?.data ?? {};
  const roomLines = (brief.rooms ?? []).map((r: any) =>
    `• ${r.name}${r.size_sqm ? ` (${r.size_sqm}m²)` : ''}${r.view ? `, ${r.view} view` : ''}${r.pitch ? ` — ${r.pitch}` : ''}`
  ).join('\n');
  const spaLines = (brief.spa ?? []).map((s: any) =>
    `• ${s.name}${s.duration_min ? ` · ${s.duration_min}min` : ''}${s.price_usd != null ? ` · $${s.price_usd}` : ''}`
  ).join('\n');
  const activityLines = (brief.activities ?? []).map((a: any) =>
    `• ${a.name}${a.price_amount != null ? ` · $${a.price_amount}` : ''}${a.description ? ` — ${a.description.slice(0, 100)}` : ''}`
  ).join('\n');
  const season = brief.current_season
    ? `${brief.current_season.name} (${brief.current_season.start} – ${brief.current_season.end})`
    : 'no current season defined';
  const retreatLines = (brief.retreats ?? []).map((r: any) =>
    `• ${r.name}${r.min_nights ? ` · min ${r.min_nights} nights` : ''}${r.pitch ? ` — ${r.pitch}` : ''}`
  ).join('\n');

  const propertyKnowledge = [
    roomLines ? `ROOMS:\n${roomLines}` : '',
    spaLines ? `SPA TREATMENTS:\n${spaLines}` : '',
    activityLines ? `ACTIVITIES:\n${activityLines}` : '',
    `CURRENT SEASON: ${season}`,
    retreatLines ? `RETREAT PROGRAMS:\n${retreatLines}` : '',
  ].filter(Boolean).join('\n\n');

  const PHOTO_AREAS = ['restaurant','lifestyle','rooms','grounds','pool','Organic Farm','activities','luang_prabang'];

  // Category-aware hashtag pools — infer from explicit code OR hint text (post title)
  const isRetreat = categoryCode.includes('retreat') || categoryCode.includes('wellness') || categoryCode.includes('mindful')
    || hint.toLowerCase().includes('retreat') || hint.toLowerCase().includes('wellness');
  const categoryHashtags = isRetreat
    ? '#retreats #wellness #mindfultravel #yogaretreat #wellnesstravel #retreatlife #digitaldetox #slowtravel #luangprabang #namkhan'
    : '';

  const systemPrompt = 'You are a hospitality-industry social media copywriter. Respond only with valid JSON, no markdown, no prose.';
  const userPrompt = `You are a social media copywriter for ${propertyName}, a luxury boutique hotel in Luang Prabang, Laos. Draft ONE social post for ${platformLabel}.

HARD RULES — violation = rejected post:
1. Caption MUST be ≤ ${captionMax} characters. COUNT CAREFULLY. This is an absolute limit — do not exceed it.
2. NEVER mention prices, rates, nightly costs, "all-inclusive", or any monetary figure — not even approximate ones. Direct readers to the website or say "Book direct" instead.
3. Only use facts from the PROPERTY DATA below. Never invent room names, spa treatments, or experiences.

STYLE:
- Voice: warm, evocative, sensory, understated luxury. Never sales-y. Max 1 emoji.
- Language: English.
${hint ? `- Seed idea: "${hint.slice(0, 200)}"` : '- No seed — pick one natural moment (morning mist, temple bells, herbal tea on the terrace, monk at dawn, river light, bamboo silence).'}

HASHTAGS:
${hashtagMax > 0
  ? `Include up to ${hashtagMax} hashtags. ${isRetreat ? `Since this is a RETREAT post, prioritise these retreat hashtags: ${categoryHashtags}. Mix with property tags from: ` : 'Choose from: '}${taxonomyTags.slice(0, 300)}.`
  : 'NO hashtags — platform disallows.'}

PROPERTY DATA (use this, never invent):
${propertyKnowledge}

LINK CATALOG (pick the most relevant id, or null):
${linkMenu}

PHOTO AREA (pick from: ${PHOTO_AREAS.join(', ')} — or null):
Choose the area that best matches the post topic. Retreat posts → lifestyle or grounds. Spa posts → lifestyle. Restaurant posts → restaurant.

Respond in EXACTLY this JSON format, no other text:
{"caption": "...", "hashtags": "...", "link_id": null, "photo_area": null}

Hashtags field: space-separated string with # prefix, or "" if not allowed.`;

  // Safety truncation: if AI still over-generates, hard-clamp at captionMax before returning

  const r = await callAnthropic({
    model: 'claude-sonnet-4-6',
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
  let linkId: number | null = null;
  let photoArea: string | null = null;
  try {
    const parsed = m ? JSON.parse(m[0]) : {};
    caption   = String(parsed.caption ?? '').slice(0, captionMax);
    hashtags  = String(parsed.hashtags ?? '').trim();
    linkId    = typeof parsed.link_id === 'number' ? parsed.link_id : null;
    photoArea = typeof parsed.photo_area === 'string' ? parsed.photo_area : null;
  } catch {
    caption = r.text.slice(0, captionMax);
  }

  // Resolve suggested link
  const suggestedLink = linkId != null ? links.find(l => l.id === linkId) ?? null : null;

  // Fetch one photo from the suggested area
  let mediaUrl: string | null = null;
  if (photoArea) {
    const photoQ = sb.from('mkt_v_media_ready')
      .select('raw_path,renders')
      .eq('property_id', property_id)
      .eq('property_area', photoArea)
      .eq('asset_type', 'photo')
      .contains('usage_rights', ['social_organic'])
      .order('captured_at', { ascending: false, nullsFirst: false })
      .limit(1);
    const { data: photos } = await photoQ;
    if (photos && photos.length > 0) {
      const ph = photos[0] as { raw_path: string | null; renders: Record<string, string> | null };
      const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media`;
      mediaUrl = ph.renders?.web_2k
        ? `${STORAGE_BASE}/${ph.renders.web_2k}`
        : ph.raw_path ? `${STORAGE_BASE}/${ph.raw_path}` : null;
    }
  }

  return NextResponse.json({
    ok: true, caption, hashtags, platform, captionMax, hashtagMax,
    link_url:   suggestedLink?.url   ?? null,
    link_title: suggestedLink?.title ?? null,
    media_url:  mediaUrl,
    photo_area: photoArea,
  });
}
