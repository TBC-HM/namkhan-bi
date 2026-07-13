// app/api/marketing/youtube/audit-run/route.ts
// PBS 2026-07-13 — Channel Audit Agent ("Lens" persona).
// Reads the channel's videos + playlists live from YouTube Data API, joins with the
// brand vocab matrix + content pillars + reality profile, calls Anthropic to audit
// every video and every playlist, then stores structured results in
// marketing.yt_channel_audit_runs + marketing.yt_channel_audit_videos.
//
// Prompt pattern follows Quill (youtube_write_metadata) — same strict-JSON contract,
// same brand-voice constraints, same vocabulary-matrix awareness. See task #156 origin
// discussion + prior-art seed-batch route for the persona/context/JSON shape template.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannel, fetchChannelPlaylists, fetchRecentVideos, isErr } from '@/lib/youtube/data';
import { callAnthropic, isLlmOk, extractJsonBlock, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN = 260955;

interface AuditVideoOut {
  video_id: string;
  current_grade: 'A' | 'B' | 'C' | 'D' | 'F' | string;
  title_verdict: string;
  suggested_title: string;
  description_verdict: string;
  suggested_description: string;
  tag_verdict: string;
  suggested_tags: string[];
  playlist_fit_score: number;   // 0-10
  suggested_playlist: string;   // playlist title or 'no playlist' or 'new: <label>'
  issues: string[];
}
interface AuditPlaylistOut {
  playlist_id: string;
  playlist_title: string;
  current_grade: string;
  thematic_coherence: number;  // 0-10
  performance_score: number;   // 0-10
  verdict: 'keep' | 'merge' | 'kill' | 'rename' | string;
  notes: string;
}
interface AuditResp {
  overall_channel_grade: string;
  channel_summary: string;
  brand_voice_notes: string;
  top_wins: string[];
  top_fixes: string[];
  videos: AuditVideoOut[];
  playlists: AuditPlaylistOut[];
}

export async function POST() {
  const sb = getSupabaseAdmin();

  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token || !tok.channel_id) {
    return err('token_unavailable', 400, { detail: tok.error ?? 'unknown' });
  }

  // === 1) Pull channel state — identity, playlists, recent videos ===
  const [chRes, plRes, vidRes] = await Promise.all([
    fetchChannel(tok.access_token, tok.channel_id),
    fetchChannelPlaylists(tok.access_token, tok.channel_id, 50),
    fetchRecentVideos(tok.access_token, tok.channel_id, 12),
  ]);
  if (isErr(chRes)) return err('channel_fetch_failed', 502, { detail: chRes.error });
  const ch = chRes.data;
  const playlists = isErr(plRes) ? [] : plRes.data;
  const videos = isErr(vidRes) ? [] : vidRes.data;
  if (videos.length === 0) return err('no_videos_to_audit', 400, { detail: `channel ${ch.id} has 0 videos in the last 12-recent window` });

  // === 2) Pull brand context — vocab + pillars + reality ===
  const [vocabRes, pillarsRes, realityRes] = await Promise.all([
    sb.from('v_yt_vocabulary_matrix').select('banned_term_lower,luxury_alternative,severity').limit(50),
    sb.from('v_yt_content_pillars')
      .select('pillar_key,label,description,target_cadence,youtube_playlist_id')
      .eq('property_id', NAMKHAN).eq('active', true).order('sort_order'),
    sb.from('v_reality_profile').select('*').eq('property_id', NAMKHAN).maybeSingle(),
  ]);
  const vocab = ((vocabRes.data ?? []) as Array<{ banned_term_lower: string; luxury_alternative: string; severity: string }>);
  const pillars = ((pillarsRes.data ?? []) as Array<{ pillar_key: string; label: string; description: string | null; target_cadence: string | null; youtube_playlist_id: string | null }>);
  const reality: any = realityRes.data ?? null;

  const bannedList = vocab.slice(0, 40).map((r) => `  • "${r.banned_term_lower}" → "${r.luxury_alternative}" (${r.severity})`).join('\n');
  const pillarList = pillars.map((p) => `  • ${p.label} (${p.target_cadence ?? 'ad hoc'}): ${p.description ?? ''}`).join('\n');
  const playlistList = playlists.map((p) => `  • ${p.id} — "${p.title}" — ${p.itemCount} videos`).join('\n');

  // Compact video payload the LLM will audit
  const videoPayload = videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: (v.description ?? '').slice(0, 400),
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    published: v.publishedAt.slice(0, 10),
  }));

  // === 3) Build the audit prompt ===
  const systemPrompt = [
    'You are Lens, the YouTube channel auditor for Namkhan — a 24-room boutique river-lodge in Luang Prabang, Laos, sitting at the Nam Khan / Mekong confluence. Small Luxury Hotels member.',
    'Voice: quiet, sensory, culture-first. Never party/casino/megaresort language.',
    'Job: audit every video + every playlist. Grade honestly. Recommend fixes.',
    'You MUST respect the vocabulary matrix — flag banned terms in current titles/descriptions, and never use them in suggestions.',
    '',
    'BRAND REALITY:',
    reality?.location ? `  Location: ${reality.location}` : '',
    Array.isArray(reality?.palette) && reality.palette.length ? `  Palette: ${reality.palette.join(', ')}` : '',
    Array.isArray(reality?.architecture) && reality.architecture.length ? `  Architecture: ${reality.architecture.join(', ')}` : '',
    Array.isArray(reality?.forbidden) && reality.forbidden.length ? `  Forbidden concepts: ${reality.forbidden.join(', ')}` : '',
    '',
    'CONTENT PILLARS (Namkhan-native series):',
    pillarList || '  (none defined yet)',
    '',
    'EXISTING PLAYLISTS ON CHANNEL:',
    playlistList || '  (no playlists yet)',
    '',
    'VOCABULARY MATRIX (top 40 banned → luxury alternative, severity):',
    bannedList || '  (empty)',
    '',
    'Return ONLY a valid JSON object with this exact shape (no markdown fences, no prose):',
    '{',
    '  "overall_channel_grade": "A|B|C|D|F",',
    '  "channel_summary": "2-3 sentences on channel brand-voice health",',
    '  "brand_voice_notes": "3-5 sentences: strengths and drift",',
    '  "top_wins": ["...", "...", "..."],',
    '  "top_fixes": ["...", "...", "..."],',
    '  "playlists": [{',
    '    "playlist_id": "...",',
    '    "playlist_title": "...",',
    '    "current_grade": "A|B|C|D|F",',
    '    "thematic_coherence": 0-10,',
    '    "performance_score": 0-10,',
    '    "verdict": "keep|merge|kill|rename",',
    '    "notes": "1-2 sentences on why + which pillar it should map to"',
    '  }],',
    '  "videos": [{',
    '    "video_id": "...",',
    '    "current_grade": "A|B|C|D|F",',
    '    "title_verdict": "1 sentence — is the current title on brand and SEO-strong?",',
    '    "suggested_title": "<=60 chars",',
    '    "description_verdict": "1 sentence — brand voice + hook + info?",',
    '    "suggested_description": "<=500 chars — the first two lines must include a hook + primary keyword",',
    '    "tag_verdict": "1 sentence — coverage + brand alignment",',
    '    "suggested_tags": ["lowercase","10 tags"],',
    '    "playlist_fit_score": 0-10,',
    '    "suggested_playlist": "<existing playlist title, or \'new: <label>\', or \'no playlist\'>",',
    '    "issues": ["short phrases — banned-term hit, thumbnail generic, no CTA, etc."]',
    '  }]',
    '}',
  ].filter(Boolean).join('\n');

  const userPrompt = [
    `CHANNEL: ${ch.title} — ${ch.subscriberCount} subs · ${ch.viewCount} total views · ${ch.videoCount} videos total.`,
    '',
    `VIDEOS TO AUDIT (${videoPayload.length}, recent uploads):`,
    JSON.stringify(videoPayload, null, 2),
    '',
    'Return the JSON object now. Grade honestly — do not sugarcoat. Prioritise brand-voice hits and playlist mapping.',
  ].join('\n');

  // === 4) Call Anthropic ===
  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 8000 });
  if (!isLlmOk(llm)) return err(llm.error, 502, { detail: (llm as { detail?: string }).detail });

  const parsed = extractJsonBlock<AuditResp>(llm.text);
  if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.playlists)) {
    const rawHead = llm.text.slice(0, 800);
    const parsedShape = parsed ? JSON.stringify(Object.keys(parsed)).slice(0, 200) : 'null';
    return err('llm_bad_shape', 502, {
      detail: `parsed_shape=${parsedShape} · raw_head=${rawHead}`,
      raw_head: rawHead,
      parsed_shape: parsedShape,
    });
  }

  // === 5) Persist via SECURITY DEFINER RPC (marketing schema is not PostgREST-exposed).
  const videoRowsJson = parsed.videos.map((v) => {
    const meta = videos.find((x) => x.id === v.video_id);
    return {
      video_id:               v.video_id,
      video_title:            meta?.title ?? null,
      video_views:            meta?.views ?? null,
      video_likes:            meta?.likes ?? null,
      video_published:        meta?.publishedAt ?? null,
      current_grade:          v.current_grade ?? null,
      title_verdict:          v.title_verdict ?? null,
      suggested_title:        v.suggested_title ?? null,
      description_verdict:    v.description_verdict ?? null,
      suggested_description:  v.suggested_description ?? null,
      tag_verdict:            v.tag_verdict ?? null,
      suggested_tags:         Array.isArray(v.suggested_tags) ? v.suggested_tags.slice(0, 15) : [],
      playlist_fit_score:     Number.isFinite(v.playlist_fit_score) ? Number(v.playlist_fit_score) : null,
      current_playlist_title: null,
      suggested_playlist:     v.suggested_playlist ?? null,
      issues:                 v.issues ?? [],
    };
  });

  const { data: runIdRaw, error: rpcErr } = await sb.rpc('fn_yt_audit_persist', {
    p_property_id:       NAMKHAN,
    p_model:             'claude-sonnet-4',
    p_video_count:       parsed.videos.length,
    p_overall_grade:     parsed.overall_channel_grade ?? null,
    p_channel_summary:   parsed.channel_summary ?? null,
    p_brand_voice_notes: parsed.brand_voice_notes ?? null,
    p_top_wins:          parsed.top_wins ?? [],
    p_top_fixes:         parsed.top_fixes ?? [],
    p_playlist_verdicts: parsed.playlists,
    p_raw_response:      parsed,
    p_videos:            videoRowsJson,
  });
  if (rpcErr) return err('audit_persist_failed', 500, { detail: rpcErr.message });
  const runId = typeof runIdRaw === 'string' ? runIdRaw : String(runIdRaw ?? '');

  return ok({
    run_id:          runId,
    video_count:     parsed.videos.length,
    playlist_count:  parsed.playlists.length,
    overall_grade:   parsed.overall_channel_grade,
  });
}
