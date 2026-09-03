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
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM_PROMPT =
  `You are Lumen, social content lead for The Namkhan — a 24-room Small Luxury Hotels of the World jungle eco-lodge in Luang Prabang, Laos, with an organic eco-farm on the Nam Khan river. Voice: warm, sensory, understated luxury; Lao provenance; never salesy or cliché; no exclamation spam; max 1 emoji if it adds warmth.
Return ONLY valid JSON, no prose, no markdown: {"caption":"...","hashtags":["#tag1","#tag2"]}`;

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
      .maybeSingle(),
    Promise.resolve(null), // placeholder — spec fetched below once we know the platform
  ]);
  void specRes;

  const slot = slotRes.data;
  if (!slot) {
    return NextResponse.json({ ok: true, post_id: payload.post_id, already: false, ai_skipped: 'no_slot_context' });
  }

  // 4. Fetch platform spec and taxonomy hashtag candidates in parallel
  const tagCategories = HASHTAG_CATEGORIES[slot.platform] ?? ['subject', 'activity'];
  const [{ data: spec }, tagsRes] = await Promise.all([
    sb.from('v_social_platform_specs')
      .select('caption_max_chars,hashtags_allowed,hashtag_max')
      .eq('platform', slot.platform)
      .maybeSingle(),
    tagCategories.length > 0
      ? sb.from('mkt_media_taxonomy')
          .select('tag_slug,tag_label')
          .in('category', tagCategories)
          .eq('is_active', true)
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const captionMax = (spec as any)?.caption_max_chars ?? 500;
  const hashtagsAllowed = (spec as any)?.hashtags_allowed !== false;
  const hashtagMax = hashtagsAllowed ? Math.min(15, (spec as any)?.hashtag_max ?? 15) : 0;

  const hashtagCandidates = ((tagsRes as any)?.data ?? []).map(
    (t: { tag_slug: string; tag_label: string }) =>
      `#${t.tag_slug.replace(/_/g, '')} (${t.tag_label})`
  ) as string[];

  // 5. Build AI prompt from real slot data
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

  const hashtagLine = hashtagMax > 0 && hashtagCandidates.length > 0
    ? `Pick up to ${hashtagMax} hashtags from these brand-taxonomy candidates (or derive natural variants): ${hashtagCandidates.slice(0, 25).join(', ')}`
    : 'No hashtags for this platform — return hashtags as an empty array.';

  const userPrompt = `Write one ${slot.platform} post for this calendar slot:
${slotLines}

Caption limit: ${captionMax} characters (hard limit — do not exceed).
${hashtagLine}

Return ONLY: {"caption":"...","hashtags":["#tag",...]}`;

  // 6. Call AI
  const aiResult = await callAnthropic({
    model: 'claude-sonnet-4-5-20250929',
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
  try {
    const m = aiResult.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      caption = String(parsed.caption ?? '').slice(0, captionMax).trim();
      hashtags = Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).filter((h) => typeof h === 'string').slice(0, hashtagMax)
        : [];
    }
  } catch { /* draft keeps brief_md set by fn_social_slot_accept */ }

  // 8. Write caption + hashtags back to the draft via fn_social_post_update
  if (caption) {
    const patch: Record<string, unknown> = { post_id: payload.post_id, caption, hashtags };
    if (slot.title) patch.title = slot.title;
    await sb.rpc('fn_social_post_update', { p: patch });
  }

  return NextResponse.json({ ok: true, post_id: payload.post_id, already: false, ai_caption: !!caption });
}
