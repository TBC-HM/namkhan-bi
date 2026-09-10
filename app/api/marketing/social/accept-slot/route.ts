// app/api/marketing/social/accept-slot/route.ts
// spec-social-media-module (2026-07-25, run 2) · A6 — accept a social calendar
// slot. Wraps public.fn_social_slot_accept (SECURITY DEFINER), which creates a
// draft row in marketing.social_posts (status='draft'), links it via
// linked_post_id, and flips the slot to status='accepted'. Idempotent: a slot
// with an existing linked post returns that post.
//
// AI enhancement (2026-09-03): after slot acceptance, auto-generates caption +
// hashtags from mkt_media_taxonomy and writes back via fn_social_post_update.
// Idempotent slots (already=true) skip AI — draft already has content.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fallback area order when no photo found by asset_id (quality_index > 75 filter)
const PHOTO_AREA_FALLBACKS = ['lifestyle', 'restaurant', 'grounds', 'rooms', 'pool'];

const SYSTEM_PROMPT =
  `You are Lumen, social content lead for The Namkhan — a 24-room Small Luxury Hotels of the World jungle eco-lodge in Luang Prabang, Laos, with an organic eco-farm on the Nam Khan river. Voice: warm, sensory, understated luxury; Lao provenance; never salesy or cliché; no exclamation spam; max 1 emoji if it adds warmth.
Return ONLY valid JSON, no prose, no markdown: {"caption":"...","hashtags":["#tag1","#tag2"],"photo_id":"<uuid>","link_id":<number>}`;

