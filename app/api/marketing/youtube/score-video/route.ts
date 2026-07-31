// app/api/marketing/youtube/score-video/route.ts
// Scores a YouTube video: Claude vision on thumbnail + Lens audit verdicts.
// No YouTube API quota used — thumbnails from public CDN, audit from DB.
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NAMKHAN = 260955;
const anthropic = new Anthropic();

const THUMB_PROMPT = `Score this YouTube thumbnail for The Namkhan — a 5-star boutique hotel in Luang Prabang, Laos (SLH Considerate Collection). Be strict — luxury hospitality standard.

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "visual_quality": 0-100,
  "brand_alignment": 0-100,
  "composition": 0-100,
  "click_appeal": 0-100,
  "composite": 0-100,
  "feedback": "2-3 sentences",
  "flags": ["issue1", "issue2"]
}

visual_quality: sharpness, exposure, color grading, professional finish.
brand_alignment: 5-star feel, authentic Laos culture/nature, appropriate for SLH Considerate Collection, no clutter.
composition: subject framing, rule of thirds, visual hierarchy, clean background.
click_appeal: would a luxury traveler stop scrolling? Is the hook compelling?`;

function verdictScore(v: string | null): number {
  if (!v) return 50;
  const l = v.toLowerCase();
  if (l.includes('strong') || l.includes('excellent') || l.includes('keep') || l.includes('good')) return 85;
  if (l.includes('optimize') || l.includes('improve') || l.includes('consider')) return 60;
  if (l.includes('rewrite') || l.includes('weak') || l.includes('missing') || l.includes('poor')) return 30;
  return 55;
}

export async function POST(req: NextRequest) {
  let videoId: string;
  try { ({ videoId } = await req.json()); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!videoId) return NextResponse.json({ error: 'missing videoId' }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: audit } = await sb.from('v_yt_channel_audit_videos')
    .select('video_title, title_verdict, description_verdict, tag_verdict, playlist_fit_score, video_views, video_likes')
    .eq('video_id', videoId).order('id', { ascending: false }).limit(1).maybeSingle();

  // 1. Thumbnail via Claude vision (public CDN — no YouTube quota)
  let thumbScore = 50;
  let thumbFeedback = 'Thumbnail not analyzed.';
  let thumbFlags: string[] = [];
  try {
    const imgRes = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, { cache: 'no-store' });
    if (imgRes.ok) {
      const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 500,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: THUMB_PROMPT },
        ]}],
      });
      const raw = (msg.content[0] as { type: string; text: string }).text;
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]);
        thumbScore = Math.round(p.composite ?? ((p.visual_quality + p.brand_alignment + p.composition + p.click_appeal) / 4));
        thumbFeedback = p.feedback ?? '';
        thumbFlags = Array.isArray(p.flags) ? p.flags.slice(0, 6) : [];
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
