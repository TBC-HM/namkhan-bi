// app/api/marketing/youtube/score-video/route.ts
// Scores a YouTube video: raw Anthropic fetch on thumbnail (vision) + Lens audit verdicts.
// Uses getVaultSecret from skills-common — NO direct @anthropic-ai/sdk import.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret, ANTHROPIC_MODEL } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NAMKHAN = 260955;

const THUMB_PROMPT = [
  'Score this YouTube thumbnail for The Namkhan — a 5-star boutique hotel in Luang Prabang, Laos (SLH Considerate Collection). Be strict.',
  'Return ONLY valid JSON (no markdown):',
  '{"visual_quality":0-100,"brand_alignment":0-100,"composition":0-100,"click_appeal":0-100,"composite":0-100,"feedback":"2-3 sentences","flags":["issue1"]}',
  'visual_quality: sharpness, exposure, color grading, professional finish.',
  'brand_alignment: luxury feel, authentic Laos culture/nature, SLH Considerate Collection standard.',
  'composition: subject framing, rule of thirds, visual hierarchy.',
  'click_appeal: would a luxury traveler stop scrolling?',
].join('\n');

function verdictScore(v: string | null): number {
  if (!v) return 50;
  const l = v.toLowerCase();
  if (l.includes('strong') || l.includes('excellent') || l.includes('keep') || l.includes('good')) return 85;
  if (l.includes('optimize') || l.includes('improve') || l.includes('consider')) return 60;
  if (l.includes('rewrite') || l.includes('weak') || l.includes('missing') || l.includes('poor')) return 30;
  return 55;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { videoId?: string } | null;
  if (!body?.videoId) return NextResponse.json({ error: 'missing videoId' }, { status: 400 });
  const videoId = body.videoId;

  const sb = getSupabaseAdmin();
  const { data: audit } = await sb.from('v_yt_channel_audit_videos')
    .select('video_title, title_verdict, description_verdict, tag_verdict, playlist_fit_score, video_views, video_likes')
    .eq('video_id', videoId).order('id', { ascending: false }).limit(1).maybeSingle();

  // 1. Thumbnail via raw Anthropic fetch (vision) — no SDK import needed
  let thumbScore = 50;
  let thumbFeedback = 'Thumbnail not analyzed.';
  let thumbFlags: string[] = [];

  try {
    const imgRes = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, { cache: 'no-store' });
    if (imgRes.ok) {
      const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
      const apiKey = await getVaultSecret('ANTHROPIC_API_KEY');
      if (apiKey) {
        const msg = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 500,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
              { type: 'text', text: THUMB_PROMPT },
            ]}],
          }),
        });
        if (msg.ok) {
          const j = await msg.json() as { content?: Array<{ type: string; text?: string }> };
          const raw = (j.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const p = JSON.parse(match[0]) as Record<string, unknown>;
            thumbScore = Math.round(Number(p.composite ?? ((Number(p.visual_quality) + Number(p.brand_alignment) + Number(p.composition) + Number(p.click_appeal)) / 4)));
            thumbFeedback = String(p.feedback ?? '');
            thumbFlags = Array.isArray(p.flags) ? (p.flags as string[]).slice(0, 6) : [];
          }
        }
      }
    }
  } catch { /* use defaults */ }

  // 2. SEO scores from Lens audit verdicts
  const titleScore = verdictScore(audit?.title_verdict ?? null);
  const descScore  = verdictScore(audit?.description_verdict ?? null);
  const rawTagScore = verdictScore(audit?.tag_verdict ?? null);
  const fitScore   = audit?.playlist_fit_score ? Math.round(Number(audit.playlist_fit_score) * 10) : 50;
  const tagsScore  = Math.round((rawTagScore + fitScore) / 2);

  // 3. Engagement vs channel baseline
  const views = Number(audit?.video_views ?? 0);
  const likes = Number(audit?.video_likes ?? 0);
  let engScore = 40;
  if (views > 0) {
    const viewRatio = Math.min(views / 800, 3);
    const likeRate  = likes > 0 ? Math.min((likes / views) * 2000, 20) : 0;
    engScore = Math.min(100, Math.round(viewRatio * 30 + likeRate + 30));
  }

  // 4. Composite: thumbnail 30% · title 25% · description 20% · tags 15% · engagement 10%
  const composite = Math.round(
    thumbScore * 0.30 + titleScore * 0.25 + descScore * 0.20 + tagsScore * 0.15 + engScore * 0.10
  );

  await sb.rpc('fn_yt_upsert_video_score', {
    p_property_id: NAMKHAN, p_video_id: videoId,
    p_video_title: audit?.video_title ?? null,
    p_thumbnail_score: thumbScore, p_thumbnail_feedback: thumbFeedback,
    p_thumbnail_flags: thumbFlags, p_title_score: titleScore,
    p_description_score: descScore, p_tags_score: tagsScore,
    p_engagement_score: engScore, p_composite_score: composite,
  });

  return NextResponse.json({
    ok: true,
    scores: { thumbnail: thumbScore, title: titleScore, description: descScore, tags: tagsScore, engagement: engScore, composite },
    feedback: thumbFeedback, flags: thumbFlags,
  });
}