const HASHTAG_CATEGORIES: Record<string, string[]> = {
  instagram:       ['subject','mood','activity','food_beverage','property_area','style'],
  pinterest:       ['subject','style','property_area','season','time_of_day'],
  tiktok:          ['activity','subject','mood'],
  facebook:        ['activity','subject','property_area'],
  linkedin:        ['activity','event','food_beverage'],
  google_business: [],
  x:               ['subject','activity'],
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slot_id = Number(body?.slot_id);
  if (!slot_id || !Number.isFinite(slot_id)) {
    return NextResponse.json({ ok: false, error: 'slot_id required' }, { status: 400 });
  }
  const rawPropertyId = body?.property_id;
  if (!rawPropertyId) {
    return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  }
  const propertyId = await requirePropertyAccess(req, rawPropertyId);

  const sb = getSupabaseAdmin();

  // 1. Accept slot (SECURITY DEFINER — creates blank draft or returns existing)
  const { data, error } = await sb.rpc('fn_social_slot_accept', { p_slot_id: slot_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const payload = (data ?? {}) as { post_id?: string; slot_id?: number; already?: boolean };
  if (!payload.post_id) {
    return NextResponse.json({ ok: false, error: 'no post_id returned' }, { status: 500 });
  }

  // 2. Idempotent — draft already existed, skip AI
  if (payload.already) {
    return NextResponse.json({ ok: true, post_id: payload.post_id, already: true });
  }

  // 3. Fetch slot context + platform spec in parallel
  const [slotRes, specRes] = await Promise.all([
    sb.from('v_social_calendar_slots')
      .select('property_id,platform,slot_date,category_code,program_label,format,title,hook,brief_md')
      .eq('slot_id', slot_id)
      .eq('property_id', propertyId)
      .maybeSingle(),
    Promise.resolve(null), // placeholder — spec fetched below once we know the platform
  ]);
  void specRes;

  const slot = slotRes.data;
  if (!slot) {
    return NextResponse.json({ ok: true, post_id: payload.post_id, already: false, ai_skipped: 'no_slot_context' });
  }

  // 4. Fetch platform spec, channel rule, hashtag candidates, link catalog, and top photos in parallel
  const tagCategories = HASHTAG_CATEGORIES[slot.platform] ?? ['subject', 'activity'];
  const [{ data: spec }, { data: rule }, tagsRes, linksRes, photosRes] = await Promise.all([
    sb.from('v_social_platform_specs')
      .select('caption_max_chars,hashtags_allowed,hashtag_max,requires_title,title_max_chars')
      .eq('platform', slot.platform)
      .maybeSingle(),
    sb.from('v_social_channel_rules')
      .select('audience_notes,banned_topics')
      .eq('property_id', slot.property_id)
      .eq('platform', slot.platform)
      .maybeSingle(),
    tagCategories.length > 0
      ? sb.from('mkt_media_taxonomy')
          .select('tag_slug,tag_label')
          .in('category', tagCategories)
          .eq('is_active', true)
          .limit(50)
      : Promise.resolve({ data: [] }),
    sb.from('v_marketing_internal_link_catalog')
      .select('id,title,url,is_pinned')
      .eq('property_id', slot.property_id)
      .eq('active', true)
      .order('is_pinned', { ascending: false })
      .limit(20),
    // Top-scored photos (quality_index > 75) with captions — AI picks by asset_id
    sb.from('mkt_v_media_ready')
      .select('asset_id,caption,alt_text,property_area,renders,raw_path')
      .eq('property_id', slot.property_id)
      .eq('asset_type', 'photo')
      .contains('usage_rights', ['social_organic'])
      .not('raw_path', 'is', null)
      .gt('quality_index', 75)
      .order('quality_index', { ascending: false })
      .limit(20),
  ]);

  const captionMax = (spec as any)?.caption_max_chars ?? 500;
  const hashtagsAllowed = (spec as any)?.hashtags_allowed !== false;
  const hashtagMax = hashtagsAllowed ? Math.min(15, (spec as any)?.hashtag_max ?? 15) : 0;
  const requiresTitle = (spec as any)?.requires_title === true;
  const titleMax = (spec as any)?.title_max_chars ?? 100;

  const audienceNotes = (rule as any)?.audience_notes as string | null;
  const bannedTopics  = (rule as any)?.banned_topics  as string[] | null;

  const hashtagCandidates = ((tagsRes as any)?.data ?? []).map(
    (t: { tag_slug: string; tag_label: string }) =>
      `#${t.tag_slug.replace(/_/g, '')} (${t.tag_label})`
  ) as string[];

  type LinkRow = { id: number; title: string; url: string; is_pinned: boolean };
  const links: LinkRow[] = (linksRes as any)?.data ?? [];
  const linkMenu = links.map((l) => `${l.id}|${l.title}`).join(', ');
  const defaultLink = links.find((l) => l.is_pinned) ?? links[0] ?? null;

  type PhotoCandidate = { asset_id: string; caption: string | null; alt_text: string | null; property_area: string | null; renders: Record<string,string> | null; raw_path: string | null };
  const photos: PhotoCandidate[] = (photosRes as any)?.data ?? [];
  const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media`;
  const photoMap = new Map(photos.map((p) => [p.asset_id, p]));
  const photoMenu = photos
    .map((p) => `${p.asset_id} | ${p.caption ?? p.alt_text ?? p.property_area ?? 'photo'} | ${p.property_area ?? ''}`)
    .join('\n');

  // 5. Build AI prompt from real slot data + channel rule context
  const slotLines = [
    slot.title    && `Title: ${slot.title}`,
    slot.hook     && `Hook: ${slot.hook}`,
    slot.brief_md && `Brief: ${slot.brief_md}`,
    slot.format   && `Format: ${slot.format}`,
    slot.program_label && `Programme: ${slot.program_label}`,
    slot.category_code && `Category: ${slot.category_code}`,
    `Post date: ${slot.slot_date}`,
    `Platform: ${slot.platform}`,
  ].filter(Boolean).join('\n');

  const channelContext = [
    audienceNotes && audienceNotes !== 'n/a' && `Target audience: ${audienceNotes}`,
    bannedTopics && bannedTopics.length > 0 && `Never mention: ${bannedTopics.join(', ')}`,
  ].filter(Boolean).join('\n');

  const hashtagLine = hashtagMax > 0 && hashtagCandidates.length > 0
    ? `Pick up to ${hashtagMax} hashtags from these brand-taxonomy candidates (or derive natural variants): ${hashtagCandidates.slice(0, 25).join(', ')}`
    : 'No hashtags for this platform — return hashtags as an empty array.';

  const titleLine = requiresTitle
    ? `Also write a pin TITLE (max ${titleMax} chars, keyword-first, no hashtags) in the "title" field.`
    : '';

  const userPrompt = `Write one ${slot.platform} post for this calendar slot:
${slotLines}
${channelContext ? `\n${channelContext}` : ''}
Caption limit: ${captionMax} characters (HARD LIMIT — count every character including hashtags; do not exceed under any circumstances).
${titleLine}
${hashtagLine}
PHOTO — pick the asset_id of the photo whose caption best matches this post's tone and subject. All listed photos have quality_index > 75. Return its UUID in "photo_id". You MUST pick one:
${photoMenu || '(no photos available — use null)'}

LINK — pick the single most relevant link id. ALWAYS return a link_id number — never return null. Default to id 1 (booking) when no specific match:
${linkMenu || '(none available)'}

Return ONLY valid JSON: {"caption":"...","hashtags":["#tag",...],"photo_id":"<uuid>","link_id":<number>${requiresTitle ? ',"title":"..."' : ''}}`;

  // 6. Call AI
  const aiResult = await callAnthropic({
    model: 'claude-sonnet-4-6',
    maxTokens: 600,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  if (!isLlmOk(aiResult)) {
    return NextResponse.json({ ok: true, post_id: payload.post_id, already: false, ai_skipped: aiResult.error });
  }

  // 7. Parse AI response
  let caption = '';
  let hashtags: string[] = [];
  let photoId: string | null = null;
  let linkId: number | null = null;
  let aiTitle: string | null = null;
  try {
    const m = aiResult.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      caption  = String(parsed.caption ?? '').slice(0, captionMax).trim();
      hashtags = Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).filter((h) => typeof h === 'string').slice(0, hashtagMax)
        : [];
      photoId  = typeof parsed.photo_id === 'string' && photoMap.has(parsed.photo_id)
        ? parsed.photo_id : null;
      linkId   = typeof parsed.link_id === 'number' ? parsed.link_id : null;
      if (requiresTitle && parsed.title) aiTitle = String(parsed.title).slice(0, titleMax);
    }
  } catch { /* draft keeps brief_md set by fn_social_slot_accept */ }

  // 8. Resolve photo — AI-picked asset first, then fallback by area (quality_index > 75)
  let mediaUrl: string | null = null;
  const resolveUrl = (ph: { raw_path: string | null; renders: Record<string,string> | null } | null) => {
    if (!ph) return null;
    return ph.renders?.web_2k
      ? `${STORAGE_BASE}/${ph.renders.web_2k}`
      : ph.raw_path ? `${STORAGE_BASE}/${ph.raw_path}` : null;
  };

  if (photoId) {
    mediaUrl = resolveUrl(photoMap.get(photoId) ?? null);
  }
  if (!mediaUrl) {
    // Fallback: best quality_index > 75 photo in preferred areas
    for (const area of PHOTO_AREA_FALLBACKS) {
      const { data: fallbackPhotos } = await sb.from('mkt_v_media_ready')
        .select('raw_path,renders')
        .eq('property_id', slot.property_id)
        .eq('property_area', area)
        .eq('asset_type', 'photo')
        .contains('usage_rights', ['social_organic'])
        .not('raw_path', 'is', null)
        .gt('quality_index', 75)
        .order('quality_index', { ascending: false })
        .limit(1);
      if (fallbackPhotos && fallbackPhotos.length > 0) {
        mediaUrl = resolveUrl(fallbackPhotos[0] as { raw_path: string | null; renders: Record<string,string> | null });
        if (mediaUrl) break;
      }
    }
  }

  // Resolve link — fallback to first pinned link when AI returns null or unknown id
  const resolvedLink = linkId != null ? (links.find((l) => l.id === linkId) ?? defaultLink) : defaultLink;

  // 9. Write all enrichments back to the draft
  if (caption) {
    const patch: Record<string, unknown> = { post_id: payload.post_id, caption, hashtags };
    // Title: Pinterest-required title from AI, fallback to slot title
    if (aiTitle) patch.title = aiTitle;
    else if (slot.title) patch.title = slot.title;
    if (mediaUrl)             patch.media_urls = [mediaUrl];
    if (resolvedLink?.url)    patch.link_url   = resolvedLink.url;
    await sb.rpc('fn_social_post_update', { p: patch });
  }

  return NextResponse.json({ ok: true, post_id: payload.post_id, already: false, ai_caption: !!caption, has_media: !!mediaUrl, has_link: !!resolvedLink });
}
